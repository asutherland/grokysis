import EE from 'eventemitter3';

export default class TriceLog extends EE {
  constructor({ events, config }) {
    super();

    this.serial = 0;

    /**
     * The events as parsed out of the nd-json file, unfiltered, but with some
     * normalizations perormed in place that ideally would have happened during
     * trace generation.  In particular:
     * - Strings are normalized from `0xf00 "string"` to just `string`.  This
     *   is because the pretty printers are getting involved be helpful, but
     *   it's not actually that helpful.
     */
    this.rawEvents = events;
    /**
     * The (effective) TOML config file that was used to generate the trace and
     * may have display hints built-in.  By effective, I mean that this might
     * end up being the fusion of several separate TOML configs that were all
     * loaded at the same time (which deal with orthogonal details).
     */
    this.rawConfig = config;

    this.filterFuncs = [];

    /**
     * The result of filtering/faceting rawEvents and producing vis.js timeline
     * items from the events.  These pair with `filteredVisGroups`.
     */
    this.filteredVisItems = [];
    /**
     * Paired with `filteredVisItems`, feed to vis.js
     */
    this.filteredVisGroups = [];

    // ## normalize rawEvents
    for (const event of events) {
      this.normalizeCaptured(event.captured);
    }

    this.processConfig(this.rawConfig);
    this.processEvents(this.rawEvents);
  }


  processConfig(config) {
    const bpSpecInfo = this.breakpointSpecToInfo = new Map();

    if (config.trace) {
      for (const [spec, cfg] of Object.entries(config.trace)) {
        const info = {};
        bpSpecInfo.set(spec, info);

        if (cfg.display && Array.isArray(cfg.display)) {
          const normDisplay = cfg.display.map(piece => {
            if (Array.isArray(piece)) {
              switch (piece[0]) {
                case 'literal': {
                  const literal = piece[1];
                  return () => literal;
                }
                case 'lookup': {
                  const lookupKey = piece.slice(1).join('.');
                  return (event) => event.captured[lookupKey] || 'NOT PRESENT';
                }
                default: {
                  console.warn('unable to process config display op', piece[0]);
                  return () => 'CONFIG ERROR';
                }
              }
            } else {
              console.warn('unable to process config display piece', piece);
              return () => 'CONFIG ERROR';
            }
          });
          info.formatEvent = (event) => {
            let str = '';
            for (const segFunc of normDisplay) {
              str += segFunc(event);
            }
            return str;
          }
        }
      }
    }
  }

  formatEventContent(event, fallback) {
    const info = this.breakpointSpecToInfo.get(event.spec);
    if (!info || !info.formatEvent) {
      return fallback;
    }
    return info.formatEvent(event);
  }

  normalizeCaptured(captured) {
    if (!captured) {
      return;
    }

    for (const [key, value] of Object.entries(captured)) {
      // ## Extract the string payload from `0xf00 "actual string"``
      const strMatch = /^0x[0-9a-f]+ "(.+)"$/.exec(value);
      if (strMatch) {
        captured[key] = strMatch[1];
      }
    }
  }

  processEvents(events) {
    const groups = this.filteredVisGroups = [];
    const items = this.filteredVisItems = [];

    const SCALE = this.SCALE = 100;
    const firstTick = events[0].tick - SCALE;

    const tidToGroup = new Map();

    for (let iEvent=0; iEvent < events.length; iEvent++) {
      const event = events[iEvent];

      const tid = event.tid;

      // ## ensure group
      let group = tidToGroup.get(tid);
      if (!group) {
        let tname = event.tname;
        if (/^mmap_hardlink/.test(tname)) {
          tname = 'Main Thread';
        }

        group = {
          id: tid,
          content: tname
        };
        groups.push(group);
        tidToGroup.set(tid, group);
      }

      // ## create item
      // persist the start for easier consultation.
      const content = this.formatEventContent(event, event.spec);
      event.start = Math.floor((event.tick - firstTick) / SCALE);
      const item = {
        id: iEvent,
        content,
        start: event.start,
        group: tid
      };
      items.push(item);
    }

    this.serial++;
    this.emit('dirty');
  }

}
