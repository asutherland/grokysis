import React from 'react';

import { Menu } from 'semantic-ui-react';

import TriceTimelineVis from '../trice_timeline/timeline_vis.jsx';

/**
 * Displays a trice timeline given a `triceLog` prop.
 */
export default class TriceTimelineSheet extends React.PureComponent {
  constructor(props) {
    super(props);

    const triceLog = this.props.triceLog;
    const sessionThing = this.props.sessionThing;

    triceLog.restoreState(sessionThing.persisted.logPersisted);

    // We handle slot message routing, so it's necessary for us to have a ref to
    // the vis to direct it to respond to external stimuli like seeking which
    // we do not want to rebuild the vis.  For re-filtering it's fine to
    // re-build the vis.
    this.visRef = React.createRef();

    this.onEventClicked = this.onEventClicked.bind(this);
    this.onFiltersClicked = this.onFiltersClicked.bind(this);

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
    // exact same deal with filters; this obviously needs support logic.
    this.lastSpawnedFilters = 0;

    this.onSeekRequest = this.onSeekRequest.bind(this);
    this.onRangeChanged = this.onRangeChanged.bind(this);
    this.onZoomIn = this.onZoomIn.bind(this);
    this.onZoomOut = this.onZoomOut.bind(this);
    this.onMovePrev = this.onMovePrev.bind(this);
    this.onMoveNext = this.onMoveNext.bind(this);
  }

  componentDidMount() {
    this.props.sessionThing.handleSlotMessage(
      'triceLog:vis:seek', this.onSeekRequest);

    this.props.triceLog.on(
      'persistedStateDirty', this.onPersistedStateDirty, this);
  }

  componentWillUnmount() {
    this.props.sessionThing.stopHandlingSlotMessage('triceLog:vis:seek');

    this.props.triceLog.removeListener(
      'persistedStateDirty', this.onPersistedStateDirty, this);
  }

  onPersistedStateDirty() {
    const triceLog = this.props.triceLog;
    const sessionThing = this.props.sessionThing;
    const oldState = sessionThing.persisted;
    const newState = Object.assign({}, oldState, {
      logPersisted: triceLog.toPersisted()
    });
    console.log("updating persisted state", newState, "from", oldState);
    sessionThing.updatePersistedState(newState);
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

  onFiltersClicked() {
    if (performance.now() - this.lastSpawnedFilters < 3000) {
      return;
    }

    const thing = this.props.sessionThing;
    const [existed] =
      thing.sendSlotMessage('triceLog:filters:hello', this.props.triceLog, true);
    if (existed) {
      // nothing else to do.
      return;
    }

    thing.addThingInOtherTrack({
      position: 'end',
      type: 'triceFilter',
      persisted: {}
    });

    this.lastSpawnedFilters = performance.now();
  }

  onSeekRequest(req) {
    const vis = this.visRef.current;
    if (!vis) {
      return;
    }

    let time;
    if (req.bin) {
      time = this.props.triceLog.translateBinToItemTime(req.bin);
    } else {
      console.warn('bad seek request format', req);
      throw new Error('bad seek request format');
    }

    vis.doSeek(time);
  }

  onRangeChanged({ start, end }) {
    const triceLog = this.props.triceLog;
    const startBin = triceLog.translateItemTimeToBin(start);
    const endBin = triceLog.translateItemTimeToBin(end);

    // XXX this conceptually wants to be a broadcast.
    const thing = this.props.sessionThing;
    thing.sendSlotMessage('triceLog:filters:seeked', { startBin, endBin });
  }

  /** Return the underlying vis.js timeline widget to invoke its methods */
  get visJsWidget() {
    const visJsx = this.visRef.current;
    return visJsx.visJsWidget;
  }

  onZoomIn() {
    this.visJsWidget.zoomIn(0.5);
  }

  onZoomOut() {
    this.visJsWidget.zoomOut(0.5);
  }

  /**
   * Move the window so that the first event preceding the visible window is
   * brought to the center of the timline.
   */
  onMovePrev() {
    const triceLog = this.props.triceLog;
    const startTime = this.visJsWidget.getWindow().start.valueOf();
    const event = triceLog.findfirstEventBeforeItemTime(startTime);
    if (event) {
      this.visJsWidget.moveTo(event.start);
    }
  }

  onMoveNext() {
    const triceLog = this.props.triceLog;
    const endTime = this.visJsWidget.getWindow().end.valueOf();
    const event = triceLog.findfirstEventAfterItemTime(endTime);
    if (event) {
      this.visJsWidget.moveTo(event.start);
    }
  }

  render() {
    return (
      <div>
        <Menu size='small'>
          <Menu.Menu>
            <Menu.Item icon='zoom in' onClick={ this.onZoomIn } />
            <Menu.Item icon='zoom out' onClick={ this.onZoomOut } />
          </Menu.Menu>
          <Menu.Menu>
            <Menu.Item icon='backward' onClick={ this.onMovePrev } />
            <Menu.Item icon='forward' onClick={ this.onMoveNext } />
          </Menu.Menu>
          <Menu.Menu position='right'>
            <Menu.Item
              name='Filters'
              onClick={ this.onFiltersClicked } />
          </Menu.Menu>
        </Menu>

        <TriceTimelineVis ref={ this.visRef }
           triceLog={ this.props.triceLog }
           onEventClicked={ this.onEventClicked }
           onRangeChanged={ this.onRangeChanged }
           />
      </div>
    );
  }
}
