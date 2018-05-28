import React from 'react';
import { Table } from 'semantic-ui-react';

export default class CapturedData extends React.PureComponent {
  constructor(props) {
    super(props);
  }

  render() {
    const rows = [];
    for (const [key, value] of Object.entries(this.props.captured)) {
      // key and value are already strings per tricelog implementation, so
      // there's no need to try and JSON them.  Security-wise, react/JSX already
      // escape everything anyways.
      //
      // In the future tricelog.py might gain the ability to sparsely reflect
      // an object's state into nested JS objects, in which case we might want
      // to grow recursive table-building logic.
      rows.push(
        <Table.Row key={ key }>
          <Table.Cell>{ key }</Table.Cell>
          <Table.Cell>{ value }</Table.Cell>
        </Table.Row>
      );
    }

    return (
      <Table celled striped>
        <Table.Body>
          { rows }
        </Table.Body>
      </Table>
    )
  }
}
