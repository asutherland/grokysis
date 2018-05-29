import React from 'react';

import { Tab } from 'semantic-ui-react';

import './hit_dict.css';

/**
 * Given a `hitDict` which consists of a number of keys like "defs"/"uses"/etc.
 * and associated values, present a tab-like interface to switch between them.
 * Props are:
 * - hitDict: Contains the keys/values
 * - contentFactory: Function(values, key) to produce the appropriate tree for
 *   the given tab.  The idea is this makes this widget somewhat reusable, at
 *   least while it's in flux.
 */
export default class HitDict extends React.PureComponent {
  constructor(props) {
    super(props);

    // We previously controlled the active tab, but we're able to defer it to
    // be Tab's problem.
  }

  render() {
    const panes = [];

    for (const [key, values] of Object.entries(this.props.hitDict)) {
      let valuesCount;
      if (Array.isArray(values)) {
        valuesCount = values.length;
      } else {
        valuesCount = Object.keys(values).length;
      }

      panes.push({
        menuItem: `${key} (${ valuesCount })`,
        render: () => {
          const body = this.props.contentFactory(values, key);
          return (
            <Tab.Pane>
              { body }
            </Tab.Pane>
          );
        }
      });
    }

    return (
      <Tab className="hitDict"
        panes={ panes }
        menu={ this.props.menu }
        />
    );
  }
}
