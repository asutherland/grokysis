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
  /**
   *
   * @param {String|Function} canonProp
   *   Either the name of the prop that holds the object that we're binding to
   *   or a function that returns the object given this component's `this`
   *   which we attach via a bind().  So if a function is passed, it needs to
   *   do `this.props` and navigate from there.  It can also access fields
   *   initialized in the subclass's constructor.  You'd pass a function if you
   *   want to pull a nested field off a passed object, such as if using
   *   context objects.
   */
  constructor(props, canonProp) {
    super(props);

    let repObjResolver;

    if (typeof(canonProp) === 'string') {
      repObjResolver = () => this.props[canonProp];
    } else {
      // must be a function, we bind because subclass can't access `this` until
      // we return control to them.
      repObjResolver = canonProp.bind(this);
    }
    this._repObjResolver = repObjResolver;

    this.state = {
      // Start at 0, we'll update when we mount to better capture what's going
      // on.
      serial: 0
    };
  }

  get repObj() {
    return this._repObjResolver();
  }

  componentWillMount() {
    this.repObj.on('dirty', this.onDirty, this);
    // Reflect the current actual serial.
    this.onDirty();
  }

  componentWillUnmount() {
    this.repObj.removeListener('dirty', this.onDirty, this);
  }

  onDirty() {
    this.setState({ serial: this.repObj.serial });
  }
}
