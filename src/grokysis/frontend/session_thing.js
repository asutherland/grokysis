/**
 * SessionThings are individual atoms of tracked session state that usually
 * correspond to Notebook Sheets.  A SessionThing updates its state by replacing
 * its prior state.  Anything more complicated than that, such as orthogonal
 * key/value storage, needs to be persisted using a different mechanism.
 */
export default class SessionThing {
  constructor(manager) {
    this.manager = manager;
  }

  /**
   *
   * @param position
   * @param type
   * @param persisted
   *   The SessionThing persisted representation of the thing we're adding.
   *   There's obviously some rep exposure here.
   */
  addSheet() {

  }

  updatePersistedState(newState) {

  }
}