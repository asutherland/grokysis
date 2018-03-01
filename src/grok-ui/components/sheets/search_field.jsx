import React from 'react';

import SearchResults from './search_results.jsx';

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

    // XXX figuring out how to best provide the ability to have a context-aware
    // addSheet function while also fulfilling JSX need that the <Widget>
    // instantiation be using the semantically correct name.

    // Trigger a search, this returns a promise.  (The grokCtx is part of the
    // overall notebook props passed in to all sheets.
    const pendingResults = this.props.grokCtx.performSearch(searchText);

    this.props.addSheet({
      position: 'after',
      labelWidget: <span>Search Results: <i>{searchText}</i></span>,
      // This will make the sheet display a loading indication until the search
      // completes.
      awaitContent: pendingResults,
      // Once the search completes, the contentFactory will be invoked with the
      // notebook sheet props plus the resolved content promise.
      contentFactory: (props, searchResults) => {
        return (
          <SearchResults {...props}
            searchResults={ searchResults }
            />
        );
      }
    });
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label>
          Search for:&nbsp;
          <input type="text" ref={(input) => this.input = input} />
        </label>&nbsp;
        <input type="submit" value="Search" />
      </form>
    );
  }
}