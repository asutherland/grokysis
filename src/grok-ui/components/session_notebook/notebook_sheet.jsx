import React from 'react';

import { Accordion, Button, Icon } from 'semantic-ui-react';

import './notebook_sheet.css';

/**
 * NotebookSheets live inside a NotebookContainer.  They wrap the provided
 * content widget in a consistent UI container that provides for labeling and
 * collapsing.  In the future sheets might provide other fancy features like
 * re-ordering and persistence.
 *
 * The driving prop is `sessionThing` which is a SessionThing instance.  We
 * expect it to have a bindingDef with
 * - labelWidget: Always visible widget that, when clicked on, toggles the
 *   collapse state of the sheet.
 * - contentPromise
 * - contentFactory: The factory method to be invoked when contentPromise is
 *   resolved.
 * - addSheet
 * - removeThisSheet
 * - permanent
 */
export default class NotebookSheet extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      collapsed: false,
      permanent: false,
      labelWidget: null,
      // For now, use a hard-coded loading string.
      renderedContent: <i>Loading...</i>
    };

    this.onToggleCollapsed = this.onToggleCollapsed.bind(this);
    this.onClose = this.onClose.bind(this);

    this._init();
  }

  async _init() {
    const thing = this.props.sessionThing;
    const grokCtx = thing.grokCtx;

    const { labelWidget, contentPromise, contentFactory, permanent } =
      thing.bindingFactory(thing.persisted, grokCtx, thing);

    // It's okay to set this synchronously *before we go async*.  This is not
    // okay after our first await below.
    this.state.labelWidget = labelWidget;

    let contentData;
    if (contentPromise != null) {
      contentData = await contentPromise;
    }

    const renderedContent = contentFactory(this.props, contentData);
    if (contentPromise != null) {
      // we went async
      this.setState({ permanent: permanent || false, renderedContent });
    } else {
      // we didn't go async, mutate state directly.
      this.state.permanent = permanent || false;
      this.state.renderedContent = renderedContent;
    }
  }

  onClose() {
    this.props.sessionThing.removeSelf();
  }

  onToggleCollapsed() {
    this.setState((prevState) => ({
      collapsed: !prevState.collapsed
    }));
  }

  render() {
    let labelClass = "notebookSheet__label";
    if (this.state.collapsed) {
      labelClass += " notebookSheet__label--collapsed";
    } else {
      labelClass += " notebookSheet__label--expanded";
    }

    let content = null;
    if (!this.state.collapsed) {
      content = (
        <div className="notebookSheet__content" >
          { this.state.renderedContent }
        </div>
      );
    }

    let maybeCloseButton;
    if (!this.state.permanent) {
      maybeCloseButton = (
        <Button
          icon="close" floated="right" size="mini" compact
          onClick={ this.onClose } />
      );
    }

    return (
      <Accordion fluid styled className="notebookSheet">
        <Accordion.Title className={ labelClass }
             index={0}
             active={ !this.state.collapsed }
             onClick={ this.onToggleCollapsed }
             >
          <Icon name="dropdown" />
          { this.state.labelWidget }
          { maybeCloseButton }
        </Accordion.Title>
        <Accordion.Content active={ !this.state.collapsed }>
          { content }
        </Accordion.Content>
      </Accordion>
    );
  }
}
