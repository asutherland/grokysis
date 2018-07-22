import React from 'react';

import DirtyingComponent from '../dirtying_component.js';

import { Popup } from 'semantic-ui-react';

import './session_popup_container.css';

/**
 * Wraps a Semantic-UI Popup, displaying it when the SessionManager indicates
 * a popup should be displayed, and populating it with the desired popup type.
 */
export default class SessionPopupContainer extends DirtyingComponent {
  constructor(props) {
    // the notebook is characterized by the track.  The function is only invoked
    // after the constructor completes, so it's okay to access our convenience
    // variable initialized below.
    super(
      props,
      function () { return this.props.grokCtx.sessionManager.popupManager; });

    this.sessionManager = this.props.grokCtx.sessionManager;
    this.popupManager = this.sessionManager.popupManager;

    this.lastPopupInfo = null;
    this.lastWidgetInfo = null;
  }

  render() {
    const popupManager = this.popupManager;
    const popupInfo = popupManager.popupInfo;
    const isOpen = popupInfo !== null;

    let widgetInfo;
    let context = null;
    if (isOpen) {
      if (this.lastPopupInfo === popupInfo) {
        widgetInfo = this.lastWidgetInfo;
      } else {
        widgetInfo = this.lastWidgetInfo =
          popupInfo.binding.factory(
            popupInfo.payload, this.props.grokCtx, popupInfo.sessionThing);
      }
      this.lastPopupInfo = popupInfo;
      context = popupInfo.context;
      console.log("showing popup", widgetInfo, popupInfo, "context:", context);
    } else {
      this.lastPopupInfo = null;
      this.lastWidgetInfo = null;
      widgetInfo = { popupProps: {}, contents: null };
    }

    return (
      <Popup {...widgetInfo.popupProps}
        open={ isOpen }
        context={ context }
        onClose={ () => { popupManager.popupClosed(popupInfo); } }
        >
        <Popup.Content>
          { widgetInfo.contents }
        </Popup.Content>
      </Popup>
    );
  }
}
