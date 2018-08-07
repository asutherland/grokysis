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
    super.componentDidMount();
    if (this.diagramRef.current) {
      const diagram = this.props.diagram;
      const dot = diagram.lowerToGraphviz();
      //console.log('rendering DOT:\n' + dot);
      gViz.renderSVGElement(dot).then((elem) => {
        const container = this.diagramRef.current;
        if (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        container.appendChild(elem);
      });
    }
  }

  componentDidUpdate() {
    // we do the same thing on mount and update.
    this.componentDidMount();
  }

  render() {
    return <div ref={ this.diagramRef }></div>;
  }
}
