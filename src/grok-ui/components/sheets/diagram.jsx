import React from 'react';

import ClassDiagram from '../diagrams/class_diagram.jsx';

export default class DiagramSheet extends React.Component {
  constructor(props) {
    super(props);

    this.onAddEdge = this.onAddEdge.bind(this);
  }

  componentDidMount() {
    this.props.sessionThing.handleSlotMessage(
      'addEdge', this.onAddEdge);
  }

  componentWillUnmount() {
    this.props.sessionThing.stopHandlingSlotMessage('addEdge');
  }

  onAddEdge({ from, to }) {
    const diagram = this.props.diagram;
    diagram.ensureEdge(from, to);
  }

  render() {
    return (
      <ClassDiagram {...this.props} />
    );
  }
}
