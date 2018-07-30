import SymbolInfo from './kb/symbol_info.js';
import FileInfo from './kb/file_info.js';
import FileAnalyzer from './kb/file_analyzer.js';

import ClassDiagram from './diagramming/class_diagram.js';

import InternalDoodler from './diagramming/internal_doodler.js';

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
  async asyncLookupSymbolAtLocation({ pretty, path, lineNum, line, bounds }) {
    const fi = await this.ensureFileAnalysis(path);
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
   * - TODO Running a searchfox search on the symbol.
   * - TODO Populate edge information from the results.  (We get in edges and
   *   out edges this way, whereas source analysis only generates out edges,
   *   although we do generate the reflexive use edge.)
   * - TODO With the search results, ensure the file hosting the definition gets
   *   analyzed so we have the source analysis.
   * - TODO Also analyze the declaration, if appropriate/different, if only so
   *   we can have the syntax-highlighted source for it.
   */
  async _analyzeSymbol(symInfo) {





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
}
