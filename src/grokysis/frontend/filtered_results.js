import EE from 'eventemitter3';

/**
 * Consumes one or more immutable SearchResults instances for user-interactive
 * iterative filtering and faceting.
 *
 * The general operation is:
 * - Initial population:
 *   - Initial faceting.  All the data is streamed through the faceters which
 *     pick out interesting looking bits.
 *   - Automatic partition re-faceting.  It may be that the initial facet pass
 *     realized that the data fell into separate clusters and that it would be
 *     useful to run separate faceting passes for each of those separate
 *     partitions.
 * - User-interactive operation.  This is a never-ending cycle of the user doing
 *   the following operations:
 *   - Selecting a facet value to include/exclude on.  This will push a filter
 *     that is used to refine the "current" data or update the existing facet
 *     filter if the facet is already being filtered on.  Facets latch their
 *     state and do not re-compute once they are made an active participant in
 *     filtering.
 *
 * The "raw" SearchResults have a degree of pre-faceting applied to them.  For
 * simplicity, we map these onto our faceting implementation like we had done
 * this ourselves.
 *
 * ### Faceting Representation ###
 *
 *
 *
 */
export default class FilteredResults extends EE {
  constructor({ rawResultsList, knowledgeBase, ctx }) {
    super();

    // Every time a mutation happens, we bump the serial.  serial is the current
    // serial, describing the state of the data.  There's no need to poll on
    // this or anything silly.  Promises are returned by all mutating
    // operations, but this is handy for react-style UIs.
    this.serial = 0;
    // Every time we queue a mutation, we bump nextSerial and latch that for
    // whatever is being processed.  Processing is always async and operations
    // can stack up, so nextSerial may end up more than 1 above serial.
    this.nextSerial = 0;

    this.ctx = ctx;
    this.kb = knowledgeBase;
    // Our source data.
    this.rawResultsList = rawResultsList.concat(); // defensive copy.

    // The current set of data that matches all current filters.
    this.currentData = null;
    this.lastFacetFamily = null;

    this.filterStack = [];

    this._fullRebuild();
  }

  /**
   *
   */
  async _fullRebuild() {

  }

  /**
   * Given a list of hierarchical data roots and a filter predicate, recursively
   * apply the filter predicate
   */
  async _applyFilter(roots, filter) {

  }

  async _pushFilter() {

  }

  async _popFilter() {

  }

  /**
   * Ignore any
   */
  ignorePathPrefix(path) {
    return this._pushFilter({
      facetFamily: null,
      label: 'Ignore Path',
      value: path,
      func: (data) => {
        // return false if the source file's path starts with our path.
        // return true if it does not.
        return !data.path.startsWith(path)
      }
    });
  }
}