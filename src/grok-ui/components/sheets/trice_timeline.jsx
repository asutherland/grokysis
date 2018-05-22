import React from 'react';

//import DirtyingComponent from '../dirtying_component.js';

import TriceTimelineVis from '../trice_timeline/timeline_vis.jsx';

/**
 * Displays a trice timeline given a `triceLog` prop.
 */
export default class TriceTimelineSheet extends React.PureComponent {
  constructor(props) {
    super(props, 'triceLog');
  }

  render() {
    return (
      <TriceTimelineVis triceLog={ this.props.triceLog }/>
    );
  }
}
