import React from 'react';

import HitDict from './hit_dict.jsx';
import PathHitList from './path_hit_list.jsx';

import './symbol_hit.css';

/**
 * Renders a single symbol and its dictionary of defs/decls/uses/etc.  Consumes
 * props:
 * - symbolName
 * - hitDict
 */
export default class SymbolHit extends React.PureComponent {
  render() {
    const { symbolName, hitDict } = this.props;

    const contentFactory = (pathHits, selected) => {
      return <PathHitList pathHits={ pathHits || [] } />;
    };

    return (
      <div>
        <div className="symbolHit__symbol">{ symbolName }</div>
        <div className="symbolHit__hitDict">
          <HitDict hitDict={ hitDict } contentFactory={ contentFactory }/>
        </div>
      </div>
    );
  }
}