import React from 'react';

export default class CrashDetailsSheet extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <pre>{ JSON.stringify(this.props.crashDetails, null, 2) }
      </pre>
    );
  }
}
