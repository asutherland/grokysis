import React from 'react';


/**
 * Displays the focused events in a Trice Log sheet.
 */
export default class TriceDetailSheet extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      event: null
    };

    this.onEventSelected = this.onEventSelected.bind(this);
  }

  componentWillMount() {
    this.props.sessionThing.handleSlotMessage(
      'triceLog:eventFocused', this.onEventSelected);
  }

  componentWillUnmount() {
    this.props.sessionThing.stopHandlingSlotMessage('triceLog:eventFocused');
  }

  onEventSelected(event) {
    this.setState({ event });
  }

  render() {
    const event = this.state.event;
    if (!event) {
      return <div></div>;
    }

    return (
      <div>
        <div>start: <b>{ event.start }</b></div>
        <div>event: { event.event }</div>
        <div>tick: { event.tick }</div>
        <div>tid: { event.tid }</div>
        <div>tname: { event.tname }</div>
        <div>spec: { event.spec }</div>
        <pre>{ JSON.stringify(event.captured, 2) }</pre>
        <pre>{ JSON.stringify(event.stack, 2) }</pre>
        <pre>{ event.jsstack }</pre>
      </div>
    );
  }
}
