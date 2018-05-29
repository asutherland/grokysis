import React from 'react';

import './line_hit.css';

/**
 * Represents a raw line hit.
 */
export default class LineHit extends React.Component {
  render() {
    const hit = this.props.lineHit;
    return (
      <div className="lineHit">
        <div className="lineHit__lineNo">{ hit.lno }: </div>
        <pre className="lineHit__lineContents">{ hit.peekLines || hit.line }</pre>
        { hit.context ? (<div className="lineHit__lineContext">({hit.context})</div>) : null }
      </div>
    );
  }
}
