import React from 'react';
import ReactDOM from 'react-dom';

import {
  ReflexContainer,
  ReflexSplitter,
  ReflexElement
} from 'react-reflex';

import SessionNotebookContainer from './components/session_notebook/session_notebook_container.jsx';

import SearchFieldSheet from './components/sheets/search_field.jsx';
import SearchResultsSheet from './components/sheets/search_results.jsx';

import TriceDetailSheet from './components/sheets/trice_detail.jsx';
import TriceFilterSheet from './components/sheets/trice_filter.jsx';
import TriceLoaderSheet from './components/sheets/trice_loader.jsx';
import TriceTimelineSheet from './components/sheets/trice_timeline.jsx';

import GrokAnalysisFrontend from '../grokysis/frontend.js';

import 'semantic-ui-css/semantic.min.css';
import 'react-reflex/styles.css';

import './grok-ui.css';

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

    const grokCtx = new GrokAnalysisFrontend({
      // For now, there's just a single session.
      session: {
        name: 'main',
        tracks: ['exploration', 'analysis'],
        defaults: {
          exploration: [
            {
              type: 'searchField',
              persisted: {
                initialValue: ''
              }
            }
          ],
          analysis: [
            {
              type: 'triceLoader',
              persisted: {
                initialValue: ''
              }
            },
            {
              type: 'diagram',
              persisted: {}
            }
          ]
        },

        bindings: {
          // ## Searchfox Search Related
          searchField: ({ initialValue }) => {
            return {
              labelWidget: 'Searchfox Search',
              contentPromise: null,
              contentFactory: (props, data) => {
                return (
                  <SearchFieldSheet {...props}
                    initialValue={ initialValue }
                    />
                );
              }
            }
          },

          searchResult: ({ searchText }, grokCtx) => {
            // Trigger a search, this returns a promise.
            const pendingResults = grokCtx.performSearch(searchText);

            return {
              labelWidget: <span>Search Results: <i>{searchText}</i></span>,
              // This will make the sheet display a loading indication until the
              // search completes.
              contentPromise: pendingResults,
              // Once the search completes, the contentFactory will be invoked
              // with the notebook sheet props plus the resolved content
              // promise.
              contentFactory: (props, searchResults) => {
                return (
                  <SearchResultsSheet {...props}
                    searchResults={ searchResults }
                    />
                );
              }
            };
          },

          // ## Diagramming from Searchfox Exploration
          diagram: (persisted, grokCtx) => {
            return {
              labelWidget: 'Diagram',
              awaitContent: null,
              contentFactory: (props) => {
                return <div>Not yet implemented.</div>;
              }
            };
          },

          // ## Trice Log Visualization
          triceLoader: ({ initialValue }) => {
            return {
              labelWidget: 'Load Trice Log',
              contentPromise: null,
              contentFactory: (props, data) => {
                return (
                  <TriceLoaderSheet {...props}
                    />
                );
              }
            }
          },

          triceTimeline: (persisted) => {
            const pendingTriceLog = grokCtx.loadTriceLog(persisted);

            return {
              labelWidget: <span>Trice Log: <i>{ persisted.url }</i></span>,
              contentPromise: pendingTriceLog,
              contentFactory: (props, triceLog) => {
                return (
                  <TriceTimelineSheet {...props}
                    triceLog={ triceLog }
                    />
                );
              }
            };
          },

          triceDetail: () => {
            return {
              labelWidget: 'Trice Event Detail',
              contentPromise: null,
              contentFactory: (props) => {
                return (
                  <TriceDetailSheet {...props} />
                );
              }
            };
          },

          triceFilter: () => {
            return {
              labelWidget: 'Trice Filter',
              contentPromise: null,
              contentFactory: (props) => {
                return (
                  <TriceFilterSheet {...props} />
                );
              }
            };
          }
        }
      }
    });

    this.state = {
      grokCtx
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
          <SessionNotebookContainer
            grokCtx={ this.state.grokCtx }
            trackName="exploration"
            />
        </ReflexElement>
        <ReflexSplitter />
        <ReflexElement className="right-pane"
          minSize="200" maxSize="1200">
          <SessionNotebookContainer
            grokCtx={ this.state.grokCtx }
            trackName="analysis"
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
