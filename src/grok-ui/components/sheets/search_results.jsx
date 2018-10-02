import React from 'react';

import DirtyingComponent from '../dirtying_component.js';

import RawResults from '../raw_details/raw_results.jsx';

/**
 * Displays the filterable results of a Searchfox search's FilteredResults
 * instance.
 */
export default class SearchResultsSheet extends DirtyingComponent {
  constructor(props) {
    super(props, 'searchResults');
  }

  render() {
    const { sessionThing, grokCtx } = this.props;
    const rawResults = this.props.searchResults.rawResultsList[0];
    return (
      <RawResults
        sessionThing={ sessionThing }
        grokCtx={ grokCtx }
        rawResults={ rawResults }
        />
    );
  }
}
