import React from 'react';

import { List, Tab } from 'semantic-ui-react';

import DirtyingComponent from '../dirtying_component.js';

import SymSource from './sym_source.jsx';

export default class KBSymbol extends DirtyingComponent {
  constructor(props) {
    super(props, 'symInfo');
  }

  componentDidMount() {

  }

  onSymbolClicked(symInfo) {
    this.props.sessionThing.addThingInOtherTrack({
      type: 'symbolView',
      persisted: { rawSymbol: symInfo.rawName },
    });
  }

  render() {
    const symInfo = this.props.symInfo;

    const panes = [];

    let maybeSource;
    if (symInfo.sourceFragment) {
      maybeSource = <SymSource symInfo={ symInfo } />;
    }

    panes.push({
      menuItem: 'Source',
      render: () => {
        return (
          <Tab.Pane>
            { maybeSource }
          </Tab.Pane>
        );
      }
    });
    panes.push({
      menuItem: 'Calls',
      render: () => {
        const symItems = [];
        for (const callSym of symInfo.callsOutTo) {
          symItems.push(
            <List.Item
              key={ callSym.rawName }
              onClick={ () => { this.onSymbolClicked(callSym); } }
              >
              { callSym.prettyName || callSym.rawName }
            </List.Item>
          );
        }

        return (
          <Tab.Pane>
            { symItems }
          </Tab.Pane>
        );
      }
    });

    return (
      <Tab
        menu={{ attached: 'top' }}
        panes={ panes }
        />
    );
  }
}