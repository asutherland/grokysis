import SymbolInfo from './kb/symbol_info.js';
import FileInfo from './kb/file_info.js';
import FileAnalyzer from './kb/file_analyzer.js';

import ClassDiagram from './diagramming/class_diagram.js';

import InternalDoodler from './diagramming/internal_doodler.js';

/**
 * Hacky attempt to deal with searchfox using comma-delimited symbols in places
 * where you might not expect it.
 */
function normalizeSymbol(symStr, commaExpected) {
  if (!symStr) {
    return null;
  }
  if (symStr.indexOf(',') !== -1) {
    if (!commaExpected) {
      // Get a backtrace so we can figure out who is doing this.
      console.error('Caller passed comma-delimited symbol name:', symStr);
    }
    return symStr.split(',', 1)[0];
  }
  return symStr;
}

/**
 * Check if two (inclusive start offset, exclusive end offset) ranges intersect.
 */
function boundsIntersect(a, b) {
  // They don't intersect if the first range ends before the second range starts
  // OR the first range ends after the second range ends.
  if (a[1] <= b[0] ||
      a[0] >= b[1]) {
    return false;
  }
  return true;
}

/**
 * Hand-waving source of information that's not spoon-fed to us by searchfox or
 * lower level normalization layers.  This means a home for:
 * - higher level analysis that should migrate into searchfox proper once
 *   understood and justified by utility.
 * - weird hacky heuristics
 * - stuff the user told us
 *
 * It's likely that much of this logic should be pushed into the back-end, but
 * for now the split is that the backend is used for deterministic request/reply
 * semantics and this class and its helpers are where state aggregation and
 * snooping-with-side-effects happens.
 *
 * We provide for the following known facts:
 *
 * The following facts are planned to be extracted:
 * - Thread-in-use: Determined by heuristics based on assertions or from hacky
 *   external toml config files.
 *
 * ### Exposed public API
 *
 * The following methods are expected to be used in the following ways by the
 * UI:
 * - asyncLookupSymbolAtLocation: Used when clicking on a raw searchfox search
 *   result.  (We don't have the underlying symbol in that case, we have to
 *   get it out of the loaded file.)
 * - lookupRawSymbol: Used when clicking on a syntax-highlighted searchfox
 *   symbol.  Although we plan to have the SymbolInfo at the time of HTML
 *   generation, it doesn't seem worth retaining/entraining.
 *
 */
export default class KnowledgeBase {
  constructor({ name, grokCtx }) {
    this.name = name;
    this.grokCtx = grokCtx;

    /**
     * SymbolInfo instances by their raw (usually) manged name.  There is
     * exactly one SymbolInfo per raw name.  Compare with pretty symbols which,
     * in searchfox, discard the extra typeinfo like method override variants,
     * and so for which there can be multiple symbols.
     */
    this.symbolsByRawName = new Map();

    /**
     * Set of SymbolInfo instances currently undergoing analysis.
     */
    this.analyzingSymbols = new Set();

    /**
     * FileInfo instances by their path relative to the root of the source dir.
     * Currently, it's really just C++ files that can be analyzed, so most other
     * file types will get stubs.
     */
    this.filesByPath = new Map();

    this.fileAnalyzer = new FileAnalyzer(this);
  }

  /**
   * Given its raw symbol name, synchronously return a SymbolInfo that will
   * update as more information is gained about it.
   *
   * @param {String} [prettyName]
   */
  lookupRawSymbol(rawName, doAnalyze, prettyName, opts) {
    rawName = normalizeSymbol(rawName); // deal with comma-delimited symbols.

    let symInfo = this.symbolsByRawName.get(rawName);
    if (symInfo) {
      if (prettyName && !symInfo.prettyName) {
        symInfo.updatePrettyNameFrom(prettyName);
      }
      if (doAnalyze) {
        this.ensureSymbolAnalysis(symInfo);
      }
      return symInfo;
    }

    symInfo = new SymbolInfo({
      rawName, prettyName,
      // propagate hints for the source through.
      somePath: opts && opts.somePath,
      headerPath: opts && opts.headerPath,
      sourcePath: opts && opts.sourcePath
    });
    this.symbolsByRawName.set(rawName, symInfo);

    if (doAnalyze) {
      this.ensureSymbolAnalysis(symInfo);
    }

    return symInfo;
  }

  /**
   * Given the relevant bits of a searchfox search that identify a symbol at a
   * location in a file, asynchronously process the file (if not already
   * processed), locate the specific symbol, and return it.  The Symbol may
   * continue to undergo asynchronous analysis when it is returned, as we are
   * returning the symbol as soon as we know its raw name.
   *
   * Note that when inheritance gets involved, searchfox likes to conflate
   * things, so we may actually find multiple raw symbols being referenced at a
   * given point.  In that case we'll try and figure out what the most specific
   * symbol is and return that, and have that symbol reference the other
   * symbol(s) via some type of relationship.
   */
  async asyncLookupSymbolAtLocation({ path, lineNum, bounds }) {
    const fi = await this.ensureFileAnalysis(path);
    const zbLineNum = lineNum - 1;
    const synLine = fi.lineToSymbolBounds[zbLineNum];
    for (const symBounds of synLine) {
      if (boundsIntersect(symBounds.bounds, bounds)) {
        return symBounds.symInfo;
      }
    }
    return null;
  }


  /**
   * Given a path, asynchronously analyze and return the FileInfo that
   * corresponds to the file.
   */
  async ensureFileAnalysis(path) {
    let fi = this.filesByPath.get(path);
    if (fi) {
      if (fi.analyzed) {
        return fi;
      }
      if (fi.analyzing) {
        return fi.analyzing;
      }
      // uh... how are we here, then?
      console.error('uhhh...');
    }

    fi = new FileInfo({ path });
    const data = await this.grokCtx.fetchFile({ path });

    fi.analyzing = this.fileAnalyzer.analyzeFile(fi, data);
    this.filesByPath.set(path, fi);

    await fi.analyzing;
    fi.analyzing = false;
    fi.analyzed = true;
    fi.markDirty();
    console.log('finished analyzing file', fi);
    return fi;
  }

  async ensureSymbolAnalysis(symInfo) {
    if (symInfo.analyzed) {
      return symInfo;
    }
    if (symInfo.analyzing) {
      return symInfo.analyzing;
    }

    symInfo.analyzing = this._analyzeSymbol(symInfo);
    this.analyzingSymbols.add(symInfo);

    await symInfo.analyzing;
    symInfo.analyzing = false;
    symInfo.analyzed = true;
    this.analyzingSymbols.delete(symInfo);
    symInfo.markDirty();
    return symInfo;
  }

  /**
   * Dig up info on a symbol by:
   * - Running a searchfox search on the symbol.
   * - Populate incoming edge information from the "uses" results.
   * - Trigger analysis of any files cited as "decls" or "defs".  This produces
   *   out edges and should get us the syntax-highlighted source.
   */
  async _analyzeSymbol(symInfo) {
    // Perform the raw Searchfox search.
    const filteredResults =
      await this.grokCtx.performSearch(`symbol:${symInfo.rawName}`);

    // XXX just grab the bare metal raw results out.
    // Note that these are the transformed results produced by
    // `normalize_search_results.js`.
    const raw = filteredResults.rawResultsList[0].raw;

    // Iterate over: normal/test/generated/etc.
    console.log("analyzeSymbol: raw result:", raw);
    for (const [dirType, grouped] of Object.entries(raw)) {
      // grouped looks like { files, fulltext, semantic } with a dict of symbols
      // below semantic.
      if (!grouped.semantic) {
        continue;
      }

      // Each key is a pretty symbol name.  Each value is a dictionary of use
      // groups like "defs", "decls", etc.
      for (const [prettyName, useGroups] of Object.entries(grouped.semantic)) {
        if (symInfo.fullName && prettyName !== symInfo.fullName) {
          console.warn('Skipping pretty symbol name', prettyName,
                       'that does not match expected pretty name:',
                       symInfo.fullName);
        }

        // Each key is the use-type like "defs", "decls", etc. and the values
        // are PathLines objects of the form { path, lines }
        for (const [useType, pathLinesArray] of Object.entries(useGroups)) {
          if (useType === 'uses') {
            for (const pathLines of pathLinesArray) {
              for (const lineResult of pathLines.lines) {
                if (lineResult.contextsym) {
                  const contextSym = this.lookupRawSymbol(
                    normalizeSymbol(lineResult.contextsym), false,
                    lineResult.context,
                    // Provide a path for pretty name mangling normalization.
                    { somePath: pathLines.path });

                  symInfo.receivesCallsFrom.add(contextSym);
                  symInfo.markDirty();
                  contextSym.callsOutTo.add(symInfo);
                  contextSym.markDirty();
                }
              }
            }
          }
          // For definitions and decls make sure we're processing the file, but
          // there's no need to wait for it to finish processing.
          if (useType === 'defs') {
            for (const pathLines of pathLinesArray) {
              this.ensureFileAnalysis(pathLines.path);
            }
          }
          if (useType === 'decls') {
            for (const pathLines of pathLinesArray) {
              this.ensureFileAnalysis(pathLines.path);
            }
          }
        }
      }
    }
  }

  /**
   * Create a starting diagram based on a symbol and a diagram type.
   */
  diagramSymbol(symInfo, diagramType) {
    const diagram = new ClassDiagram();

    switch (diagramType) {
      default:
      case 'empty': {
        break;
      }

      case 'method': {
        const doodler = new InternalDoodler();
        doodler.doodleMethodInternalEdges(symInfo, diagram);
        break;
      }
    }

    return diagram;
  }

  restoreDiagram(serialized) {
    const diagram = new ClassDiagram();
    diagram.loadFromSerialized(serialized);
    return diagram;
  }
}
