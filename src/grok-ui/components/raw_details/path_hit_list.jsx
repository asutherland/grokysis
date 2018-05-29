import React from 'react';

import PathHit from './path_hit.jsx';

import './path_hit_list.css';

/**
 * Represents an array of `hits` where each hit is a { path, lines } dict.
 */
export default class PathHitList extends React.Component {
  render() {
    const { group, pathHits } = this.props;
    // HEURISTIC: Only expand by default if there are less than 10.  More than
    // 10 means collapse by default.
    const expandByDefault = pathHits.length < 10;
    const renderedHits = pathHits.map((pathHit, i) =>
      <PathHit
        // generate a key that's a function of our group so state doesn't smear
        // between the hits in different groups, like their accordions.
        key={ `${group}:${i}` }
        pathHit={ pathHit }
        expandByDefault={ expandByDefault }
      />
    );
    return (
      <div className="pathHitList__container">
        { renderedHits }
      </div>
    );
  }
}
