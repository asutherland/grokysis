import EE from 'eventemitter3';

/**
 * Live-updating KnowledgeBase info about a symbol.
 *
 * Our immediate motivation and use for this is to understand the in-edges and
 * out-edges for methods(/functions).
 *
 * Properties:
 * - typeLetter / type:
 *   - p: protocol
 *   - i: interface
 *   - c: class
 *   - m: method
 *   - f: field
 *   - o: object, for JS object things
 *   - ?: unknown
 * - defLocation { path, lineInfo }
 */
export default class SymbolInfo extends EE {
  constructor({ rawName, defLocation, prettyName }) {
    super();

    this.serial = 0;

    this.rawName = rawName;
    this.prettyName = prettyName || null;

    this.defLocation = defLocation || null;

    this.typeLetter = '?';
    this.type = 'unknown';

    this.analyzing = false;
    this.analyzed = false;

    /**
     * Indicates if we believe this symbol to be unimportant to understanding
     * the program at a higher level.  For example, string manipulation code is
     * boring from an application control-flow graph perspective.  The use of
     * strings is interesting within a method, but they are logically
     * deterministic leaf calls and there is little utility in knowing what
     * other methods call the same string function.
     *
     * So when a method is boring, we won't consider it as worth automatically
     * displaying in a call graph as a possible callsOutTo out-edge.  Similarly,
     * there's little point in displaying the potentially insanely huge set of
     * in-edges tracked in receivesCallsFrom.
     */
    this.isBoring = false;
    this.updateBoring();

    this.callsOutTo = new Set();
    this.receivesCallsFrom = new Set();

    /**
     * HTML document fragment containing the source for the method.
     */
    this.sourceFragment = null;
  }

  markDirty() {
    this.serial++;
    this.emit('dirty');
  }

  /**
   * Updates our `isBoring` state based on currently available information.
   */
  updateBoring() {
    const path = this.defLocation && this.defLocation.path;
    if (!path) {
      return;
    }

    // XXX these ideally would come from a database that's bootstrapped off a
    // TOML config and that can be round-tripped back to TOML.
    // TODO: implement toml boring classification thingy.
    if (/^xpcom\/string/.test(path) ||
        /^mfbt\/Ref/.test(path) ||
        /^mfbt\/.+Ptr/.test(path)) {
      this.isBoring = true;
    }
  }
}
