import React from 'react';

import { select, mouse, event } from 'd3-selection';
import horizonChart from './third_party/horizon-chart.js';

export default class HorizonVis extends React.PureComponent {
  constructor(props) {
    super(props);

    this.visRef = React.createRef();

    this.onClick = this.onClick.bind(this);
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
      .each(chart)
      .on('click', this.onClick);
  }

  onClick(data, index, group) {
    //console.log('click', data, index, group, event);
    //console.log('mouse info', mouse(event.target));
    // send the x coordinate
    this.props.onClick(mouse(event.target)[0]);
  }

  render() {
    return (
      <div ref={ this.visRef }>
      </div>
    )
  }
}
