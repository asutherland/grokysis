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
  constructor(track, id, type, binding, persisted, sessionMeta) {
    this.id = id;
    this.track = track;
    this.type = type;
    this.binding = binding;
    this.persisted = persisted;
    this.sessionMeta = sessionMeta;

    this.grokCtx = this.track.manager.grokCtx;
  }

  /**
   * Add another thing in the current track.
   *
   * @param {Object} o
   * @param {'before'|'after'|'end'} o.position
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
   * Add a thing in the track paired with the current track.
   */
  addThingInOtherTrack(o) {
    const friendTrack = this.track.manager.getTrackCounterpart(this.track);
    return friendTrack.addThing(null, null, o);
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
   * Send a message to the SessionThing whose binding was declared with a
   * `slotName` matching the provided `thingSlot` here, instantiating the
   * binding if there was not a binding instantiated at this time.  Note that
   * the messages themselves will be asynchronously enqueued until the widget
   * itself is mounted to the DOM and invokes handleSlotMessage.
   */
  sendSlotMessage(thingSlot, slotName, payload) {
    return this.track.manager.sendSlotMessage(
      this, thingSlot, slotName, payload);
  }

  /**
   * Register this SessionThing to process broadcast messages for the given
   * namespace and message type.  The broadcast mechanism differs from the slot
   * mechanism in that 1) there can be multiple recipients of a broadcast,
   * 2) broadcasts will not cause a binding to be instantiated to receive the
   * message, and 3) messages will accordingly not be enqueued.
   */
  handleBroadcastMessage(namespace, type, callback) {
    return this.track.manager.handleBroadcastMessage(
      this, namespace, type, callback);
  }

  stopHandlingBroadcastMessage(namespace, type) {
    return this.track.manager.stopHandlingBroadcastMessage(
      this, namespace, type);
  }

  /**
   * Synchronously send a broadcast message to all registered handlers at this
   * instant.
   */
  broadcastMessage(namespace, type, payload) {
    return this.track.manager.broadcastMessage(this, namespace, type, payload);
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
    return this.track.updatePersistedState(this, newState, this.sessionMeta);
  }

  /**
   * sessionMeta gets updated in-place, so just trigger a persisted update with
   * the current persisted state so the sessionMeta goes along for the ride.
   */
  storeUpdatedSessionMeta() {
    return this.updatePersistedState(this.persisted);
  }

  /**
   * Trigger display of a popup of `type` consuming `payload` describing what
   * should be displayed, and targeting the given `context` node.
   */
  showPopup(type, payload, context) {
    return this.track.manager.popupManager.showPopup(
      this, type, payload, context);
  }

  removeSelf() {
    this.track.removeThing(this);
  }
}
