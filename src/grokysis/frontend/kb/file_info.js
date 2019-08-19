import EE from 'eventemitter3';

/**
 * Live-updating KnowledgeBase info about a file, although really it just
 * updates the once.
 */
export default class FileInfo extends EE {
  constructor({ path }) {
    super();

    this.serial = 0;

    this.path = path;

    // these are externally manipulated by `ensureFileAnalysis`.
    this.analyzing = false;
    this.analyzed = false;

    /**
     * The set of SymbolInfo instances that are defined in this file.
     */
    this.fileSymbolDefs = new Set();
    this.fileSymbolDecls = new Set();

    /**
     * Array where each item corresponds to the zero-based line in the analyzed
     * file.  Each item is in turn its own array of objects of the form
     * { bounds, type, symInfo }.  Where:
     * - bounds is a searchfox search result array of the form [start, end] for
     *   offsets starting from the first non-whitespace character on the line.
     *   This is weird but our use-case is for efficiently mapping searchfox
     *   search results to the actual symbol in question, and the searchfox
     *   search results are optimized for display, with that bounds used for
     *   highlighting the search match in bold rather than anything semantic.
     * - type is going to be "use" or "def" probably.  It may even go away.
     * - symInfo is a link to the resolved SymbolInfo for the underlying symbol.
     *   Note that this Symbol will not have had analysis automatically run on
     *   it, it will be a stub.
     */
    this.lineToSymbolBounds = [];
    this.dataIndexToSymbolBounds = [];
  }

  markDirty() {
    this.serial++;
    this.emit('dirty');
  }
}
