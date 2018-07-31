import React from 'react';

import { List } from 'semantic-ui-react';

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
      <List bulleted>
        { symItems }
      </List>
    );
  }
}
