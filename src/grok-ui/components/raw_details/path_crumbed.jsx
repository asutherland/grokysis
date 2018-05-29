import React from 'react';

import { Breadcrumb } from 'semantic-ui-react';


import LineHit from './line_hit.jsx';

import './path_hit.css';

/**
 * Represents a single { path, lines } object, displaying the path and then
 * nesting the LineHit instances beneath it.
 */
export default class PathCrumbed extends React.PureComponent {
  render() {
    const { path } = this.props;

    // NB: It's assumed this will have been normalized to '/' even for Windows.
    const pieces = path.split('/');

    // ## [0, last)
    const elems = [];
    const iLast = pieces.length - 1;
    for (let iPiece=0; iPiece < iLast; iPiece++) {
      const piece = pieces[iPiece];
      elems.push(
        <Breadcrumb.Section
          link
          key={ `s${iPiece}` }>
          { piece }
        </Breadcrumb.Section>
      );
      elems.push(
        <Breadcrumb.Divider
          key={ `d${iPiece}` }
          />
      );
    }
    // ## last
    const lastPiece = pieces[iLast];
    elems.push(
      <Breadcrumb.Section
        active
        key={ `s${iLast}` }>
        { lastPiece }
      </Breadcrumb.Section>
    );

    // ## Assemble
    return (
      <Breadcrumb>
        { elems }
      </Breadcrumb>
    );
  }
}
