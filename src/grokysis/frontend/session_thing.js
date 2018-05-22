/**
 * SessionThings are individual atoms of tracked session state that usually
 * correspond to Notebook Sheets.  A SessionThing updates its state by replacing
 * its prior state.  Anything more complicated than that, such as orthogonal
 * key/value storage, needs to be persisted using a different mechanism.
 *
 * Things can interact with other sheets via:
 * - Adding other sheets to the same track via `addThing`.
 * - Sending messages to other sheets.  A sheet that wants to process messages
 *   sent from other sheets invokes SessionThing.handleSlotMessages(name, cb)
 *   to report that it should handle calls to sendMessageToSlot(name, payload)
 *   made by other sheets.
 */
export default class SessionThing {
  constructor(track, id, type, bindingDef, persisted) {
    this.id = id;
    this.track = track;
    this.type = type;
    this.bindingFactory = bindingDef;
    this.persisted = persisted;

    this.grokCtx = this.track.manager.grokCtx;
  }

  /**
   * Add another thing in the current track.  Use
   *
   * @param {Object} o
   * @param {'before'|'after'} o.position
   *    Where to place the sheet in relation to the triggering sheet.
   * @param {String} o.type
   * @param {Object} o.persisted
   *   The SessionThing persisted representation of the thing we're adding.
   *   There's obviously some rep exposure here.
   */
  addThing(o) {
    return this.track.addThing(this, null, o);
  }

  /**
   * Declare that we handle the slot messages for a given name.  In the event
   * multiple sheets call this method, the most recent caller wins, so this
   * should be called on focus.  If evicted, the callback will be invoked with
   * null instead of a message payload.
   *
   * `stopHandlingSlotMessage` allows for removing oneself.
   */
  handleSlotMessage(slotName, callback) {
    this.track.manager.handleSlotMessage(this, slotName, callback);
  }

  stopHandlingSlotMessage(slotName) {
    this.track.manager.stopHandlingSlotMessage(this, slotName);
  }

  /**
   * Send an updated state representation to the database to be persisted so
   * that this thing can be restored if the page is closed and later reloaded.
   *
   * Currently returns a promise that will be resolved when the change has hit
   * disk, but will likely convert to a void return unless callers demonstrate
   * a desire to do their own handling of this for some reason.
   */
  updatePersistedState(newState) {
    this.persisted = newState;
    return this.track.updatePersistedState(this, newState);
  }

  removeSelf() {
    this.track.removeThing(this);
  }
}
