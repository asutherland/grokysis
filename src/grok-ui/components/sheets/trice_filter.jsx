import React from 'react';
import { Table } from 'semantic-ui-react'

import HorizonVis from '../trice_timeline/horizon_vis.jsx';

/**
 * Supports faceting and filtering of the current trice.
 *
 * The UI is a table of
 */
export default class TriceFilterSheet extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      log: null,
      firstVisibleBin: null,
      lastVisibleBin: null
    };

    this.onLogHello = this.onLogHello.bind(this);
    this.onSeeked = this.onSeeked.bind(this);
    this.onClickVisX = this.onClickVisX.bind(this);
  }

  componentWillMount() {
    this.props.sessionThing.handleSlotMessage(
      'triceLog:filters:hello', this.onLogHello);
    this.props.sessionThing.handleSlotMessage(
      'triceLog:filters:seeked', this.onSeeked);
  }

  componentWillUnmount() {
    this.props.sessionThing.stopHandlingSlotMessage('triceLog:eventFocused');
    this.props.sessionThing.stopHandlingSlotMessage('triceLog:filters:seeked');
  }

  onLogHello(log) {
    this.setState({ log });
  }

  // note that we don't care which vis's X is clicked right now.  A nice
  // enhancement would be to know which vis was clicked and find the closest
  // bin so we can snap to it.
  onClickVisX(x) {
    this.props.sessionThing.sendSlotMessage('triceLog:vis:seek', { bin: x })
  }

  onSeeked({ startBin, endBin }) {
    this.setState({
      firstVisibleBin: startBin,
      lastVisibleBin: endBin
    });
  }

  render() {
    if (!this.state.log) {
      return <div></div>;
    }

    let visibleRange = null;
    if (this.state.firstVisibleBin !== null) {
      visibleRange = [this.state.firstVisibleBin, this.state.lastVisibleBin];
    }

    const tableRows = [];
    // This needs to be a tree-table thing so we can use <li> tags.
    const INDENT_DELTA = 12;
    const renderFacet = (facet, indent, parentPath) => {
      const fullPath = parentPath + '/' + facet.name;
      const hackyStyle = { paddingLeft: `${indent}px`};
      tableRows.push(
        <Table.Row key={ fullPath }>
          <Table.Cell><span style={ hackyStyle }>{ facet.name }</span></Table.Cell>
          <Table.Cell>{ facet.count }</Table.Cell>
          <Table.Cell>
            <HorizonVis
              series={ facet.bins }
              visibleRange={ visibleRange }
              onClick={ this.onClickVisX }
            />
          </Table.Cell>
        </Table.Row>
      );

      for (const kidFacet of facet.children) {
        renderFacet(kidFacet, indent + INDENT_DELTA, fullPath);
      }
    }
    for (const topFacet of this.state.log.filterableFacets) {
      renderFacet(topFacet, 0, '');
    }

    return (
      <div>
        <Table celled striped>
          <Table.Body>
            { tableRows }
          </Table.Body>
        </Table>
      </div>
    );
  }
}
