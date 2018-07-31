import React from 'react';

import { Breadcrumb } from 'semantic-ui-react';

import './path_hit.css';

/**
 * Represents a single { path, lines } object, displaying the path and then
 * nesting the LineHit instances beneath it.
 */
export default class PathCrumbed extends React.PureComponent {
  analyzeFile(evt, path) {
    evt.preventDefault();
    evt.stopPropagation();

    console.log('clicked on file', path);

    // for now, only analyze C++ files.
    if (!path.endsWith('.cpp') && !path.endsWith('.h')) {
      return;
    }

    // XXX this hookup needs A Context shunt or something, but a hack will do
    // for now.
    const track = window.grokCtx.sessionManager.tracksByIndex[1];
    track.addThing(null, null, {
      type: 'fileView',
      persisted: { path }
    });
  }

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
        key={ `s${iLast}` }
        onClick={ (evt) => { this.analyzeFile(evt, path); }}
        >
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
