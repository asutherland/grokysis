import React from 'react';

/**
 * Provides a search field that produces SearchResults sheets when enter is hit.
 */
export default class TriceLoaderSheet extends React.Component {
  constructor(props) {
    super(props);

    this.handleSubmit = this.handleSubmit.bind(this);

    this.triceInput = null;
    this.tomlInput = null;
  }

  handleSubmit(event) {
    event.preventDefault();

    const url = this.triceInput.value;
    const tomlUrl = this.tomlInput.value;

    this.props.sessionThing.addThing({
      type: 'triceTimeline',
      position: 'after',
      persisted: { url, tomlUrl }
    });

    // Update our own persisted state now that the user committed to what they
    // typed.
    this.props.sessionThing.updatePersistedState({
      url, tomlUrl
    });
  }

  render() {
    return (
      <form onSubmit={ this.handleSubmit }>
        <div>
          <label>
            Load trice log located at:&nbsp;
            <input
               defaultValue={ this.props.sessionThing.persisted.url }
               type="text"
               ref={(input) => { this.triceInput = input; }} />
          </label>
        </div>
        <div>
          <label>
            Load source toml configuration from:&nbsp;
            <input
               defaultValue={ this.props.sessionThing.persisted.tomlUrl }
               type="text"
               ref={(input) => { this.tomlInput = input; }} />
          </label>
        </div>
        <input type="submit" value="Load" />
      </form>
    );
  }
}
