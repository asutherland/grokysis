import React from 'react';

import './sym_source.css';

/**
 * Display the source for a symbol.
 */
export default class SymSource extends React.PureComponent {
  constructor(props) {
    super(props);

    this.codeRef = React.createRef();

    this.onClick = this.onClick.bind(this);
  }

  componentDidMount() {
    if (this.codeRef.current) {
      const symInfo = this.props.symInfo;
      if (symInfo.sourceFragment) {
        this.codeRef.current.appendChild(symInfo.sourceFragment.cloneNode(true));
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
      const symInfo = this.props.symInfo;
      const clickedSymBounds =
        symInfo.sourceFileInfo.dataIndexToSymbolBounds[jumpIdx];

      console.log('resolved click to symbol bounds', clickedSymBounds);
      if (clickedSymBounds) {
        const clickedSymInfo = clickedSymBounds.symInfo;
        this.props.sessionThing.showPopup(
          'symbolInfo',
          // we express ourselves as the from so that this can be used to create
          // a graph edge.
          { symInfo: clickedSymInfo, fromSymInfo: symInfo },
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
