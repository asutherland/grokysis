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
    this.props.sessionThing.addThingInOtherTrack({
      type: 'symbolView',
      persisted: {
        rawSymbol: this.props.rawSymInfo.symbol,
        pretty: this.props.rawSymInfo.pretty,
      },
    });
  }

  render() {
    const { pretty, meta, hits } = this.props.rawSymInfo;

    const kindContentFactory = (pathHits, selected) => {
      // We propagate selected as 'group' for keying purposes so accordion
      // state doesn't contaminate when switching between groups.
      return <PathHitList group={ selected } pathHits={ pathHits || [] } />;
    };

    const pathkindContentFactory = (kindDict) => {
      return (
        <HitDict
          hitDict={ kindDict }
          contentFactory={ kindContentFactory }
          menu={{ attached: 'top' }}
          />
      );
    };

    let hasDefs = false;
    for (const kindHits of Object.values(hits)) {
      if ('defs' in kindHits) {
        hasDefs = true;
      }
    }

    // Upsell if we have a def.  We won't resolve until clicked on.
    let maybeUpsellSymbolInfo;
    if (hasDefs) {
      maybeUpsellSymbolInfo = (
        <React.Fragment>
          &nbsp;
          <Button
            icon='sticky note outline' size='mini'
            onClick={ (evt) => { this.onShowSymbolSheet(evt); }}/>
        </React.Fragment>
      );
    }

    let maybeSyntaxKind = '';
    if (meta.syntax) {
      maybeSyntaxKind = ` (${meta.syntax})`;
    }

    return (
      <Card fluid>
        <Card.Content className="symbolHit__hitDict">
          <Card.Header as='h3' className="symbolHit__symbol">
            { pretty }{ maybeSyntaxKind }
            { maybeUpsellSymbolInfo }
          </Card.Header>
        </Card.Content>
        <HitDict
          hitDict={ hits }
          contentFactory={ pathkindContentFactory }
          menu={{ attached: 'top' }}
          />
      </Card>
    );
  }
}
