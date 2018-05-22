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

    this.processEvents(this.props.triceLog);
  }

  processEvents(events) {
    const groups = this.groups = [];
    const items = this.items = [];
    const options = this.options = {
      start: 0,
      zoomMin: 100,
      zoomMax: 1 * 1000 * 1000
    };

    const tidToGroup = new Map();

    for (const event of events) {
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
      const item = {
        id: event.tick,
        content: event.spec,
        start: Math.floor(event.time * 1000000),
        group: tid
      };
      items.push(item);

    }
  }

  render() {
    return (
      <Timeline
        options={ this.options }
        items={ this.items }
        groups={ this.groups }
        />
    );
  }
}
