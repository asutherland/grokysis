import React from 'react';

import { Button, List, Tab } from 'semantic-ui-react';

import DirtyingComponent from '../dirtying_component.js';

import SymSource from './sym_source.jsx';

export default class KBSymbol extends DirtyingComponent {
  constructor(props) {
    super(props, 'symInfo');
  }

  onShowSymbolSheet(evt, symInfo) {
    this.props.sessionThing.addThingInOtherTrack({
      type: 'symbolView',
      persisted: { rawSymbol: symInfo.rawName },
    });
  }

  onAddContextEdge(evt, from, to) {
    evt.stopPropagation();
    evt.preventDefault();

    const thing = this.props.sessionThing;
    thing.sendSlotMessage('diagram', 'addEdge', { from, to });
  }

  onNavigateInto(evt, to) {
    evt.stopPropagation();
    evt.preventDefault();

    this.props.doNavigateIntoSym(to);
  }

  render() {
    const symInfo = this.props.symInfo;

    const panes = [];

    // XXX since we no longer extract data from scraping the HTML, we no longer
    // actually have the source currently.
    let maybeSource;
    if (symInfo.sourceFragment) {
      maybeSource = (
        <SymSource
          symInfo={ symInfo }
          sessionThing={ this.props.sessionThing }
          />
      );
    }

    panes.push({
      menuItem: 'Info',
      render: () => {
        return (
          <Tab.Pane>
            <div>{ symInfo.syntaxKind }</div>
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
              >
              <Button.Group size='mini' compact={true} >
                <Button icon='pencil'
                  onClick={ (evt) => { this.onAddContextEdge(evt, symInfo, callSym); }}/>
                <Button icon='eye'
                  onClick={ (evt) => { this.onNavigateInto(evt, callSym); }}/>
                <Button icon='sticky note outline'
                  onClick={ (evt) => { this.onShowSymbolSheet(evt, callSym); }}/>
              </Button.Group>
              &nbsp;{ callSym.prettiestName }
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
    panes.push({
      menuItem: 'Callers',
      render: () => {
        const symItems = [];
        for (const callSym of symInfo.receivesCallsFrom) {
          symItems.push(
            <List.Item
              key={ callSym.rawName }
              >
              <Button.Group size='mini' compact={ true } >
                <Button icon='pencil'
                  onClick={ (evt) => { this.onAddContextEdge(evt, callSym, symInfo); }}/>
                <Button icon='eye'
                  onClick={ (evt) => { this.onNavigateInto(evt, callSym); }}/>
                <Button icon='sticky note outline'
                  onClick={ (evt) => { this.onShowSymbolSheet(evt, callSym); }}/>
              </Button.Group>
              &nbsp;{ callSym.prettiestName }
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
