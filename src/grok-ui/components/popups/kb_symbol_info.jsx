import React from 'react';

import { Header, List, Tab } from 'semantic-ui-react';

import DirtyingComponent from '../dirtying_component.js';

import SymSource from '../kb_details/sym_source.jsx';

/**
 * Derived from `kb_details/kb_symbol.jsx`.  There's an asymmetry there where
 * this widget roughly corresponds to `sheets/kb_symbol_view.jsx`, which is
 * just a wrapper around the former.  The rationale there is that sheets are
 * supposed to be glue layers to the session infrastructure around somewhat
 * generic widgets.  We, however, are a popup that has a very specific purpose
 * and nowhere near the same screen real-estate budget, so we get to be a
 * specific widget.  That said, ideally we can reuse some simpler widgets.
 */
export default class KBSymbolInfo extends DirtyingComponent {
  constructor(props) {
    super(props, 'symInfo');
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
      menuItem: 'Overview',
      render: () => {
        return (
          <Tab.Pane>
            Type: { symInfo.type }
          </Tab.Pane>
        );
      }
    });
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
      <React.Fragment>
        <Header as='h3'>{ symInfo.prettiestName }</Header>
        <Tab
          menu={{ attached: true }}
          menuPosition='left'
          panes={ panes }
          />
      </React.Fragment>
    );
  }
}
