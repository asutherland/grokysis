import React from 'react';
import ReactDOM from 'react-dom';

import {
  ReflexContainer,
  ReflexSplitter,
  ReflexElement
} from 'react-reflex';

import NotebookContainer from '../notebook-ui/components/Container.jsx';

import SearchFieldSheet from './components/sheets/search_field.jsx';

import GrokAnalysisFrontend from '../grokysis/frontend.js';

import 'semantic-ui-css/semantic.min.css';
import 'react-reflex/styles.css';

import './grok-ui.css';
import '../notebook-ui/notebook-ui.css';

/**
 * Two vertical panes with a splitter between them.  The left pane displays the
 * notebook UI for exploration, the right pane displays the notebook UI for
 * created diagrams/state machines/other intentional documentation artifacts.
 * Since I also have portrait monitors, a horizontal pane configuration may
 * eventually show up.
 */
class GrokApp extends React.Component {
  constructor(props) {
    super(props);

    const grokCtx = new GrokAnalysisFrontend('main');

    this.state = {
      grokCtx,
      // XXX The initial sheets objects seem like they'd rather be part of a
      // higher level session management system.  But this suffices for now.
      initialExplorationSheets: [
        {
          labelWidget: 'Searchfox Search',
          awaitContent: null,
          contentFactory: (props) => {
            return <SearchFieldSheet {...props} />;
          }
        }
      ],
      initialArtifactSheets: [
        {
          labelWidget: 'Diagram',
          awaitContent: null,
          contentFactory: (props) => {
            return <div></div>;
          }
        }
      ]
    };
  }

  render() {
    const explorationProps = {
      grokCtx: this.state.grokCtx
    };
    const artifactProps = {
      grokCtx: this.state.grokCtx
    }

    return (
      <ReflexContainer className="grokApp" orientation="vertical">
        <ReflexElement className="left-pane">
          <NotebookContainer
            passProps={ explorationProps }
            initialSheets={ this.state.initialExplorationSheets }
            />
        </ReflexElement>
        <ReflexSplitter />
        <ReflexElement className="right-pane"
          minSize="200" maxSize="800">
          <NotebookContainer
            passProps={ artifactProps }
            initialSheets={ this.state.initialArtifactSheets }
            />
        </ReflexElement>
      </ReflexContainer>
    );
  }
}

const contentNode = document.createElement('div');
contentNode.className = 'grok-ui-root';
document.body.appendChild(contentNode);
ReactDOM.render(<GrokApp />, contentNode);