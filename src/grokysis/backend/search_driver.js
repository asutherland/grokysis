const HACKY_SERVER_BASE = 'http://localhost:3000';
// Base URL for proxied search queries.
const HACKY_SERVER_SEARCH = `${HACKY_SERVER_BASE}/sf/search`;
// Base URL to get the HTML syntax-highlighted code plus node-sitter AST tree
// for specific source files.
const HACKY_SERVER_SOURCE_BASE = `${HACKY_SERVER_BASE}/sf/spage/`;

/**
 * Low-level wrapper for notional access to searchfox, but actually our hacky
 * node.js "server.js" script.
 */
export default class SearchDriver {
  constructor({ treeName }) {

  }

  async performSearch(searchArgs) {

  }
}