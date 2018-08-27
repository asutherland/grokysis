import React from 'react';

import { Dropdown, Menu } from 'semantic-ui-react';

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

    // Inductive binding cache of widgets; every time render() is called, a new
    // map is populated that carries over reused and new bindings, letting
    // no-longer-relevant widgets be discarded.
    //
    // We now also track the serial so that we can generate a new tupled sheet
    // thing.
    this.thingToWidgetAndSerial = new Map();
  }

  render() {
    // ## Top menu dynamic choices
    const addDropdownItems = this.sessionManager.userSpawnables.map(
      ({ type, binding }) => {
        const spawnIt = () => {
          this.track.addThing(
            null, null,
            {
              position: 'start',
              type,
              persisted: {}
            });
        };
        return (
          <Dropdown.Item onClick={ spawnIt } key={binding.spawnable}>
            { binding.spawnable }
          </Dropdown.Item>
        );
      });

    // ## Make the noteboot sheets
    // (See thingToWidgetAndSerial for how the cache works)
    const lastThingToWidgetAndSerial = this.thingToWidgetAndSerial;
    const nextThingToWidgetAndSerial = new Map();
    const wrappedThings = this.track.things.map((thing) => {
      let [widget, serial] = lastThingToWidgetAndSerial.get(thing) || [null, 0];
      if (widget && serial === thing.serial) {
        nextThingToWidgetAndSerial.set(thing, [widget, serial]);
        return widget;
      }

      widget = (
        <NotebookSheet
          { ...this.props.passProps }
          key={ thing.id }
          sessionThing={ thing }
          thingSerial={ thing.serial }
          />
      );

      nextThingToWidgetAndSerial.set(thing, [widget, thing.serial]);

      return widget;
    });

    this.thingToWidgetAndSerial = nextThingToWidgetAndSerial;

    return (
      <div className="notebookContainer">
        <Menu>
          <Menu.Menu position='right'>
            <Dropdown item text='Add...'>
              <Dropdown.Menu>
                { addDropdownItems }
              </Dropdown.Menu>
            </Dropdown>
          </Menu.Menu>
        </Menu>
        { wrappedThings }
      </div>
    );
  }
}
