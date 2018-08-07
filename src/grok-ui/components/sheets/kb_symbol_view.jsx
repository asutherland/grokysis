import React from 'react';

import KBSymbol from '../kb_details/kb_symbol.jsx';

/**
 * Eh, just show the symbol info widget and be done with it.
 */
export default class KBSymbolViewSheet extends React.Component {
  constructor(props) {
    super(props);

    this.onNavigateIntoSym = this.onNavigateIntoSym.bind(this);
  }

  onNavigateIntoSym(sym) {
    const thing = this.props.sessionThing;

    console.log('trying to replace self with', sym);
    thing.replaceWithPersistedState({
      rawSymbol: sym.rawName
    });
  }

  render() {
    return (
      <KBSymbol {...this.props}
        doNavigateIntoSym={ this.onNavigateIntoSym }
        />
    );
  }
}
