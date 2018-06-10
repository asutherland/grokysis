import React from 'react';

import './sym_source.css';

/**
 * Given a `hitDict` which consists of a number of keys like "defs"/"uses"/etc.
 * and associated values, present a tab-like interface to switch between them.
 * Props are:
 * - hitDict: Contains the keys/values
 * - contentFactory: Function(values, key) to produce the appropriate tree for
 *   the given tab.  The idea is this makes this widget somewhat reusable, at
 *   least while it's in flux.
 */
export default class SymSource extends React.PureComponent {
  constructor(props) {
    super(props);

    this.codeRef = React.createRef();
  }

  componentDidMount() {
    if (this.codeRef.current) {
      const symInfo = this.props.symInfo;
      if (symInfo.sourceFragment) {
        this.codeRef.current.appendChild(symInfo.sourceFragment.cloneNode(true));
        console.log('rendered code!!!');
      }
    } else {
      console.log('there was no codeRef?!!!');
    }
  }

  render() {
    return (
      <pre className="SymSource__container" ref={ this.codeRef }></pre>
    );
  }
}
