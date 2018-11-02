import React from 'react';

import { List, Tab } from 'semantic-ui-react';

import FileSource from './file_source.jsx';
import DirtyingComponent from '../dirtying_component.js';


export default class KBFile extends DirtyingComponent {
  constructor(props) {
    super(props, 'kbFile');
  }

  onSymbolClicked(evt, symInfo) {
    this.props.sessionThing.showPopup(
      'symbolInfo',
      // we express ourselves as the from so that this can be used to create
      // a graph edge.
      { symInfo, fromSymInfo: null },
      // the popup wants to be relative to the clicked symbol.
      evt.target);
  }

  render() {
    const finfo = this.props.kbFile;

    const panes = [];

    panes.push({
      menuItem: 'Symbols',
      render: () => {
        const symItems = [];
        for (const symInfo of finfo.fileSymbolDefs) {
          symItems.push(
            <List.Item
              key={ symInfo.rawName }
              onClick={ (evt) => { this.onSymbolClicked(evt, symInfo); } }
              >
              { symInfo.prettiestName }
            </List.Item>
          );
        }

        return (
          <Tab.Pane>
            <List bulleted>
              { symItems }
            </List>
          </Tab.Pane>
        );
      }
    });

    let maybeSource;
    if (finfo.sourceFragment) {
      maybeSource = (
        <FileSource
          fileInfo={ finfo }
          sessionThing={ this.props.sessionThing }
          />
      );
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

    return (
      <Tab
        menu={{ attached: 'top' }}
        panes={ panes }
        />
    );
  }
}
