/**
 * Immutable search results container.  Receives the normalized SearchFox
 * results which are inherently hierarchical and stores them as-is.  See
 * `normalize_search_results.js` for information on the structure.
 */
export default class RawSearchResults {
  constructor(rawResults) {
    this.raw = rawResults;
  }
}