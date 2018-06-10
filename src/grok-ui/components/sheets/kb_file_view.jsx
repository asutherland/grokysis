import React from 'react';

import KBFile from '../kb_details/kb_file.jsx';

/**
 * Eh, just show the file info widget and be done with it.
 */
export default class KBFileViewSheet extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <KBFile {...this.props} />
    );
  }
}
