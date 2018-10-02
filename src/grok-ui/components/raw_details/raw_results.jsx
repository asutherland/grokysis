import React from 'react';

import HitDict from './hit_dict.jsx';
import SymbolHit from './symbol_hit.jsx';

import './raw_results.css';

/**
 * Renders a single symbol and its dictionary of defs/decls/uses/etc.  Consumes
 * props:
 * - symbolName
 * - hitDict
 */
export default class RawResults extends React.PureComponent {
  render() {
    const { sessionThing, grokCtx } = this.props;
    const rawSearchResults = this.props.rawResults;
    const rawResults = rawSearchResults.raw;

    const contentFactory = (typedResults) => {
      // XXX for now, just pierce "semantic" directly, which means we ignore
      // "files" and "fulltext" results.
      const symbolHits = typedResults.semantic || {};
      const renderedSymbolHits = [];
      for (const [symbol, groupedHits] of Object.entries(symbolHits)) {
        renderedSymbolHits.push(
          <SymbolHit
            key={ symbol }
            grokCtx={ grokCtx }
            sessionThing={ sessionThing }
            symbolName={ symbol }
            hitDict={ groupedHits } />
        );
      }
      return (
        <div>
          { renderedSymbolHits }
        </div>
      );
    };

    return (
      <div>
        <div className="rawResults__hitDict">
          <HitDict
            grokCtx={ grokCtx }
            sessionThing={ sessionThing }
            hitDict={ rawResults }
            contentFactory={ contentFactory }
            />
        </div>
      </div>
    );
  }
}
