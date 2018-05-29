import React from 'react';

import PathHit from './path_hit.jsx';

/**
 * Represents an array of `hits` where each hit is a { path, lines } dict.
 */
export default class PathHitList extends React.Component {
  render() {
    const { pathHits } = this.props;
    const renderedHits = pathHits.map((pathHit, i) =>
      <PathHit key={ i } pathHit={ pathHit } />);
    return (
      <div>
        { renderedHits }
      </div>
    );
  }
}
