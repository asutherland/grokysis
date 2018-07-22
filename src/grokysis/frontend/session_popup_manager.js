import EE from 'eventemitter3';

/**
 * Simple state-tracking dirty-exposing binding to live on the SessionManager so
 * that a DirtyingComponent can consume it.
 */
export default class SessionPopupManager extends EE {
  constructor(manager) {
    super();

    this.manager = manager;
    this.serial = 0;

    /**
     * null when there is no popup to display, and object dictionary with
     * { type, binding, payload } when a popup is to be displayed.
     */
    this.popupInfo = null;
  }

  showPopup(sessionThing, type, payload, context) {
    const binding = this.manager.popupBindings[type];
    if (!binding) {
      throw new Error('no such binding: ' + type);
    }

    this.popupInfo = {
      type,
      binding,
      payload,
      context,
      sessionThing
    };
    this.serial++;
    this.emit('dirty');
  }

  /**
   * Update our state when the popup is closed.
   */
  popupClosed(wasPopupInfo) {
    if (wasPopupInfo && wasPopupInfo === this.popupInfo) {
      this.popupInfo = null;
      this.serial++;
      this.emit('dirty');
    }
  }
}
