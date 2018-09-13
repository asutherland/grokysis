import React from 'react';

/**
 * Load single crash results or signatures, probably.
 */
export default class CrashLoaderSheet extends React.Component {
  constructor(props) {
    super(props);

    this.handleSubmit = this.handleSubmit.bind(this);

    this.crashIdRef = React.createRef();
    this.crashSignatureRef = React.createRef();
  }

  handleSubmitSingle(event) {
    event.preventDefault();

    const crashId = this.crashIdRef.current.value;

    this.props.sessionThing.addThing({
      type: 'crashDetails',
      position: 'after',
      persisted: { crashId }
    });

    // Update our own persisted state now that the user committed to what they
    // typed.
    this.props.sessionThing.updatePersistedState({
      crashId
    });
  }

  handleSubmitSignature(event) {
    event.preventDefault();

    const crashSignature = this.crashSignatureRef.current.value;

    this.props.sessionThing.addThing({
      type: 'crashSignature',
      position: 'after',
      persisted: { crashSignature }
    });

    this.props.sessionThing.updatePersistedState({
      crashSignature
    });
  }

  render() {
    return (
      <div>
        <form onSubmit={ this.handleSubmitSingle }>
          <div>
            <label>
              Crash ID:&nbsp;
              <input
                 defaultValue={ this.props.sessionThing.persisted.crashId }
                 type="text"
                 ref={ this.crashIdRef } />
            </label>
          </div>
          <input type="submit" value="Show" />
        </form>
        <form onSubmit={ this.handleSubmitSignature }>
          <div>
            <label>
              Crash Signature:&nbsp;
              <textarea
                 defaultValue={ this.props.sessionThing.persisted.crashSignature }
                 type="text"
                 ref={ this.crashSignatureRef } />
            </label>
          </div>
          <input type="submit" value="Show" />
        </form>
      </div>
    );
  }
}
