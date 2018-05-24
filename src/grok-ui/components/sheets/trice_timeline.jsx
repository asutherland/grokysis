import React from 'react';

//import DirtyingComponent from '../dirtying_component.js';

import TriceTimelineVis from '../trice_timeline/timeline_vis.jsx';

/**
 * Displays a trice timeline given a `triceLog` prop.
 */
export default class TriceTimelineSheet extends React.PureComponent {
  constructor(props) {
    super(props, 'triceLog');

    this._bound_clickHandler = this.onEventClicked.bind(this);

    // Performance.now() timestamp of when we last created a new sheet to
    // display event details because we couldn't find one.  The idea is that
    // the user may end up closing this sheet then come back to this sheet, so
    // this shouldn't be a one-time-only spawn, but we also don't want a bunch
    // of aggressive initial clicking to spawn too many of these.
    //
    // NB: this does potentially suggest that we should actually be naming the
    // sheet itself, rather than having it register itself to a singleton name,
    // but that does limit manual multiplexing.  (Like via a 'pin' icon which
    // could cause the event detail to unregister itself and dump the entirety
    // of the info on the event it's listening to to be persisted.)
    this.lastSpawnedSheet = 0;
  }

  onEventClicked(event) {
    // ignore the click if we've recently spawned a sheet.
    if (performance.now() - this.lastSpawnedSheet < 3000) {
      return;
    }

    const thing = this.props.sessionThing;
    const [existed] =
      thing.sendSlotMessage('triceLog:eventFocused', event, true);
    if (existed) {
      // nothing else to do.
      return;
    }

    // It wasn't handled, which means that we need to spawn a trice_detail
    // sheet.  Because of the slot queueing mechanism, the message we sent above
    // will eventually be received and processed.
    thing.addThingInOtherTrack({
      position: 'end',
      type: 'triceDetail',
      persisted: {}
    });

    this.lastSpawnedSheet = performance.now();
  }

  render() {
    return (
      <TriceTimelineVis
         triceLog={ this.props.triceLog }
         onEventClicked={ this._bound_clickHandler }
         />
    );
  }
}
