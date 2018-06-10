import React from 'react';

import KBSymbol from '../kb_details/kb_symbol.jsx';

/**
 * Eh, just show the symbol info widget and be done with it.
 */
export default class KBSymbolViewSheet extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <KBSymbol {...this.props} />
    );
  }
}
