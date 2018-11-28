import React from 'react';

import './file_source.css';

/**
 * Display the source for an entire file (as represented by a FileInfo).
 */
export default class FileSource extends React.PureComponent {
  constructor(props) {
    super(props);

    this.codeRef = React.createRef();

    this.onClick = this.onClick.bind(this);
  }

  componentDidMount() {
    if (this.codeRef.current) {
      const fileInfo = this.props.fileInfo;
      if (fileInfo.sourceFragment) {
        this.codeRef.current.appendChild(fileInfo.sourceFragment.cloneNode(true));
      }
    }
  }

  onClick(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    console.log('got a click on', evt.target);

    const elem = evt.target;
    if ('i' in elem.dataset) {
      const jumpIdx = parseInt(elem.dataset.i, 10);
      const fileInfo = this.props.fileInfo;
      const clickedSymBounds =
        fileInfo.dataIndexToSymbolBounds[jumpIdx];

      // Walk up to get to the line label.
      let walkElem = elem;
      while (walkElem && !walkElem.hasAttribute('aria-labelledby')) {
        walkElem = walkElem.parentElement;
      }
      let containingSymBounds, containingSymInfo;
      // If there's an element it has the attribute
      if (walkElem) {
        // Translate to a zero-based index.
        const lineIdx =
          parseInt(walkElem.getAttribute('aria-labelledby'), 10) - 1;
        containingSymBounds = fileInfo.lineToSymbolBounds[lineIdx];
        containingSymInfo = containingSymBounds.symInfo;
      }

      console.log('resolved click to symbol bounds', clickedSymBounds,
                  'inside containing bounds', containingSymBounds);
      if (clickedSymBounds) {
        const clickedSymInfo = clickedSymBounds.symInfo;
        this.props.sessionThing.showPopup(
          'symbolInfo',
          // we express ourselves as the from so that this can be used to create
          // a graph edge.
          { symInfo: clickedSymInfo, fromSymInfo: containingSymInfo },
          // the popup wants to be relative to the clicked symbol.
          elem);
      }
    }
  }

  render() {
    return (
      <pre className="SymSource__container"
        ref={ this.codeRef }
        onClick={ this.onClick }></pre>
    );
  }
}
