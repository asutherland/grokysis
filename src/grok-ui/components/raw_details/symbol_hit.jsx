import React from 'react';

import { Card } from 'semantic-ui-react';


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
      // We propagate selected as 'group' for keying purposes so accordion
      // state doesn't contaminate when switching between groups.
      return <PathHitList group={ selected } pathHits={ pathHits || [] } />;
    };

    return (
      <Card fluid>
        <Card.Content className="symbolHit__hitDict">
          <Card.Header as='h3' className="symbolHit__symbol">{ symbolName }</Card.Header>
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
