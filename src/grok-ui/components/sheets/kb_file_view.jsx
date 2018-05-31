import React from 'react';

import CapturedData from '../trice_details/captured_data.jsx';
import Stack from '../trice_details/stack.jsx';

/**
 * Development variant of MethodViewSheet that helps iterate on what will power
 * MethodViewSheet.
 */
export default class KBFileViewSheet extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      event: null
    };
  }

  render() {
    return (
      <div>
      </div>
    );
  }
}
