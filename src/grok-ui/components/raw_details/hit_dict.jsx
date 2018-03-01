import React from 'react';

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

    const selected = Object.keys(this.props.hitDict)[0];
    this.state = {
      selected
    };
  }

  render() {
    const tabs = [];
    let tabContents;

    const selected = this.state.selected;
    for (const [key, values] of Object.entries(this.props.hitDict)) {
      const isSelected = (key === selected);
      let tabClass = 'hitDict__tab';
      let labelClass = 'hitDict__tabLabel';
      if (isSelected) {
        tabClass += ' hitDict__tab--selected';
        labelClass += ' hitDict__tabLabel--selected';
      }
      const selectThis = () => {
        this.setState({ selected: key });
      };
      let valuesCount;
      if (Array.isArray(values)) {
        valuesCount = values.length;
      } else {
        valuesCount = Object.keys(values).length;
      }
      const tabLabel = `${key} (${ valuesCount })`;
      tabs.push(
        <li key={key}
             className={ tabClass }
             onClick={ selectThis }
             >
          <a className={ labelClass } title={ tabLabel }>{ tabLabel }</a>
        </li>
      );

      if (isSelected) {
        tabContents = this.props.contentFactory(values, selected);
      }
    }

    const hit = this.props.obj;
    return (
      <div className="hitDict">
        <ul className="hitDict__tabs">{ tabs }</ul>
        <div className="hitDict__contents">
          { tabContents }
        </div>
      </div>
    );
  }
}