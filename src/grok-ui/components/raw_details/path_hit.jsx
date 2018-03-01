import React from 'react';

import LineHit from './line_hit.jsx';

import './path_hit.css';

/**
 * Represents a single { path, lines } object, displaying the path and then
 * nesting the LineHit instances beneath it.
 */
export default class PathHit extends React.PureComponent {
  render() {
    const { path, lines } = this.props.pathHit;
    const lineHits = lines.map((lineHit, i) =>
      <LineHit key={ i } lineHit={ lineHit } />);
    return (
      <div>
        <div className="pathHit__path">{ path }</div>
        <div className="pathHit__lines">
          { lineHits }
        </div>
      </div>
    );
  }
}