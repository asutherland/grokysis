import EE from 'eventemitter3';

import SessionThing from './session_thing.js';

/**
 * Holds persisted SessionThings.  In turn held by a SessionManager which holds
 * multiple SessionTracks.  SessionNotebookContainer widgets bind to the track
 * and listen for changes in the list of things (additions/removals), but not
 * mutations of those session things.  Each SessionThing is expected to be
 * bound to by an independently stateful widget.
 */
export default class SessionTrack extends EE {
  constructor(manager, name) {
    super();

    this.manager = manager;
    this.name = name;
    this.things = [];

    this.serial = 0;
  }

  /**
   * Updates all session things' disk representations whenever any of them
   * change.  Currently, their `index` is literally their index in the array.
   * We really only need to update the things after the injected thing, but this
   * way is safer if the index rep is changed in SessionManager.
   */
  _updatePersistedThingsBecauseOfOrderingChange(newThingToIgnore) {
    for (const thing of this.things) {
      // We can skip the thing we just wrote.
      if (thing !== newThingToIgnore) {
        this.updatePersistedState(thing, thing.persisted, thing.sessionMeta);
      }
    }
  }

  addThing(relThing, useId,
           { position, type, persisted, sessionMeta, restored }) {
    if (!useId) {
      // (an id of 0 is never used, so we won't ambiguously end up in here)
      useId = this.manager.allocId();
    }
    if (!sessionMeta) {
      sessionMeta = this.manager.makeDefaultSessionMeta();
    }

    let targetIdx;
    if (relThing === null || position === 'end') {
      targetIdx = this.things.length;
    } else {
      targetIdx = this.things.indexOf(relThing);
      if (targetIdx === -1) {
        targetIdx = this.things.length;
      } else if (position && position === 'after') {
        // otherwise we're placing it before by using the existing sheet's
        // index.
        targetIdx++;
      }
    }

    const orderingChange = targetIdx < this.things.length;

    const binding = this.manager.bindings[type];
    if (typeof(binding) !== 'object') {
      console.warn("binding not a dictionary for type:", type);
      throw new Error("binding wasn't an object");
    }
    if (typeof(binding.factory) !== 'function') {
      console.warn("bindingFactory not a function:", binding.factory,
                   "for type", type);
      throw new Error("binding factory wasn't a function");
    }

    const thing =
      new SessionThing(this, useId, type, binding, persisted, sessionMeta);
    this.things.splice(targetIdx, 0, thing);
    // Write-through to the database if this didn't come from the database.
    if (!restored) {
      this.updatePersistedState(thing, persisted, sessionMeta);
    }

    if (orderingChange) {
      this._updatePersistedThingsBecauseOfOrderingChange();
    }

    this.manager.sessionThingAdded(thing);

    this.serial++;
    this.emit('dirty', this);

    return thing;
  }

  /**
   * Remove the given SessionThing from the track if it's still present.
   */
  removeThing(thing) {
    const idx = this.things.indexOf(thing);
    if (idx !== -1) {
      this.things.splice(idx, 1);
      this.manager.sessionThingRemoved(thing);

      this.serial++;
      this.emit('dirty', this);
    }
  }

  updatePersistedState(thing, newState, sessionMeta) {
    this.manager.updatePersistedState(this, thing, newState, sessionMeta);
  }

  /**
   * When a SessionThing replaces itself:
   * - TODO: We really need/want some history state hookup here.  This implies
   *   the caller having made sure to use the history API or other to snapshot
   *   the state off before replacing it.
   * - Emit dirty so the notebook container can rebuild itself and update the
   *   SessionThing serials so that the NotebookSheet can end up knowing it
   *   needs to re-run itself to restore from the new persisted state.
   */
  sessionThingReplaced() {
    this.serial++;
    this.emit('dirty');
  }
}
