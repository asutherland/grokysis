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

    /**
     * List of the breakpoints we observed and summary statistics over the
     * time-scales, with those that had `facetBy` entries in the toml config
     * containing self-similar child nodes that contain similar statistics.
     */
    this.filterableFacets = [];

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

    // ## normalize rawEvents and find time bounds
    const SCALE = this.SCALE = 100;
    // Do min/max over all the events.  If the logs came from a single process,
    // we expect the first/last even to correspond to firstTick and lastTick,
    // but we expect to be dealing with multiple processes' traces and that
    // they may not actually be sorted.
    let firstTick = events[0].tick;
    let lastTick = events[0].tick;

    for (const event of events) {
      this.normalizeCaptured(event.captured);
      firstTick = Math.min(event.tick, firstTick);
      lastTick = Math.max(event.tick, lastTick);
    }
    this.firstTick = firstTick;
    this.lastTick = lastTick;

    // ## need the configuration to process the events
    this.processConfig(this.rawConfig);

    // ## compute the facets.
    this.deriveFilterableFacets();

    // ## perform an initial, un-filtered event processing.
    this.processEvents(this.rawEvents);
  }

  processConfig(config) {
    const bpSpecInfo = this.breakpointSpecToInfo = new Map();

    if (config.trace) {
      for (const [spec, cfg] of Object.entries(config.trace)) {
        const info = {};
        bpSpecInfo.set(spec, info);

        // ## `display` for the terse display format.
        // This is an array of arrays weird format right now.  This is partially
        // because toml requires homogeneous arrays.  The right thing is
        // some type of simplistic templating mechanism that resembles template
        // literals.  It would probably be wise to do this at the same time as
        // cleaning up the syntax for specifying gdb object traversals.
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
        } else {
          info.formatEvent = null;
        }

        if (cfg.facetBy) {
          info.facetBy = cfg.facetBy;
        } else {
          info.facetBy = [];
        }
      }
    }
  }

  deriveFilterableFacets() {
    const NBINS = 100;

    function makeFacet(name) {
      const facet = {
        name,
        count: 0,
        bins: new Array(NBINS),
        children: [],
        childrenByKey: new Map()
      };
      for (let i=0; i < NBINS; i++) {
        facet.bins[i] = 0;
      }
      return facet;
    }

    const topFacets = this.filterableFacets = [];
    const topBySpec = new Map();

    const firstTick = this.firstTick;
    const tickSpan = this.lastTick - this.firstTick;

    for (const event of this.rawEvents) {
      const spec = event.spec;
      let facet = topBySpec.get(spec);
      if (!facet) {
        facet = makeFacet(spec);
        topFacets.push(facet);
        topBySpec.set(spec, facet);
      }
      facet.count++;

      const useBin = Math.floor(NBINS * (event.start - firstTick) / tickSpan);
      facet.bins[useBin]++;

      const info = this.breakpointSpecToInfo.get(spec);
      for (const facetDef of info.facetBy) {
        const lookupKey = facetDef.join('.');
        if (!(lookupKey in event.captured)) {
          continue;
        }

        const value = event.captured[lookupKey];
        let kidFacet = facet.childrenByKey.get(value);
        if (!kidFacet) {
          kidFacet = makeFacet(value);
          facet.children.push(kidFacet);
          facet.childrenByKey.set(value, kidFacet);
        }
        kidFacet.count++;
        kidFacet.bins[useBin]++;
      }
      facet.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    topFacets.sort((a, b) => a.name.localeCompare(b.name));

    this.emit('facetsUpdated', this.filterableFacets);
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

  processEvents() {
    const events = this.rawEvents;
    const groups = this.filteredVisGroups = [];
    const items = this.filteredVisItems = [];

    const SCALE = this.SCALE;
    const firstTick = this.firstTick;

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
