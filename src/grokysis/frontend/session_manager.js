import EE from 'eventemitter3';

import SessionTrack from './session_track';
import SessionThing from './session_thing';

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
 *   Keys are binding names, values are functions that take `(persisted,
 *   grokCtx, sessionThing)` for an argument and returns an object dictionary
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
  constructor({ name, tracks, defaults, bindings }, grokCtx, persistToDB,
                deleteFromDB) {
    super();

    this.name = name;
    /** string list of track names */
    this.trackNames = tracks;
    /** object dict keyed by track name and with a list of addSheet args. */
    this.defaults = defaults;
    /** object dict keyed by binding name and with factory function values. */
    this.bindings = bindings;

    this.grokCtx = grokCtx;
    this._persistToDB = persistToDB;
    this._deleteFromDB = deleteFromDB;

    this.tracks = {};
    for (const trackName of this.trackNames) {
      this.tracks[trackName] = new SessionTrack(this, trackName);
    }

    /**
     * Map from slot name to { sessionThing, callback }.
     */
    this.slotMessageRoutings = new Map();
    /**
     * Map from slot name to list of payloads.
     */
    this.queuedSlotMessages = new Map();

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
    for (const { id, trackName, type, persisted } of sessionThings) {
      const track = this.tracks[trackName];
      if (!track) {
        console.warn('track no longer exists?', trackName, 'dropping!');
        continue;
      }
      this._nextId = Math.max(this._nextId, id + 1);
      track.addThing(null, id,
        { position: 'end', type, persisted, restored: true });
    }
  }

  sessionThingRemoved(removedThing) {
    // ## TODO: some kind of undo handling via history state pushing.

    // ## Remove from persistence so it never comes back again.
    this._deleteFromDB(removedThing.id);

    // ## Remove message slots where this is the current thing.
    for (const [slotName, { sessionThing }] of
         this.slotMessageRoutings.entries()) {
      if (sessionThing === removedThing) {
        this.slotMessageRoutings.delete(slotName);
      }
    }
  }

  updatePersistedState(track, thing, persisted) {
    const diskRep = {
      id: thing.id,
      index: track.things.indexOf(thing),
      trackName: track.name,
      type: thing.type,
      persisted
    }

    return this._persistToDB(diskRep);
  }

  handleSlotMessage(sessionThing, slotName, callback) {
    const existing = this.slotMessageRoutings.get(slotName);
    if (existing) {
      if (existing.sessionThing === sessionThing) {
        return;
      } else {
        try {
          existing.callback(null);
        } catch (ex) {
          console.error('evicted slot message callback unhappy', sessionThing,
                        slotName, ex);
        }
      }
    }
    this.slotMessageRoutings.set(slotName, { sessionThing, callback });

    // ## Clear out the backlog soon but not synchronously.
    let backlog = this.queuedSlotMessages.get(slotName);
    if (backlog) {
      this.queuedSlotMessages.delete(slotName);
      Promise.resolve().then(() => {
        for (const payload of backlog) {
          callback(payload);
        }
      });
    }
  }

  stopHandlingSlotMessage(sessionThing, slotName) {
    const existing = this.slotMessageRoutings.get(slotName);
    if (existing && existing.sessionThing === sessionThing) {
      this.slotMessageRoutings.delete(slotName);
    }
  }

  sendSlotMessage(slotName, payload, queue) {
    if (!this.slotMessageRoutings.has(slotName)) {
      if (queue) {
        let backlog = this.queuedSlotMessages.get(slotName);
        if (!backlog) {
          backlog = [];
          this.queuedSlotMessages.set(slotName, backlog);
        }
        backlog.push(payload);
        return [false, null];
      }

      console.warn('unhandled slot message', slotName, payload);
      return [false, null];
    }

    const { sessionThing, callback } = this.slotMessageRoutings.get(slotName);
    return [true, callback(payload)];
  }
}
