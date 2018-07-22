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
    super(props, function () { return this.track; });

    this.passProps = {
      grokCtx: this.props.grokCtx
    };

    this.sessionManager = this.props.grokCtx.sessionManager;
    this.track = this.sessionManager.tracks[this.props.trackName];

    // inductive binding cache of widgets; every time render() is called, a new
    // map is populated that carries over reused and new bindings, letting
    // no-longer-relevant widgets be discarded.
    this.thingToWidget = new Map();
  }

  render() {
    const lastThingToWidget = this.thingToWidget;
    const nextThingToWidget = new Map();
    const wrappedThings = this.track.things.map((thing) => {
      let widget = lastThingToWidget.get(thing);
      if (widget) {
        nextThingToWidget.set(thing, widget);
        return widget;
      }

      widget = (
        <NotebookSheet
          { ...this.props.passProps }
          key={ thing.id }
          sessionThing={ thing }
          />
      );

      nextThingToWidget.set(thing, widget);

      return widget;
    });

    this.thingToWidget = nextThingToWidget;

    return (
      <div className="notebookContainer">
      { wrappedThings }
      </div>
    );
  }
}
