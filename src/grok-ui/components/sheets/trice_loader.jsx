import React from 'react';


/**
 * Provides a search field that produces SearchResults sheets when enter is hit.
 */
export default class TriceLoaderSheet extends React.Component {
  constructor(props) {
    super(props);

    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleSubmit(event) {
    event.preventDefault();

    const url = this.input.value;

    this.props.sessionThing.addThing({
      type: 'triceTimeline',
      position: 'after',
      persisted: { url }
    });

    // Update our own persisted state now that the user committed to what they
    // typed.
    this.props.sessionThing.updatePersistedState({
      initialValue: searchText
    })
  }

  render() {
    return (
      <form onSubmit={ this.handleSubmit }>
        <label>
          Load trice log located at:&nbsp;
          <input
             defaultValue={ this.props.initialValue }
             type="text"
             ref={(input) => this.input = input} />
        </label>&nbsp;
        <input type="submit" value="Load" />
      </form>
    );
  }
}
