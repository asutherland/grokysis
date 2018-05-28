import React from 'react';
import { Table } from 'semantic-ui-react';

export default class Stack extends React.PureComponent {
  constructor(props) {
    super(props);
  }

  render() {
    if (!this.props.stack || !this.props.stack.length) {
      return <div></div>;
    }

    const rows = [];
    let i = 0;
    for (const { name, file, line } of this.props.stack) {
      // key and value are already strings per tricelog implementation, so
      // there's no need to try and JSON them.  Security-wise, react/JSX already
      // escape everything anyways.
      //
      // In the future tricelog.py might gain the ability to sparsely reflect
      // an object's state into nested JS objects, in which case we might want
      // to grow recursive table-building logic.
      rows.push(
        <Table.Row key={ i }>
          <Table.Cell>{ name }</Table.Cell>
          <Table.Cell>{ file }:{ line }</Table.Cell>
        </Table.Row>
      );
      i++;
    }

    return (
      <Table celled striped>
        <Table.Body>
          { rows }
        </Table.Body>
      </Table>
    );
  }
}
