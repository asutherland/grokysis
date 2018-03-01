import React from 'react';

/**
 * Component base-class for rendering objects passed as `obj` that expose a
 * `serial` and a `dirty` event that indicates the serial has been bumped that
 * should trigger render().  This idiom allows for coalescing and for ensuring
 * that the widget is up-to-date with the underlying object (by checking
 * this.state.serial against this.props.obj.serial).
 *
 * This could be a higher-order component that wraps whatever is subclassing us
 * instead.
 */
export default class DirtyingComponent extends React.PureComponent {
  constructor(props, canonPropName) {
    super(props);

    this.canonPropName = canonPropName;

    this.state = {
      serial: props[canonPropName].serial
    };
  }

  componentWillMount() {
    this.props[this.canonPropName].on('dirty', this.onDirty, this);
  }

  componentWillUnmount() {
    this.props[this.canonPropName].removeListener('dirty', this.onDirty, this);
  }

  onDirty() {
    this.setState({ serial: this.props[this.canonPropName].serial });
  }
}