import React from 'react';

import Timeline from 'react-visjs-timeline';

/**
 * Visualization of trice log.  For now, this just consumes raw events as loaded
 * from the JSON log, but processing should be refactored out into backend
 * helpers.  Probably.  Or not.
 *
 * ## Log Event Contents
 * Each event may contain the following fields:
 * - event: Granular rr event number, probably corresponds to how many
 *   non-deterministic things happened.  Useful for jumping around in the trace
 *   maybe.
 * - tick: High resolution location number, involves instruction counts.
 * - tid: Integer thread number.
 * - tname: The thread name if one was explicitly set.  For the main thread as
 *   run under rr, this is likely to end up being "mmap_hardlink_#_firefox" or
 *   something like that.
 * - time: Floating point number of seconds since the start of the trace.
 * - spec: The breakpoint specification that led to the breakpoint triggering.
 *   This will usually be the fully qualified symbol name (including "(anonymous
 *   namespace)") but without exact function call arguments cited, although you
 *   could provide those if desired.  This could also be something like
 *   "file.cpp:100" for line 100 in file.cpp.
 * - captured: A dictionary whose keys are stringified representations of
 *   multi-part gdb traversals and whose values are the stringified result of
 *   those traversals.
 * - stack: Optionally present, an array of { name, file, line } objects, where
 *   name is the symbol name of the function and the rest is obvious.  name and
 *   file may be null and line 0 if gdb was unable to figure out symbol info.
 *   In particular, this will absolutely happen when there are JS jit frames on
 *   the stack.  The SpiderMonkey gdb pretty printers have some code that tries
 *   to fix up the frames, but it didn't work for me and freaked gdb out, so I
 *   don't try and run with it.  If it ever starts working, it just needs to be
 *   imported and things should magically start working here.
 * - jsstack: Optionally present, currently the string representation that you'd
 *   see if you invoked `call DumpJSStack()` from gdb using the same mechanism
 *   but bypassing all the print stuff (and the buffer size limit).  In the
 *   the future this might be parsed into an object representation like `stack`.
 */
export default class TriceTimelineVis extends React.PureComponent {
  constructor(props) {
    super(props);

    this.triceLog = this.props.triceLog;
    this.rawEvents = this.triceLog.events;
    this.config = this.triceLog.config;

    this.processConfig(this.config);

    this.processEvents(this.rawEvents);

    this.onClick = this.onClick.bind(this);
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
    const groups = this.groups = [];
    const items = this.items = [];

    const SCALE = 100;
    const firstTick = events[0].tick - SCALE;

    const options = this.options = {
      start: 0,
      // If a height isn't specified, the vis self-sizes to its currently
      // visible contents.  Since that's currently changing, the height
      // constantly changes.  So specify a reasonable-ish height and maybe at
      // some point slap a resizer on it.  (Or slap this in a resizer-controlled
      // container and set the timeline vis to 100% of that.)
      height: '600px',
      zoomMin: 10,
      zoomMax: 1 * 1000 * 1000,
      format: {
        minorLabels: function(date, scale, step) {
          const relTicks = Math.floor(date * SCALE / 1000000);
          return `${relTicks} MTicks`;
        }
      }
    };

    const tidToGroup = new Map();


    for (let iEvent=0; iEvent < events.length; iEvent++) {
      const event = events[iEvent];
      this.normalizeCaptured(event.captured);
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
  }

  onClick(tev) {
    if (tev.item) {
      const event = this.rawEvents[tev.item];
      this.props.onEventClicked(event);
    }
  }

  render() {
    return (
      <Timeline
        options={ this.options }
        items={ this.items }
        groups={ this.groups }
        clickHandler={ this.onClick }
        />
    );
  }
}
