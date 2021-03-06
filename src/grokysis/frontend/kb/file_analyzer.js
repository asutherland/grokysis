function findNonWS(str) {
  const l = str.length;
  for (let i=0; i < l; i++) {
    if (str.charCodeAt(i) !== 0x20) {
      return i;
    }
  }

  return -1;
}

function stripPrettyTypePrefix(prefixedPretty) {
  const idxSpace = prefixedPretty.indexOf(' ');
  if (idxSpace === -1) {
    throw new Error('you got jumps and searches confused again');
  }
  return prefixedPretty.substring(idxSpace + 1);
}

/**
 * We could have a list of searches where one is a type and one is the
 * constructor.  For the given search entry we pick, that could have multiple
 * comma-delimited symbols where the first one is the most specific symbol and
 * the subsequent symbols are the symbols that our symbol overrides.  Or other
 * related stuff... either way the point is we're going to pick the first of
 * everything for now and look into things later on when they don't work.
 */
function pickBestSymbolFromSearches(searches) {
  if (!searches.length) {
    return null;
  }
  const bestSearch = searches[0];
  const symStr = bestSearch.sym;
  if (!symStr) {
    return null;
  }
  if (symStr.indexOf(',') !== -1) {
    return symStr.split(',', 1)[0];
  }
  return symStr;
}

export default class FileAnalyzer {
  constructor(kb) {
    this.kb = kb;
  }

  /**
   * Builds an Array where each entry corresponds to a source line.  Each entry
   * is one of the following:
   * - undefined: There's no method on the line.
   * - { type: 'def', method: methodSymbol }: The line contains the method
   *   definition prolog.
   * - { type: 'body', method: methodSymbol}: The line contains the method body
   *   for the given symbol.
   * meaning there's no enclosing method at that location and a String means the
   * line belongs to the Method with the given symbol name (suffix).  Note that
   * we don't count the declaration and its arg-list; we count from inside the
   * braced compound statement and we assume sane white-spacing.
   */
  _extractMethodBoundariesFromAST(ast) {
    // This should be a translation unit, but an outer ERROR also is possible
    // and honestly we don't really care that much.
    if (ast.type !== 'translation_unit' &&
        ast.type !== 'ERROR') {
      throw new Error('bad root AST node type: ' + ast.type);
    }
    // the rows are 0-based, so add 1 to the translation_unit node.
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
    };

    /**
     * Find the first child of node that's an identifier and that
     * extractIdFromIdentifier can provide a string for.
     *
     * This is being created to deal with struct_specifier which is showing
     * [struct scoped_type_identifier, field_declaration_list] with the scoped
     * identifier is [namespace_identifier, ::, type_identifier].  It may make
     * sense to merge with extractIdFromFunctionDeclarator somewhat, but it
     * needs more investigation or proof that it's breaking.
     */
    const pickIdentifierChild = (node) => {
      for (const kid of node.children) {
        switch (kid.type) {
          case 'identifier':
          case 'type_identifier':
          case 'scoped_type_identifier':
            return kid;
          default:
            break;
        }
      }
      return null;
    };
    // see pickIdentifierChild
    const extractIdFromIdentifier = (idNode) => {
      const idType = idNode.type;

      if (idType === 'identifier' ||
          idType === 'type_identifier') {
        return idNode.text;
      } else if (idType === 'scoped_type_identifier') {
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
        console.warn('unknown idNode type', idNode.type, idNode);
        // this happens at least for the cycle collection macros in
        // nsGlobalWindowInner where we end up with a bunch of nested
        // function_declarators whose second children are ERROR instances.
        return null;
        //throw new Error('fatal processing issue: unknown id node type');
      }
    };

    const markMethodBounds = (namespace, localId, boundingNode, type) => {
      let fullName = namespace;
      if (fullName) {
        fullName += '::';
      }
      fullName += localId;

      if (!boundingNode) {
        console.warn('trying to mark', fullName, 'with type', type,
                     'with null boundingNode');
        return;
      }

      const markingObj = { type, method: fullName };

      for (let i = boundingNode.startPosition.row;
           i <= boundingNode.endPosition.row; i++) {
        lmap[i] = markingObj;
      }
    };

    /**
     * The declarator can either be an 'identifier' or a 'scoped_identifier'.
     */
    const extractIdFromFunctionDeclarator = (declNode) => {
      let curIdx = 0;
      let idNode = declNode.children[curIdx];
      let idType = idNode.type;

      // pop type_qualifiers off the front.
      while (idType === 'type_qualifier') {
        idNode = declNode.children[++curIdx];
        idType = idNode.type;
      }

      // destructors wrap 2 children with type "~" and identifier.
      if (idType === 'destructor_name') {
        return idNode.children[0].type + idNode.children[1].text;
      } else if (idType === 'operator_name') {
        return idNode.text;
      } else if (idType === 'identifier' ||
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
        // this happens at least for the cycle collection macros in
        // nsGlobalWindowInner where we end up with a bunch of nested
        // function_declarators whose second children are ERROR instances.
        return null;
        //throw new Error('fatal processing issue: unknown id node type');
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
      // Or if there's a specific child or slice...
      let walkSlice = null;
      let nextNamespace = namespace;

      // Here's a switch statement where we call out the things we explicitly
      // don't care about as well as the thing we do care about.
      switch (node.type) {
        // ## RECURSIVE TYPES
        // ### Naively recurse.
        // Errors are full of interesting stuff, keep going.
        case 'ERROR':
        case 'translation_unit':
          walkChildrenOf = node;
          break;

        // ### Targeted recursion
        case 'preproc_if': // [#if, preproc_arg, SUBTREE..., #endif]
        case 'preproc_ifdef': {
          // [type=#ifdef, identifier, SUBTREE..., type=#endif]
          walkSlice = node.children.slice(2, -1);
          break;
        }

        case 'template_declaration': {
          // [template, template_parameter_list, SUBTREE]
          // There will also be template things mixed in in the child.
          walkSlice = node.children.slice(2);
          break;
        }

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

        case 'struct_specifier':
        case 'class_specifier': {
          const idNode = pickIdentifierChild(node);
          if (idNode) {
            nextNamespace = appendToNamespace(nextNamespace,
                                              extractIdFromIdentifier(idNode));
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
          // This could also be a pointer_declarator wrapping the underlying
          // function_declarator
          if (!declNode) {
            const ptrNode = pickChild(node, 'pointer_declarator');
            if (ptrNode) {
              declNode = pickChild(ptrNode, 'function_declarator');
            }
          }
          if (!declNode) {
            console.warn('weirdness for declNode', declNode, 'inside parent',
                         node);
            // XXX if we end up here, we're going to fail.  just return.
            return;
          }
          const id = extractIdFromFunctionDeclarator(declNode);
          if (!id) {
            return;
          }
          const compoundNode = pickChild(node, 'compound_statement');
          // mark the definition first, as it will be a superset of the body...
          markMethodBounds(namespace, id, node, 'def');
          // ...then mark the body.  Note that this could leave some def lines
          // trailing the 'body' lines, so the code that processes us needs to
          // know to ignore such things.
          markMethodBounds(namespace, id, compoundNode, 'body');
          return;
        }

        // ## INERT BORING types
        // These are types that we don't need to bother looking in or
        // considering at all.
        case '*':
        case '<':
        case '>':
        case '(':
        case ')':
        case '{':
        case '}':
        case ';':
        case ':':
        case '\\n':
        case 'comment':
        case 'alias_declaration': // [using, type_identifier, =, type_descriptor, ;]
          // ^ similar to linkage_specification for externs below, this is flat
          // and searchfox has the info level we need.
        case 'linkage_specification': // [extern, string_literal, declaration]
          // ^ the externs are flat so we don't need to recurse into them.  The
          // searchfox analysis is sufficient.
        case 'preproc_include': // contains: '#include' 'string_literal'
        case 'preproc_def': // [#define, identifier, preproc_arg, |n]
        case 'preproc_function_def': // contains '#define', 'identifier',
          // 'preproc_params', okay and even more.  so much more.
        case 'preproc_call': // containts 'preproc_directive', 'preproc_arg'
        // These may be preprocessor directives that failed to parse and that we
        // traversed into due to an ERROR
        case '#ifdef':
        case '#endif':
        // Similar issue for these:
        case 'private':
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
        // various low-level things:
        case 'identifier':
        case 'primitive_type':
        case 'type_identifier':
          return;

        default:
          console.warn('unknown node type:', node.type, node);
          break;
      }

      if (walkChildrenOf) {
        for (const kid of walkChildrenOf.children) {
          walk(kid, nextNamespace);
        }
      } else if (walkSlice) {
        for (const kid of walkSlice) {
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
  async analyzeFile(finfo, data) {
    // ## process the AST to get our method boundaries
    let boundsByLine;
    if (data.ast) {
      boundsByLine = this._extractMethodBoundariesFromAST(data.ast);
    }

    console.log('line bounds', boundsByLine);

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
     * should also have a "data-symbols" attribute for searchfox's "highlight"
     * functionality where other instances of the same underlying symbol(s) will
     * be highlighted on hover or when requested via "Sticky highlight" menu
     * option.  (Note: "data-symbols" was previously "data-id" which was
     * heuristically chosen to be one of the the symbols.  We never used
     * "data-id" because the heuristic was not helpful to our analysis, and
     * "data-symbols" is redundant.
     */
    let anData;
    /**
     * This is a processed version of the above is a filtered version of each
     * `jumps` so that only entries corresponding to potential calls remain.
     */
    let callDex;
    try {
      // hdoc is a data document and doesn't have an associated window at this
      // point.  As much fun as it would be to stick it in an iframe, that's
      // asking for trouble and we can just parse the data out.
      const adScript = hdoc.querySelector('#content script');
      const adScriptStr = adScript.textContent;

      const idxFirstBracket = adScriptStr.indexOf('[');
      const idxLastBracket = adScriptStr.lastIndexOf(']');

      // ## Process ANALYSIS_DATA to populate callDex.
      anData =
        JSON.parse(adScriptStr.substring(idxFirstBracket, idxLastBracket + 1));

      callDex = new Array(anData.length);
      for (let iSym=0; iSym < anData.length; iSym++) {
        const [jumps, searches] = anData[iSym];
        if (!jumps || !jumps.length || jumps.length !== searches.length) {
          continue;
        }
        let use = null;
        for (let i=0; i < jumps.length; i++) {
          const jump = jumps[i];
          const search = searches[i];
          const type = search.pretty.split(' ', 1)[0];
          switch (type) {
            default:
              console.warn('unsupported symbol type:', type);
              continue;
            case 'constructor':
            case 'destructor':
            case 'function':
              // do use, fall out.
              break;
            // These are the ones not to use, so we continue the loop.
            case 'type':
            case 'macro':
            case 'field':
            case 'variable':
            case 'enum':
              continue;
          }

          if (!use) {
            use = [];
          }
          use.push(jump);
        }
        callDex[iSym] = use;
      }
    } catch (ex) {
      console.warn('problem parsing out ANALYSIS_DATA:', ex);
    }

    try {
      const codePre = hdoc.querySelector('#file tbody tr td.code pre');
      finfo.sourceFragment = new DocumentFragment();
      // We want to be able to show the entire file source.  The individual
      // SymInfo.sourceFragment DocumentFragments steal the lines, so it's up
      // to us to clone here.
      finfo.sourceFragment.appendChild(codePre.cloneNode(true));

      // ## Process the HTML along method boundaries.
      // Snapshot the children so we can mutate the DOM, re-parenting the lines
      // into per-method fragments without confusing ourselves when debugging.
      const frozenChildren = Array.from(codePre.children);
      const allSynLines = finfo.lineToSymbolBounds =
        new Array(frozenChildren.length);
      const dataIndexToSymbolBounds = finfo.dataIndexToSymbolBounds =
        new Array(anData.length);

      // AST-aware processing state that is used to detect transitions from the
      // previous boundsByLine value.
      let curMethod = null; // current method symbol name
      let curSym = null; // the SymbolInfo for that method.
      let curLineObj = null;
      let curFragment = null;

      for (const eLine of frozenChildren) {
        // ZERO-based line number.
        const iLine = parseInt(eLine.getAttribute('aria-labelledby'), 10) - 1;
        const synLine = allSynLines[iLine] = [];

        // ## Perform AST-ignorant searchfox line-symbol extraction.
        // Populate the file's lineToSymbolBounds.

        // ### Saved off for the benefit of the AST-aware logic below.
        // Array of values from callDex.  This has to be an array because a
        // single line can contain multiple call-related uses.
        let lineCallJumps;
        // This is just a single def's `searches` Array.  It's a single one
        // because we are using this as a hacky way to bridge the raw symbol
        // corresponding to the method definition to the AST logic below without
        // getting caught up in exact token match-ups.  We may need to do the
        // exact match-up, but for our hack, we only want the last def because
        // we're sane white-spacing/etc.
        let lastDefSearches;

        // We only care about non-local symbols, which means only elements with
        // a "data-i" attribute.  However, we do also care about text offsets,
        // so we do need to process all nodes, not just elements with a data-i
        // attribute.
        let offset = 0;
        let firstTextOffset = -1;
        for (const nKid of eLine.childNodes) {
          if (nKid.nodeType !== 1 && nKid.nodeType !== 3) {
            continue;
          }

          const textContent = nKid.textContent;
          const tcLen = textContent.length;

          if (firstTextOffset === -1) {
              const iNonWS = findNonWS(textContent);
              if (iNonWS !== -1) {
                firstTextOffset = offset + iNonWS;
              }
          }

          // element, therefore data-i is possible.
          if (nKid.nodeType === 1) {
            if ('i' in nKid.dataset) {
              const jumpIdx = parseInt(nKid.dataset.i, 10);
              // save these for processing in the AST-aware logic below.
              const callJumps = callDex[jumpIdx];
              if (callJumps) {
                if (!lineCallJumps) {
                  lineCallJumps = [];
                }
                lineCallJumps.push(callJumps);
              }

              const [jumps, searches] = anData[jumpIdx];
              // Resolve the symbol and put it in the per-line symbol list.
              const isDef = jumps.length === 0; // defs have no jumps.
              // XXX hack here to avoid getting tricked by types that we don't
              // have jumps for.  This works unconscionably well.
              if (isDef && !searches[0].pretty.startsWith('type ')) {
                lastDefSearches = searches;
              }
              // Okay, right, so there may be multiple search entries, and these
              // may in fact have multiple comma-delimited symbols in the 'sym'
              // field.  We punt to the helper below and its hand-waving.
              const bestRawSym = pickBestSymbolFromSearches(searches);
              if (bestRawSym) {
                const synSym = this.kb.lookupRawSymbol(bestRawSym, false);
                const symBounds = {
                  bounds: [offset, offset + tcLen],
                  type: isDef ? 'def' : 'use',
                  symInfo: synSym
                };
                synLine.push(symBounds);
                dataIndexToSymbolBounds[jumpIdx] = symBounds;
              }
            }
          }

          offset += tcLen;
        }

        // ## AST-aware line processing
        if (!boundsByLine) {
          continue;
        }

        const newLineObj = boundsByLine[iLine];
        // A change in object signifies either entering/leaving a method def or
        // its body.
        if (newLineObj !== curLineObj) {
          // falsey means exiting back to not inside a method at all.
          if (!newLineObj) {
            curMethod = null;
            if (curSym) {
              curSym.markDirty();
            }
            curSym = null;
            curFragment = null;
          } else {
            const newType = newLineObj.type;
            const newMethod = newLineObj.method;
            if (newType === 'def') {
              if (newMethod === curMethod) {
                // okay, so we probably are just encountering some post-body
                // definition lip.  We want to ignore this, but we want to make
                // sure that we handle a multi-line lip, so null out only the
                // symbol
                if (curSym) {
                  curSym.markDirty();
                }
                curSym = null;
              } else {
                // Okay, this is not the method we were processing, so let's
                // process the def for real.
                curMethod = newMethod;
                curFragment = new DocumentFragment();
                curSym = null;
                // (fall-through)
              }
            } else {
              // Okay, now we're switching to the body.
              if (!curSym) {
                console.log('sketchy: left', curMethod, 'def without curSym');
              }
            }
          }

          curLineObj = newLineObj;
        }

        if (curMethod) {
          // There is a method and we're still processing it.

          // This line also gets displayed in our syntax highlighted source...
          curFragment.appendChild(eLine);

          if (!curSym && newLineObj.type === 'def' && lastDefSearches) {
            // NB: this probably wants its own helper; our intent here is very
            // different from our intent above.
            const rawSym = pickBestSymbolFromSearches(lastDefSearches);
            // and our direct lastDefSearches[0] accordingly assumes the impl.
            curSym = this.kb.lookupRawSymbol(
              rawSym, false, stripPrettyTypePrefix(lastDefSearches[0].pretty),
              { sourcePath: finfo.path });
            curSym.sourceFragment = curFragment;
            curSym.sourceFileInfo = finfo;

            finfo.fileSymbolDefs.add(curSym);
          }

          if (curSym && newLineObj.type === 'body' && lineCallJumps) {
            for (const jumps of lineCallJumps) {
              // NB: pretty is also included here
              for (const { sym, pretty } of jumps) {
                let prevSymbols = [];
                for (const rawSym of sym.split(',')) {
                  const linkedSym =
                    this.kb.lookupRawSymbol(rawSym, false, pretty);
                  curSym.callsOutTo.add(linkedSym);
                  linkedSym.receivesCallsFrom.add(curSym);
                  for (const prevSym of prevSymbols) {
                    prevSym.superSymbols.add(linkedSym);
                    linkedSym.subSymbols.add(prevSym);
                  }
                  prevSymbols.push(linkedSym);
                }
              }
            }
          }
        }
      }

      if (curSym) {
        curSym.markDirty();
      }
    } catch (ex) {
      console.warn('problem processing searchfox html:', ex);
    }

    return finfo;
  }
}
