import SymbolInfo from './kb/symbol_info.js';

/**
 * Hand-waving source of information that's not spoon-fed to us by searchfox or
 * lower level normalization layers.  This means a home for:
 * - weird hacky heuristics
 * - stuff the user told us
 *
 * It's likely that much of this logic should be pushed into the back-end, but
 * for now the split is that the backend is used for deterministic request/reply
 * semantics and this class and its helpers are where state aggregation and
 * snooping-with-side-effects happens.
 *
 * We provide for the following known facts:
 * - Thread-in-use: Determined by heuristics based on assertions or from hacky
 *   external
 *
 */
export default class KnowledgeBase {
  constructor() {
    this.symbolsByPrettyName = new Map();

  }

  /**
   * Synchronously return a SymbolInfo that will update as more information is
   * gained about it.
   */
  lookupSymbol(prettyName) {
    let symInfo = this.symbolsByPrettyName.get(prettyName);
    if (symInfo) {
      return symInfo;
    }

    symInfo = new SymbolInfo({ prettyName });
    this.symbolsByPrettyName.set(prettyName, symInfo);
  }

  /**
   * Builds an Array where each entry corresponds to a source line, undefined
   * meaning there's no enclosing method at that location and a String means the
   * line belongs to the Method with the given symbol name (suffix).  Note that
   * we don't count the declaration and its arg-list; we count from inside the
   * braced compound statement and we assume sane white-spacing.
   */
  _extractMethodBoundariesFromAST(ast) {
    // the rows are 0-based, so add 1 to the translation_unit node.
    if (ast.type !== 'translation_unit') {
      throw new Error('bad root AST node type: ' + ast.type);
    }
    const lmap = new Array(ast.endPosition.row + 1);

    /**
     * Walk the node's children until one of the type `childType` is provided,
     * then return that.  Return null otherwise.
     */
    const pickChild = (node, childType) => {
      for (const kid of node.children) {
        if (kid.type === childType) {
          return kid;
        }
      }
      return null;
    }

    const markMethodBounds = (namespace, localId, boundingNode) => {
      let fullName = namespace;
      if (fullName) {
        fullName += '::';
      }
      fullName += localId;

      for (let i = boundingNode.startPosition.row;
           i <= boundingNode.endPosition.row; i++) {
        lmap[i] = fullName;
      }
    };

    /**
     * The declarator can either be an 'identifier' or a 'scoped_identifier'.
     */
    const extractIdFromFunctionDeclarator = (declNode) => {
      const idNode = declNode.children[0];
      const idType = idNode.type;
      if (idType === 'identifier' ||
          idType === 'field_identifier') {
        return idNode.text;
      } else if (idType === 'scoped_identifier') {
        let id = '';
        for (const kid of idNode.children) {
          if (kid.type === '::') {
            id += kid.type;
          } else { // namespace_identifier or identifier
            id += kid.text;
          }
        }
        return id;
      } else {
        console.warn('unknown declNode idNode type', idNode.type, declNode);
        throw new Error('fatal processing issue: unknown id node type');
      }
    };

    function appendToNamespace(parent, child) {
      let out = parent;
      if (parent) {
        out += '::';
      }
      out += child;
      return out;
    }

    const walk = (node, namespace) => {
      // The child node to actually recurse into.
      let walkChildrenOf = null;
      let nextNamespace = namespace;

      // Here's a switch statement where we call out the things we explicitly
      // don't care about as well as the thing we do care about.
      switch (node.type) {
        // ## RECURSIVE TYPES
        // ### Naively recurse.
        case 'translation_unit':
          walkChildrenOf = node;
          break;

        // ### Recurse with push.
        case 'namespace_definition': {
          const nsIdNode = pickChild(node, 'identifier');
          // If this is an anonymous namespace, there will be no identifier
          // node.  And it looks like searchfox doesn't create a synthetic
          // '(anonymous namespace)' identifier like gdb loves to.
          if (nsIdNode) {
            nextNamespace = appendToNamespace(nextNamespace, nsIdNode.text);
          }

          walkChildrenOf = pickChild(node, 'declaration_list');
          break;
        }

        case 'class_specifier': {
          const idNode = pickChild(node, 'type_identifier');
          if (idNode) {
            nextNamespace = appendToNamespace(nextNamespace, idNode.text);
          }

          walkChildrenOf = pickChild(node, 'field_declaration_list');
          break;
        }

        // ## PROCESS BUT DON'T RECURSE
        // For a function, one might argue we should delineate lambdas, which
        // means recursing, but let's be (unpleasantly) surprised to discover
        // we needed to recurse.
        case 'function_definition': {
          let declNode = pickChild(node, 'function_declarator');
          // tree-sitter is rightfully surprised by NS_IMETHOD and so it wraps
          // the function_declarator in an ERROR.  So we want to pierce that
          // error.
          if (!declNode) {
            const errNode = pickChild(node, 'ERROR');
            if (errNode) {
              declNode = pickChild(errNode, 'function_declarator');
            }
          }
          if (!declNode) {
            console.warn('weirdness for declNode', declNode, 'inside parent',
                         node);
          }
          const id = extractIdFromFunctionDeclarator(declNode);
          const compoundNode = pickChild(node, 'compound_statement');
          markMethodBounds(namespace, id, compoundNode);
          return;
        }

        // ## INERT BORING types
        // These are types that we don't need to bother looking in or
        // considering at all.
        case '{':
        case '}':
        case ';':
        case '\\n':
        case 'comment':
        case 'preproc_include': // contains: '#include' 'string_literal'
        case 'preproc_function_def': // contains '#define', 'identifier',
          // 'preproc_params', okay and even more.  so much more.
        case 'preproc_call': // containts 'preproc_directive', 'preproc_arg'
        // I don't believe a using declaration can impact the fully qualified
        // name of a subsequent declaration, since they're required to be fully
        // qualified if being poked into an existing namespace (from outside a
        // namespace block.).
        //
        // And we do want to skip recursing into this because the children are
        // potentially confusing to an otherwise naive traversal.  Children
        // include: 'using', 'namespace', 'scoped_identifier',
        // 'namespace_identifier', '::', 'identifier', ';'
        case 'using_declaration':
        // We don't care about variable declarations like now, although in the
        // future it's possible the RHS might be interesting.
        case 'declaration':
        // We don't care about field declarations in a class either.
        case 'field_declaration':
        // also, the access specifiers ("public","private") in a class:
        case 'access_specifier':
          return;
        // Errors are when tree-sitter can't figure out what's going on.  This
        // will frequently be something that builds on complicated macros like
        // NS_IMPL_ISUPPORTS that look something like function declarations but
        // are not.
        case 'ERROR':
          return;


        default:
          console.warn('unknown node type:', node.type, node);
          break;
      }

      if (walkChildrenOf) {
        for (const kid of walkChildrenOf.children) {
          walk(kid, nextNamespace);
        }
      }
    };

    walk(ast, '');

    return lmap;
  }

  /**
   * Fetch and process our hacky server.js's assembly of:
   * - The text source code from revision control, sans syntax highlighting.
   * - The tree-sitter AST derived from that source code.  We may not need the
   *   raw source anymore, but it might be useful for simple excerpts?
   * - Searchfox's precomputed HTML file that contains the syntax-highlighted
   *   source plus the [jumps, searches] meta-data that powers the context menu.
   *
   * The server.js has to fetch the above for us because:
   * - CORS-busting.  Although we could just reconfigure searchfox.
   * - The tree-sitter AST building is done using native node libraries.
   * All of these things can and should eventually be mooted.
   *
   * The process of analyzing the file populates the KnowledgeBase.  As the
   * KnowledgeBase wants to find out more about a symbol, it finds out the
   * file(s) that host the "def"s for the symbols and then we can analyze the
   * files.
   * TODO: That is, that will happen.  And we'll probably need to use some
   * combination of leveraging searchfox's naive header/source cross-links
   * and/or performing an extra search on class symbols in order to find the
   * potentially many files involved.  (For example, I think core PBackground
   * logic is smeared over multiple implementation files.)
   *
   * ## Wherefor tree-sitter AST?
   * The tree-sitter parse is potentially useful for a bunch of things.  For
   * now, however, all we really care about is using it to tell us the
   * boundaries of methods at a line-level granularity.  This lets us know that
   * references to functions/constructors inside a method are potential edges
   * from the method to the referenced things.
   *
   * Other things it could be used for:
   * - Simple argument analyses.  tree-sitter can tell us the argument list for
   *   a (straightforward) method invocation, which can let us distinguish
   *   between callers that explicitly pass nullptr versus a variable that might
   *   be non-null, and true vs. false or other enums.  This can help in cases
   *   of high ege-counts.
   * - Thread assertion helper analyses.  It's probably more sane to look for
   *   negations using the AST rather than using the searchfox HTML.
   */
  async analyzeFile(url) {
    const resp = await fetch(url);
    const data = await resp.json();

    // ## process the AST to get our method boundaries
    const boundsByLine = this._extractMethodBoundariesFromAST(data.ast);

    console.log('line bounds', boundsByLine);
    return;

    // NOTE this is where we're touching DOM stuff that necessitates we be on
    // the main thread.
    const parser = new DOMParser();

    // ## parse the searchfox HTML and its ANALYSIS_DATA JSON-ish struct.
    const hdoc = parser.parseFromString(data.html, "text/html");

    /**
     * This is searchfox's array of [jumps, searches] lists.  Jumps are used to
     * populate "Go to definition of" and searches are used for "Search for"
     * to search using the actual symbol.
     *
     * Each jumps array contains zero or more items of the form { pretty, sym }
     * where `sym` is the mangled symbol name and `pretty` is the unmangled
     * symbol name.  Each searches array contains zero or more items of the same
     * { pretty, sym } form except these `pretty` representations contain
     * prefixes of the form "constructor", "field", etc.
     *
     * We expect the jumps array to be empty when the token is already the
     * definition point of the symbol.  Otherwise we expect jumps and searches
     * to have the same number of entries, although their ordering may vary.
     * Multiple entries usually occur in places where a constructor is involved.
     * For example, in a constructor's initializer list for mMonitor(), mMonitor
     * will have entries for both the "field" and the "constructor".
     *
     * The items are referenced via "data-i" attributes on syntax-highlighted
     * spans for which this info is available.  Any span that has a "data-i"
     * should also have a "data-id" attribute for searchfox's "highlight"
     * functionality where other instances of the same underlying symbol will
     * be highlighted on hover or when requested via "Sticky highlight" menu
     * option.  The data-id will be the same as one of the `sym` entries; a
     * heuristic picks which and it's subject to change because it's still not
     * perfect.
     */
    let anData;
    try {
      // hdoc is a data document and doesn't have an associated window at this
      // point.  As much fun as it would be to stick it in an iframe, that's
      // asking for trouble and we can just parse the data out.
      const adScript = hdoc.querySelector('#content script');
      const adScriptStr = adScript.textContent;

      const idxFirstBracket = adScriptStr.indexOf('[');
      const idxLastBracket = adScriptStr.lastIndexOf(']');

      anData =
        JSON.parse(adScriptStr.substring(idxFirstBracket, idxLastBracket));
    } catch (ex) {
      console.warn('problem parsing out ANALYSIS_DATA:', ex);
    }

    try {
      const codePre = hdoc.querySelector('#file tbody tr td.code pre');

      for (const eLine of codePre.children) {
        // ZERO-based line number.
        const iLine = parseInt(eLine.getAttribute('aria-labelledby'), 10) - 1;

      }
    } catch (ex) {
      console.warn('problem processing searchfox html:', ex)
    }


    // ##

  }
};
