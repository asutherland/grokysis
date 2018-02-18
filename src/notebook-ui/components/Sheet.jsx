import React from 'react';

/**
 * NotebookSheets live inside a NotebookContainer.  They wrap the provided
 * content widget in a consistent UI container that provides for labeling and
 * collapsing.  In the future sheets might provide other fancy features like
 * re-ordering and persistence.
 *
 * Expected props:
 * - label: Always visible widget that, when clicked on, toggles the
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

    this._init(props.contentPromise);
  }

  async _init(contentPromise) {
    const contentData = await contentPromise;

    const renderedContent = this.props.contentFactory(this.props, contentData);
    this.setState({ renderedContent });
  }

  render() {
    let labelClass = "notebook-label";
    if (this.state.collapsed) {
      labelClass += " notebook-label-collapsed";
    } else {
      labelClass += " notebook-label-expanded";
    }

    let content = null;
    if (!this.state.collapsed) {
      content = (
        <div className="notebook-sheet-content">
          { this.props.contentWidget }
        </div>
      );
    }

    return (
      <div className="notebook-sheet">
        <div className={labelClass}>
          { this.props.labelWidget }
        </div>
        { this.state.renderedContent }
      </div>
    );
  }
};