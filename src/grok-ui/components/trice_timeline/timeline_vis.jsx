import React from 'react';

import Timeline from 'react-visjs-timeline';

import DirtyingComponent from '../dirtying_component.js';

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
export default class TriceTimelineVis extends DirtyingComponent {
  constructor(props) {
    super(props, 'triceLog');

    // We snapshot these off of this.props.triceLog in render() for sanity
    // right now.
    this.snapItems = [];
    this.snapGroups = [];

    this.onClick = this.onClick.bind(this);
  }

  onClick(tev) {
    // The item is the id of the item object, not the actual item.  And the id
    // as created by TriceLog is the index in the full list, regardless of
    // any filtering that may have been applied.
    if (tev.item) {
      const event = this.props.triceLog.rawEvents[tev.item];
      this.props.onEventClicked(event);
    }
  }

  render() {
    const triceLog = this.props.triceLog;

    this.options = {
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
          const relTicks = Math.floor(date * triceLog.SCALE / 1000000);
          return `${relTicks} MTicks`;
        }
      }
    };

    this.snapItems = triceLog.filteredVisItems.concat();
    this.snapGroups = triceLog.filteredVisGroups.concat();

    return (
      <Timeline
        options={ this.options }
        items={ this.snapItems }
        groups={ this.snapGroups }
        clickHandler={ this.onClick }
        />
    );
  }
}
