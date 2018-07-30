import React from 'react';

import { Accordion } from 'semantic-ui-react';

import PathCrumbed from './path_crumbed.jsx';
import LineHit from './line_hit.jsx';

import './path_hit.css';

/**
 * Represents a single { path, lines } object, displaying the path and then
 * nesting the LineHit instances beneath it.
 *
 * Because we want the LineHit instances to be something we can collapse out of
 * sight, we use the semantic-ui Accordion in its self-managed form so we don't
 * need to do anything stateful ourselves.
 */
export default class PathHit extends React.PureComponent {
  render() {
    const { path, lines } = this.props.pathHit;

    const lineHits = lines.map((lineHit, i) =>
      <LineHit key={ i } lineHit={ lineHit } />);

    const panels = [
      {
        // This key is necessary even though we're a singleton because the dev
        // mode likes to warn on arrays, as it should.
        key: '0',
        title: {
          content: (
            <span>
              <PathCrumbed className="pathHit__path" path={ path }/>
              { ` (${lineHits.length})`}
            </span>
          ),
        },
        content: {
          content: (
            <div className="pathHit__lines">
              { lineHits }
            </div>
          ),
        }
      }
    ];

    const spreadProps = {};
    // Only set the default active index if we want the accordion expanded.
    // Alternately, it seems like setting this to -1 works.
    if (this.props.expandByDefault) {
      spreadProps.defaultActiveIndex = 0;
    }

    // Passing panels is the self-managed form.
    return (
      <Accordion {...spreadProps}
        fluid={ true }
        styled={ false }
        panels={ panels } />
    );
  }
}
