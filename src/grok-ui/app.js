import React from 'react';
import ReactDOM from 'react-dom';

import {
  ReflexContainer,
  ReflexSplitter,
  ReflexElement
} from 'react-reflex';

import SessionNotebookContainer from
  './components/session_notebook/session_notebook_container.jsx';
import SessionPopupContainer from
  './components/session_notebook/session_popup_container.jsx';

import KBSymbolInfoPopup from './components/popups/kb_symbol_info.jsx';

import CrashLoaderSheet from './components/sheets/crash_loader.jsx';
import CrashDetailsSheet from './components/sheets/crash_details.jsx';
import CrashSignatureSheet from './components/sheets/crash_signature.jsx';

import DiagramSheet from './components/sheets/diagram.jsx';

import KBFileViewSheet from './components/sheets/kb_file_view.jsx';
import KBSymbolViewSheet from './components/sheets/kb_symbol_view.jsx';

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
  constructor(appProps) {
    super(appProps);

    const outerGrokCtx = window.grokCtx = new GrokAnalysisFrontend({
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
              type: 'fileView',
              persisted: {}
            },
            {
              type: 'diagram',
              persisted: {}
            }
          ]
        },

        popupBindings: {
          symbolInfo: {
            factory: ({ symInfo, fromSymInfo }, grokCtx, sessionThing) => {
              return {
                popupProps: {},
                contents: (
                  <KBSymbolInfoPopup
                    grokCtx={ grokCtx }
                    symInfo={ symInfo }
                    fromSymInfo={ fromSymInfo }
                    sessionThing={ sessionThing }
                    />
                )
              };
            }
          }
        },

        sheetBindings: {
          // ## Searchfox Search Related
          searchField: {
            spawnable: 'Raw Searchfox Search',
            factory: ({ initialValue }) => {
              return {
                labelWidget: 'Searchfox Search',
                contentPromise: null,
                contentFactory: (props/*, data*/) => {
                  return (
                    <SearchFieldSheet {...props}
                      initialValue={ initialValue }
                      />
                  );
                }
              };
            },
          },

          searchResult: {
            factory: ({ searchText }, grokCtx) => {
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
          },

          // ## grokysis analysis related
          fileView: {
            factory: (persisted, grokCtx) => {
              // we're no longer quite as evilly hardcoded!
              const path = persisted.path ||
                'dom/serviceworkers/ServiceWorkerRegistrar.cpp';
              const pendingFile = grokCtx.kb.ensureFileAnalysis(path);

              return {
                labelWidget: `File Info: ${path}`,
                contentPromise: pendingFile,
                contentFactory: (props, resultFile) => {
                  return (
                    <KBFileViewSheet {...props}
                      kbFile={ resultFile }
                      />
                  );
                }
              };
            },
          },

          symbolView: {
            factory: (persisted, grokCtx) => {
              const symInfo = grokCtx.kb.lookupRawSymbol(persisted.rawSymbol);

              return {
                labelWidget: `Symbol: ${ symInfo.rawName }`,
                contentPromise: null,
                contentFactory: (props) => {
                  return (
                    <KBSymbolViewSheet {...props}
                      symInfo={ symInfo }
                      />
                  );
                }
              };
            },
          },

          // ## Diagramming from Searchfox Exploration
          diagram: {
            slotName: 'diagram',
            spawnable: 'Diagram',
            factory: (persisted, grokCtx) => {
              const diagram = grokCtx.kb.restoreDiagram(
                persisted.serialized || null);
              return {
                labelWidget: 'Diagram',
                awaitContent: null,
                contentFactory: (props) => {
                  return (
                    <DiagramSheet {...props}
                      diagram={ diagram }
                      />
                  );
                }
              };
            },
          },

          // ## Crash-Stats related stuff
          crashLoader: {
            spawnable: 'Crash loader',
            factory: () => {
              return {
                labelWidget: 'Load crash',
                contentPromise: null,
                contentFactory: (props) => {
                  return (
                    <CrashLoaderSheet {...props}
                      />
                  );
                }
              };
            }
          },

          crashDetails: {
            factory: (persisted, grokCtx) => {
              const pendingCrash = grokCtx.loadCrashID(persisted);

              return {
                labelWidget: <span>Crash Details: <i>{ persisted.crashId }</i></span>,
                contentPromise: pendingCrash,
                contentFactory: (props, triceLog) => {
                  return (
                    <TriceTimelineSheet {...props}
                      triceLog={ triceLog }
                      />
                  );
                }
              };
            },
          },

          crashSignature: {
            factory: (persisted, grokCtx) => {
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
          },

          // ## Trice Log Visualization
          triceLoader: {
            spawnable: 'TriceLog loader',
            factory: () => {
              return {
                labelWidget: 'Load Trice Log',
                contentPromise: null,
                contentFactory: (props/*, data*/) => {
                  return (
                    <TriceLoaderSheet {...props}
                      />
                  );
                }
              };
            },
          },

          triceTimeline: {
            slotName: 'triceLog:vis',
            factory: (persisted, grokCtx) => {
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
          },

          triceDetail: {
            slotName: 'triceLog:detail',
            factory: () => {
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
          },

          triceFilter: {
            slotName: 'triceLog:filters',
            factory: () => {
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
      }
    });

    this.state = {
      grokCtx: outerGrokCtx
    };
  }

  render() {
    return (
      <div className="grok-ui-wrapper">
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
        <SessionPopupContainer
          className="grok-ui-popup-root"
          grokCtx={ this.state.grokCtx }
          />
      </div>
    );
  }
}

const contentNode = document.createElement('div');
contentNode.className = 'grok-ui-root';
document.body.appendChild(contentNode);
ReactDOM.render(<GrokApp />, contentNode);
