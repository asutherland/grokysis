import EE from 'eventemitter3';

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
 *   grokCtx)` for an argument and returns the object dictionary consumed by
 *   `NotebookContainer.addSheet`.
 *
 */
export default class SessionManager extends EE {
  constructor({ name, tracks, defaults, bindings}) {
    super();

    this.name = name;
    this.tracks = tracks;
    this.defaults = defaults;
    this.bindings = bindings;

    /**
     * Maps from track names to the list of currently live SessionThing
     * instances in that track.
     */
    this.thingListsByTrack = new Map();
    for (const trackName of this.tracks) {
      this.thingListsByTrack.set(trackName, []);
    }
  }

  /**
   * Data provided to us from the back-end at some point after our construction
   * and the hookup of listeners.
   */
  consumeSessionData(sessionThings) {
    // ## Use defaults if we had no persisted state
    if (!sessionThings) {

      return;
    }

    // ## Use persisted state
  }

  /**
   * Move the given SessionThing up or down in its track and updated persisted
   * states so that the change is persistent.
   *
   * Currently ordering from-
   */
  moveThingInTrack(thing, delta) {

  }
}
