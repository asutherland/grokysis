import React from 'react';

import DirtyingComponent from '../dirtying_component.js';

import NotebookSheet from './notebook_sheet.jsx';

import './session_notebook_container.css';

/**
 * Wraps a NotebookContainer into the GrokContext space and its SessionManager
 * abstraction.
 *
 * Expected props:
 * - grokCtx
 * - trackName
 */
export default class SessionNotebookContainer extends DirtyingComponent {
  constructor(props) {
    // the notebook is characterized by the track.  The function is only invoked
    // after the constructor completes, so it's okay to access our convenience
    // variable initialized below.
    super(props, function () { return this.track });

    this.passProps = {
      grokCtx: this.props.grokCtx
    };

    this.sessionManager = this.props.grokCtx.sessionManager;
    this.track = this.sessionManager.tracks[this.props.trackName];

    this.thingToWidget = new Map();
  }

  render() {
    const wrappedThings = this.track.things.map((thing) => {
      let widget = this.thingToWidget.get(thing);
      if (widget) {
        return widget;
      }

      widget = (
        <NotebookSheet
          { ...this.props.passProps }
          key={ thing.id }
          sessionThing={ thing }
          />
      );

      this.thingToWidget.set(thing, widget);

      return widget;
    });

    return (
      <div className="notebookContainer">
      { wrappedThings }
      </div>
    );
  }
}
