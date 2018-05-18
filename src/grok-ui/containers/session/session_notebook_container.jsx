import React from 'react';

import NotebookContainer from '../../../notebook-ui/components/Container.jsx';

/**
 * Wraps a NotebookContainer into the GrokContext space and its SessionManager
 * abstraction.
 *
 * Expected props:
 * - grokCtx
 * - trackName
 */
export default class SessionNotebookContainer extends React.Component {
  constructor(props) {
    super(props);

    this.passProps = {
      grokCtx: this.props.grokCtx
    };

    this._bound_onAdd = this.onAdd.bind(this);

    this.addEventName = `${this.props.trackName}:add`;
  }

  componentDidMount() {
    // TODO: magic up the sessionmanager to replay the current set of things
    // when we invoke this.
    this.grokCtx.sessionManager.on(this.addEventName, this.onAdd, this);
  }

  componentWillUnmount() {
    this.grokCtx.sessionManager.off(this.addEventName, this.onAdd, this);
  }

  onAdd(addInfo) {
    const notebook = this.notebookRef.current;
    notebook.addSheet(null, addInfo);
  }

  render() {
    return (
      <NotebookContainer ref={this.notebookRef}
        passProps={ this.passProps }
        initialSheets={ this.state.initialExplorationSheets }
        />
    );
  }
}
