/**
 * Immutable search results container.  Receives the normalize SearchFox results
 * which are inherently hierarchical and stores them as-is.  See
 * `normalize_search_results.js` for information on the structure.
 */
export default class SearchResults {
  constructor(rawResults) {
    this.raw = rawResults;
  }
}