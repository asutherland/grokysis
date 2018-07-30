import React from 'react';


/**
 * Provides a search field that produces SearchResults sheets when enter is hit.
 */
export default class SearchFieldSheet extends React.Component {
  constructor(props) {
    super(props);

    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleSubmit(event) {
    event.preventDefault();

    const searchText = this.input.value;

    this.props.sessionThing.addThing({
      type: 'searchResult',
      position: 'after',
      persisted: { searchText }
    });

    // Update our own persisted state now that the user committed to what they
    // typed.
    // TODO: perhaps also maintain some level of history and fancy up the text
    // field widget.
    this.props.sessionThing.updatePersistedState({
      initialValue: searchText
    });
  }

  render() {
    return (
      <form onSubmit={ this.handleSubmit }>
        <label>
          Search for:&nbsp;
          <input
             defaultValue={ this.props.initialValue }
             type="text"
             ref={ (input) => { this.input = input; } } />
        </label>&nbsp;
        <input type="submit" value="Search" />
      </form>
    );
  }
}
