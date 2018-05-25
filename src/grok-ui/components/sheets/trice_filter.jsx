import React from 'react';

/**
 * Supports faceting and filtering of the current trice.
 *
 * The UI is a table of
 */
export default class TriceFilterSheet extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      log: null
    };

    this.onLogHello = this.onLogHello.bind(this);
  }

  componentWillMount() {
    this.props.sessionThing.handleSlotMessage(
      'triceLog:filters:hello', this.onLogHello);
  }

  componentWillUnmount() {
    this.props.sessionThing.stopHandlingSlotMessage('triceLog:eventFocused');
  }

  onLogHello(log) {
    this.setState({ log });
  }

  render() {
    return (
      <div>
      </div>
    );
  }
}
