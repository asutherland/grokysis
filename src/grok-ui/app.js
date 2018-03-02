import React from 'react';
import ReactDOM from 'react-dom';

import NotebookContainer from '../notebook-ui/components/Container.jsx';

import SearchFieldSheet from './components/sheets/search_field.jsx';

import GrokAnalysisFrontend from '../grokysis/frontend.js';

import 'semantic-ui-css/semantic.min.css';

import './grok-ui.css';
import '../notebook-ui/notebook-ui.css';

/**
 * The UI is a
 */
class GrokApp extends React.Component {
  constructor(props) {
    super(props);

    const grokCtx = new GrokAnalysisFrontend('main');

    this.state = {
      grokCtx,
      initialSheets: [
        {
          labelWidget: 'Searchfox Search',
          awaitContent: null,
          contentFactory: (props) => {
            return <SearchFieldSheet {...props} />;
          }
        }
      ]
    };
  }

  render() {
    return (
      <NotebookContainer
        passProps= { { grokCtx: this.state.grokCtx } }
        grokCtx={ this.state.grokCtx }
        initialSheets={ this.state.initialSheets }
        />
    );
  }
}

const contentNode = document.createElement('div');
contentNode.className = 'grok-ui-root';
document.body.appendChild(contentNode);
ReactDOM.render(<GrokApp />, contentNode);