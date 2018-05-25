import React from 'react';

import {select} from 'd3-selection';
import horizonChart from './third_party/horizon-chart.js';

export default class HorizonVis extends React.PureComponent {
  constructor(props) {
    super(props);

    this.visRef = React.createRef();
  }

  componentDidMount() {
    const chart = horizonChart()
      .height(20)
      //.width(200)
      .colors(['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027']);
    var horizons = select(this.visRef.current).selectAll('.horizon')
      .data([this.props.series])
      .enter().append('div')
      .attr('class', 'horizon')
      .each(chart);
  }

  render() {
    return (
      <div ref={ this.visRef }>
      </div>
    )
  }
}
