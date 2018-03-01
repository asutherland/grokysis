import React from 'react';

import './Sheet.css';

/**
 * NotebookSheets live inside a NotebookContainer.  They wrap the provided
 * content widget in a consistent UI container that provides for labeling and
 * collapsing.  In the future sheets might provide other fancy features like
 * re-ordering and persistence.
 *
 * Expected props:
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
      // For now, use a hard-coded loading string.
      renderedContent: <i>Loading...</i>
    };

    this.onToggleCollapsed = this.onToggleCollapsed.bind(this);

    this._init(props.contentPromise);
  }

  async _init(contentPromise) {
    const contentData = await contentPromise;

    const renderedContent = this.props.contentFactory(this.props, contentData);
    this.setState({ renderedContent });
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

    return (
      <div className="notebookSheet">
        <div className={ labelClass }
             onClick={ this.onToggleCollapsed }
             >
          { this.props.labelWidget }
        </div>
        { content }
      </div>
    );
  }
};