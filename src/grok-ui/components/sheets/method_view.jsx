import React from 'react';

import CapturedData from '../trice_details/captured_data.jsx';
import Stack from '../trice_details/stack.jsx';

/**
 * Displays a variety of views of a searchfox-indexed function/method.  The
 * current plan is to have 2 tabbed views:
 * 1. The textual source of the method.  Initially dumb, later being able to
 *    spawn separate sheets or graph edges by clicking on things.
 * 2. The distilled semantic understanding of the source in terms of out-edges.
 */
export default class MethodViewSheet extends React.Component {
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

    return (
      <div>
      </div>
    );
  }
}
