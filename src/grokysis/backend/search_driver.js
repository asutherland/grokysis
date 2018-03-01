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
    // XXX hacky server means we don't pay attention to the tree.
  }

  async performSearch({ searchStr }) {
    const params = new URLSearchParams();
    params.set('q', searchStr);
    params.set('case', 'false');
    params.set('regexp', 'false');
    params.set('path', '');
    const resp = await fetch(`${HACKY_SERVER_SEARCH}?${params.toString()}`);
    const result = await resp.json();
    return result;
  }
}