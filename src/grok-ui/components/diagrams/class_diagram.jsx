import React from 'react';

import DirtyingComponent from '../dirtying_component.js';

import Viz from 'viz.js';
import workerURL from 'viz.js/full.render.js';

let gViz;

export default class ClassDiagram extends DirtyingComponent {
  constructor(props) {
    super(props, 'diagram');

    this.diagramRef = React.createRef();

    if (!gViz) {
      gViz = new Viz({ workerURL });
    }
  }

  componentDidMount() {
    if (this.diagramRef.current) {
      const diagram = this.props.diagram;
      const dot = diagram.lowerToGraphviz();
      console.log('rendering DOT:\n' + dot);
      gViz.renderSVGElement(dot).then((elem) => {
        this.diagramRef.current.appendChild(elem);
      });
    }
  }

  render() {
    return <div ref={ this.diagramRef }></div>;
  }
}
