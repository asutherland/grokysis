//const HACKY_SERVER_BASE = 'http://localhost:3000';
// Uh, use relative URL's since we expect it to be us doing the serving right
// now.  (Or more specifically our server.js.)
const HACKY_SERVER_BASE = '';
// Base URL for proxied search queries.
const HACKY_SERVER_SEARCH = `${HACKY_SERVER_BASE}/sf/search`;
// Base URL to get the HTML syntax-highlighted code plus node-sitter AST tree
// for specific source files.
const HACKY_SERVER_SOURCE_BASE = `${HACKY_SERVER_BASE}/sf/spage`;

const ONE_HOUR_IN_MILLIS = 60 * 60 * 1000;

/**
 * Low-level wrapper for notional access to searchfox, but actually our hacky
 * node.js "server.js" script.
 */
export default class SearchDriver {
  constructor({ treeName }) {
    this.treeName = treeName;
    this.cacheName = `sf-${this.treeName}`;

    this.cache = null;
    this._initCache();
  }

  async _initCache() {
    this.cache = await caches.open(this.cacheName);
  }

  /**
   * Very simple caching helper that naively caches everything and survives a
   * failure to open the cache in the first place.  Also supports a super
   * hacky mechanism where if the URL includes "NUKECACHE" in it, the cache
   * gets purged.
   *
   * For now, there's a very poor cache cleanup mechanism.  If we find a cached
   * match and it's too old, we delete it and then try and overwrite it with
   * the new result once it comes back.
   *
   * TODO: evaluate the contents of the cache at startup and evict based on
   * keys() as well.  NB: keys() based enumeration can cause massive explosions
   * if the cache has somehow ended up with a ton of entries.
   */
  async _cachingFetch(url) {
    // super-hacky cache clearing without opening devtools like a sucker.
    if (/NUKECACHE/.test(url)) {
      this.cache = null;
      await caches.delete(this.cacheName);
      this.cache = await caches.open(this.cacheName);
    }

    let matchResp;
    if (this.cache) {
      matchResp = await this.cache.match(url);
    }
    if (matchResp) {
      const dateHeader = matchResp.headers.get('date');
      if (dateHeader) {
        const ageMillis = Date.now() - new Date(dateHeader);
        if (ageMillis > ONE_HOUR_IN_MILLIS) {
          matchResp = null;
        }
      } else {
        // evict if we also lack a date header...
        matchResp = null;
      }

      if (!matchResp) {
        this.cache.delete(url);
      } else {
        return matchResp;
      }
    }

    const resp = await fetch(url);
    this.cache.put(url, resp.clone());

    return resp;
  }

  async performSearch({ searchStr }) {
    const params = new URLSearchParams();
    params.set('q', searchStr);
    params.set('case', 'false');
    params.set('regexp', 'false');
    params.set('path', '');
    const resp = await this._cachingFetch(
      `${HACKY_SERVER_SEARCH}?${params.toString()}`);
    const result = await resp.json();
    return result;
  }

  /**
   * Fetch the augmented searchfox page for the given path from the backend with
   * caching semantics.
   */
  async fetchFile({ path }) {
    const url = `${HACKY_SERVER_SOURCE_BASE}/${path}`;

    const resp = await this._cachingFetch(url);
    const data = await resp.json();

    return data;
  }
}
