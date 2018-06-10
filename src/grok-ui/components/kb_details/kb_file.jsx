import React from 'react';

import { List } from 'semantic-ui-react';

import DirtyingComponent from '../dirtying_component.js';


export default class KBFile extends DirtyingComponent {
  constructor(props) {
    super(props, 'kbFile');
  }

  onSymbolClicked(symInfo) {
    this.props.sessionThing.addThingInOtherTrack({
      type: 'symbolView',
      persisted: { rawSymbol: symInfo.rawName },
    });
  }

  render() {
    const finfo = this.props.kbFile;

    const symItems = [];
    for (const symInfo of finfo.fileSymbolDefs) {
      symItems.push(
        <List.Item
          key={ symInfo.rawName }
          onClick={ () => { this.onSymbolClicked(symInfo); } }
          >
          { symInfo.prettyName || symInfo.rawName }
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
