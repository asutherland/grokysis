import React from 'react';

import { Button, Card } from 'semantic-ui-react';


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
  async onShowSymbolSheet() {
    const { symbolName, hitDict } = this.props;

    // At this level we only have a pretty symbol name.  But deeper in the
    // results we
    if ('defs' in hitDict) {
      for (const pathLines of hitDict.defs) {
        for (const lineResult of pathLines.lines) {
          const foundSym =
            await this.props.grokCtx.kb.asyncLookupSymbolAtLocation({
              path: pathLines.path,
              lineNum: lineResult.lno,
              bounds: lineResult.bounds
            });
          if (foundSym) {
            if (foundSym.fullName && symbolName !== foundSym.fullName) {
              console.warn('symbol hit lookup mismatch, have pretty',
                           symbolName, 'but symbol lookup found',
                           foundSym.fullName);
            }
            this.props.sessionThing.addThingInOtherTrack({
              type: 'symbolView',
              persisted: { rawSymbol: foundSym.rawName },
            });
          }
        }
      }
    }
  }

  render() {
    const { symbolName, hitDict } = this.props;

    const contentFactory = (pathHits, selected) => {
      // We propagate selected as 'group' for keying purposes so accordion
      // state doesn't contaminate when switching between groups.
      return <PathHitList group={ selected } pathHits={ pathHits || [] } />;
    };

    // Upsell if we have a def.  We won't resolve until clicked on.
    let maybeUpsellSymbolInfo;
    if ('defs' in hitDict) {
      maybeUpsellSymbolInfo = (
        <React.Fragment>
          &nbsp;
          <Button
            icon='sticky note outline' size='mini'
            onClick={ (evt) => { this.onShowSymbolSheet(evt); }}/>
        </React.Fragment>
      );
    }

    return (
      <Card fluid>
        <Card.Content className="symbolHit__hitDict">
          <Card.Header as='h3' className="symbolHit__symbol">
            { symbolName }
            { maybeUpsellSymbolInfo }
          </Card.Header>
        </Card.Content>
        <HitDict
          hitDict={ hitDict }
          contentFactory={ contentFactory }
          menu={{ attached: 'top' }}
          />
      </Card>
    );
  }
}
