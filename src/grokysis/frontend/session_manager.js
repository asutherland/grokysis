import EE from 'eventemitter3';

import SessionTrack from './session_track.js';
//import SessionThing from './session_thing.js';
import SessionPopupManager from './session_popup_manager.js';

/**
 * Session management and routing that builds on top of the notebook metaphor.
 *
 * What is what:
 * - The SessionNotebookContainer listens to us but does not know the difference
 *   between restored state and persisted state.
 * - Calls to us are used to open new, persisted, notebook sheets.
 * - These sheets are given SessionThing instances which provide both their
 *   initial state, which may have been restored from disk, as well as APIs
 *   that automatically curry over the SessionThing to provide sheet-local
 *   behavior.
 * - The sheets are stateful.  Their changes to their persisted state are, by
 *   default, simply propagated to the database.  This is not flux where the
 *   changes are requested, unidirectionally made and then they come back
 *   around.
 *   - However, the idea is that as sheets get smarter they can do their own
 *     internal wrapping of the various front-end abstractions which can be
 *     internally unidirectional.  This can then be lofted if a pattern emerges,
 *     and maybe that pattern will be straight-redux or rematch.
 *
 *
 * @param o
 *   Destructured object dictionary of actual args.
 * @param o.name
 *   The session name, which partitions this session from other sessions for
 *   persistence and cross-window coordination.
 * @param {String[]} o.tracks
 *   List of track names.  Each track is a notebook with its own notebook
 *   sheets.  In other words, each is a separately scrollable div which holds
 *   one or more widget bindings.
 * @param o.defaults
 *   An object dictionary where the keys are track names and the values are
 *   arrays of objects of the form { type, persisted } where `type` is the name
 *   of a binding from `bindings` and `persisted` is a representation of its
 *   serialized form to deserialize.  The latter obviously results in a degree
 *   of either coupling or overloading that would not happen in a more flux
 *   like system where action helpers add an abstraction layer.  This likely
 *   should change as things grow and become more complex, but is a little
 *   more straightforward, if breakage-prone, for now.
 * @param o.bindings
 *   Keys are binding names, values are object dictionaries.  They may
 *   optionally include a `slotName` that automatically instantiates a binding
 *   of that type in the other track if one doesn't already exist.  They
 *   must include a `factory` which is a function that takes `(persisted,
 *   grokCtx, sessionThing)` arguments and returns an object dictionary
 *   containing:
 *   - labelWidget:
 *     React payload to display as the sheet's label.  This is passed as-is to
 *     the sheet's render method from the get-go.
 *   - [awaitContent]:
 *      An optional Promise that delays the invocation of the contentFactory
 *      method until the content is available.  The name is chosen to make the
 *      asynchrony super explicit.
 *   - contentFactory:
 *     A function that should take two arguments, props and content.  The
 *     function should return a React payload with the provided props spread
 *     into the component plus whatever else you put in there.  props is
 *     guaranteed to include an `addSheet` bound method that takes these
 *     same arguments (with this and relId already bound).  props is also
 *     guaranteed to include a `removeThisSheet` bound method, primarily
 *     intended for the NotebookSheet to use, although it should also pass it
 *     in to the content.
 *   - [permanent=false]:
 *     If true, the sheet shouldn't be removable.
 *
 */
export default class SessionManager extends EE {
  constructor({ name, tracks, defaults, popupBindings, sheetBindings }, grokCtx,
              persistToDB, deleteFromDB) {
    super();

    this.name = name;
    /** string list of track names */
    this.trackNames = tracks;
    /** object dict keyed by track name and with a list of addSheet args. */
    this.defaults = defaults;
    // see class doc-block
    this.bindings = sheetBindings;
    this.popupBindings = popupBindings;

    this.popupManager = new SessionPopupManager(this);

    this.slotNameToBindingType = new Map();
    for (const [type, binding] of Object.entries(sheetBindings)) {
      if (binding.slotName) {
        this.slotNameToBindingType.set(binding.slotName, type);
      }
    }

    this.grokCtx = grokCtx;
    this._persistToDB = persistToDB;
    this._deleteFromDB = deleteFromDB;

    this.tracks = {};
    this.tracksByIndex = [];
    for (const trackName of this.trackNames) {
      const track = new SessionTrack(this, trackName);
      this.tracks[trackName] = track;
      this.tracksByIndex.push(track);
    }

    /**
     * Map from full slot name to { sessionThing, callback }.  "Full slot name"
     * is a hand-wavey intermediate step to cleaning this all up.  The key idea
     * is that we will automatically instantiate a binding whose binding
     * slotName gets a message sent to it, and then there's a second string that
     * is the actual type of message being sent to the binding.  This path was
     * taken after it got very boilerplate-y to send a message to a binding that
     * might need to be spawned.
     *
     * Currently fullSlotName is the binding's slotName delimited from the
     * second string by '___'.
     */
    this.slotMessageRoutings = new Map();
    /**
     * Map from full slot name to list of payloads.
     */
    this.queuedSlotMessages = new Map();
    /**
     * Map from "thing slot", the slotName on the bindings, to the SessionThing
     * currently alive that occupies that slot.
     */
    this.thingSlotNamesToThing = new Map();

    /**
     * Maps `${namespace}___${type}` to [{ sessionThing, callback }...].
     */
    this.broadcastRoutings = new Map();

    /**
     * Next SessionThing id to use.  We start from this value if there was
     * nothing persisted and we're using defaults.  We start from 1 higher than
     * the highest thing we found in the database if there was something
     * persisted.
     */
    this._nextId = 1;
  }

  allocId() {
    return this._nextId++;
  }

  /**
   * The session meta covers notebook sheet UI like whether something is
   * collapsed or not.  Actually, right now it's exactly that, but there will
   * inevitably be a need to store more, so it gets to be an object instead of
   * a single hard-coded field.
   */
  makeDefaultSessionMeta() {
    return {
      collapsed: false
    };
  }

  /**
   * Return the track that's paired with the provided track object.
   */
  getTrackCounterpart(track) {
    // eh, round-robin for now.
    const idx = this.trackNames.indexOf(track.name);
    const otherIdx = (idx+1) % this.trackNames.length;
    return this.tracks[this.trackNames[otherIdx]];
  }

  /**
   * Data provided to us from the back-end at some point after our construction
   * and the hookup of listeners.
   */
  consumeSessionData(sessionThings) {
    // ## Use defaults if we had no persisted state
    // This can mean either sessionThings was null (new database) or just empty.
    if (!sessionThings || !sessionThings.length) {
      for (const [trackName, toAdd] of Object.entries(this.defaults)) {
        const track = this.tracks[trackName];

        for (const { type, persisted } of toAdd) {
          // We are leaving it up to the track to call makeDefaultSessionMeta.
          track.addThing(null, this.allocId(),
                         { position: 'end', type, persisted });
        }
      }
      return;
    }

    // ## Use persisted state
    // Sort by (numeric) index.  The tracks get interleaved this way, but we do
    // not care as things happen
    sessionThings.sort((a, b) => a.index - b.index);
    for (const { id, trackName, type, persisted, sessionMeta } of sessionThings) {
      const track = this.tracks[trackName];
      if (!track) {
        console.warn('track no longer exists?', trackName, 'dropping!');
        continue;
      }
      this._nextId = Math.max(this._nextId, id + 1);
      track.addThing(null, id,
        { position: 'end', type, persisted, sessionMeta, restored: true });
    }
  }

  sessionThingAdded(addedThing) {
    if (addedThing.binding.slotName) {
      if (this.thingSlotNamesToThing.has(addedThing.binding.slotName)) {
        console.warn('added potentially duplicating slot',
                     addedThing.binding.slotName, addedThing, '- clobbering.');
      }
      this.thingSlotNamesToThing.set(addedThing.binding.slotName, addedThing);
    }
  }

  sessionThingRemoved(removedThing) {
    // ## TODO: some kind of undo handling via history state pushing.

    // ## Remove from persistence so it never comes back again.
    this._deleteFromDB(removedThing.id);

    // ## Remove from slot tracking so it can be re-created as needed.
    if (removedThing.binding.slotName) {
      const existingSlotThing = this.thingSlotNamesToThing.get(
        removedThing.binding.slotName);
      if (existingSlotThing !== removedThing) {
        console.warn('Removing', removedThing, 'which is not the owner of the',
                     removedThing.binding.slotName, 'slot;', existingSlotThing,
                     'is.');
      } else {
        this.thingSlotNamesToThing.delete(removedThing.binding.slotName);
      }
    }

    // ## Remove (full) message slots where this is the current thing.
    // We also expect bindings to invoke stopHandlingSlotMessage, so there's
    // redundant coverage here, likely with us "winning" since explicit removal
    // eventually results in the react binding being removed.
    for (const [slotName, { sessionThing }] of
         this.slotMessageRoutings.entries()) {
      if (sessionThing === removedThing) {
        this.slotMessageRoutings.delete(slotName);
      }
    }

    // ## Remove broadcast routings referencing the thing.
    // Same rationale on redundant but idempotent removal as above.
    for (const [fullName, handlers] of this.broadcastRoutings.entries()) {
      for (let i = 0; i < handlers.length; i++) {
        const handler = handlers[i];
        if (handler.sessionThing === removedThing) {
          handlers.splice(i, 1);
          if (handlers.length === 0) {
            this.broadcastRoutings.delete(fullName);
          }
          // break out of iterating over handlers, but continue looping over the
          // broadcast routings.
          break;
        }
      }
    }
  }

  updatePersistedState(track, thing, persisted, sessionMeta) {
    const diskRep = {
      id: thing.id,
      index: track.things.indexOf(thing),
      trackName: track.name,
      type: thing.type,
      // This holds things controlled by the notebook sheet, like
      // collapsed-ness.
      sessionMeta,
      persisted
    };

    return this._persistToDB(diskRep);
  }

  handleSlotMessage(sessionThing, slotName, callback) {
    const fullSlotName = sessionThing.binding.slotName + '___' + slotName;
    const existing = this.slotMessageRoutings.get(fullSlotName);
    if (existing) {
      if (existing.sessionThing === sessionThing) {
        // This likely constitutes a logic error due to copying and pasting,
        // throw.
        throw new Error('redundant slot message registration');
      } else {
        try {
          existing.callback(null);
        } catch (ex) {
          console.error('evicted slot message callback unhappy', sessionThing,
                        fullSlotName, ex);
        }
      }
    }
    this.slotMessageRoutings.set(fullSlotName, { sessionThing, callback });

    // ## Clear out the backlog soon but not synchronously.
    let backlog = this.queuedSlotMessages.get(fullSlotName);
    if (backlog) {
      this.queuedSlotMessages.delete(fullSlotName);
      Promise.resolve().then(() => {
        for (const payload of backlog) {
          callback(payload);
        }
      });
    }
  }

  stopHandlingSlotMessage(sessionThing, slotName) {
    const fullSlotName = sessionThing.binding.slotName + '___' + slotName;
    const existing = this.slotMessageRoutings.get(fullSlotName);
    if (existing && existing.sessionThing === sessionThing) {
      this.slotMessageRoutings.delete(fullSlotName);
    }
  }

  /**
   * Used by `sendSlotMessage` to spawn the mapped binding for the given slot
   * type (if one is registered).
   */
  _spawnTargetBinding(triggeringThing, thingSlot) {
    const type = this.slotNameToBindingType.get(thingSlot);
    if (!type) {
      console.warn('slot message sent to slotName', thingSlot,
                   'for which there is no binding!');
      return;
    }

    triggeringThing.addThingInOtherTrack({
      // TODO: this should probably find a visible insertion point...
      position: 'end',
      type,
      persisted: {}
    });
  }

  sendSlotMessage(sessionThing, thingSlot, slotName, payload) {
    const fullSlotName = thingSlot + '___' + slotName;
    if (!this.slotMessageRoutings.has(fullSlotName)) {
      let backlog = this.queuedSlotMessages.get(fullSlotName);
      if (!backlog) {
        backlog = [];
        this.queuedSlotMessages.set(fullSlotName, backlog);
      }
      backlog.push(payload);

      // ## Instantiate a binding if one doesn't exist/isn't being created
      const existingTarget = this.thingSlotNamesToThing.get(thingSlot);
      if (!existingTarget) {
        this._spawnTargetBinding(sessionThing, thingSlot);
      }
      return;
    }

    const { callback } = this.slotMessageRoutings.get(fullSlotName);
    callback(payload);
  }

  handleBroadcastMessage(sessionThing, namespace, type, callback) {
    const fullName = namespace + '___' + type;
    let handlers = this.broadcastRoutings.get(fullName);
    if (!handlers) {
      handlers = [];
      this.broadcastRoutings.set(fullName, handlers);
    }
    handlers.push({ sessionThing, callback });
  }

  stopHandlingBroadcastMessage(sessionThing, namespace, type) {
    const fullName = namespace + '___' + type;
    const handlers = this.broadcastRoutings.get(fullName);
    if (!handlers) {
      // (as per the below, this handler may already have been removed)
      return;
    }
    const idx = handlers.find(handler => handler.sessionThing === sessionThing);
    if (idx === -1) {
      // For invariant purposes, we remove the handlers when the sessionThing is
      // removed, so it's possible we already automatically culled this thing.
      return;
    }
    handlers.splice(idx, 1);

    if (handlers.length === 0) {
      this.broadcastRoutings.delete(fullName);
    }
  }

  broadcastMessage(sessionThing, namespace, type, payload) {
    const fullName = namespace + '___' + type;
    const handlers = this.broadcastRoutings.get(fullName);
    if (!handlers) {
      // It's okay for there to be no handlers.  The caller would be using slot
      // messages if they wanted a binding to be brought into existence.
      return;
    }

    for (const { callback } of handlers) {
      try {
        callback(payload);
      } catch(ex) {
        console.warn('exception thrown invoking broadcast handler', namespace,
                     type, ':', ex);
      }
    }
  }
}
