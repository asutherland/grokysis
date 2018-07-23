/**
 * Receives search results from the main thread and attempt to create a
 * diagrammatic representation of the results as an SVG.  See docs/diagram.md
 * for more context and information.
 **/

importScripts("/static/js/libs/viz.js");
function processMessage(event) {
  var message = event.data;
  if (message.type === "results")  {
    deriveDiagram(message.results);
  }
}
self.addEventListener("message", processMessage);

/**
 * Represents a class/interface which has one or more methods/fields.  Nested
 * classes are their own things, although they could be potentially grouped
 * together in a subgraph based on file-system hierarchy or C++ namespaces.
 *
 * Each method/field has a separately tracked declaration/definition slot.
 */
function DiagramClass(namespace, className, qname) {
  this.namespace = namespace;
  this.name = className;
  this.qname = qname;

  // TODO: slurp the general path info into here from when our slots get a
  // definition/declaration.
  this.filename = null;
  this.path = null;
  this.pathParts = null;

  this._slotsByName = new Map();
  // Maintain list of slot names so that we can easily sort. when rendering to
  // dot.  If we assumed or polyfilled Array.from, we wouldn't need this.
  this._slotNames = [];
}
DiagramClass.prototype = {
  maybeUsePathInfo: function(path, lineInfo) {
    if (!this.filename) {
      var iLastSlash = path.lastIndexOf('/');
      this.path = path.substring(0, iLastSlash);
      this.pathParts = this.path.split('/');
      this.filename = path.substring(iLastSlash + 1);
    }
  },

  /**
   * Get-or-create the DiagramClassSlot with the given name.  null is an
   * acceptable name for cases where we aren't dealing with a class but a
   * standalone function/method.  The null name is treated as using the class
   * name row.
   */
  ensureSlot: function(slotName) {
    var slot = this._slotsByName.get(slotName);
    if (slot) {
      return slot;
    }

    // Figure out a port identifier for the slot.  We use the scheme "p#"
    // because:
    // - The scheme makes reading the dot file a little nicer.  TBD whether
    //   this matters.
    // - We eventually want to properly handle the overloaded method case
    //   correctly (when we can get the mangled name), so we want to be using
    //   something other than the raw name anyways.  (And the mangled names are
    //   horrible to read, so something like this works.)
    //
    // The one important thing is that we want
    var port;
    if (slotName === null) {
      port = "p0";
    } else {
      port = "p" + (this._slotNames.length + 1);
    }
    slot = new DiagramClassSlot(this, port, slotName);
    this._slotsByName.set(slotName, slot);
    // the magic null slot doesn't go in the name list.
    if (slotName !== null) {
      this._slotNames.push(slotName);
    }

    return slot;
  },
  toDot: function() {
    // Sort the slot names so that we can render the slots in alphabetical
    // order.
    this._slotNames.sort();

    var dot = '  "' + this.qname + '" [label=< ';
    dot += '<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="2">\n';

    // - context row

    var anyContext = false;
    function emitContext(str) {
      if (str) {
        if (anyContext) {
          dot += '<BR>';
        } else {
          dot += '  <TR><TD ALIGN="LEFT" BORDER="0"><FONT COLOR="#444444" POINT-SIZE="10">';
        }
        dot += str;
        anyContext = true;
      }
    }
    emitContext(this.filename);
    if (anyContext) {
      dot += '</FONT></TD></TR>\n';
    }

    // - class row
    // Ugh, putting whitespace in there to compensate for bolding causing
    // overflow.  Probably need to add an attribute or font guidance or
    // something.
    dot += '  <TR><TD ALIGN="LEFT" PORT="p0"><B>' + this.name + '     </B></TD></TR>\n';

    for (var iSlot = 0; iSlot < this._slotNames.length; iSlot++) {
      var slot = this._slotsByName.get(this._slotNames[iSlot]);
      dot += slot.toDot();
    }

    dot += '</TABLE>>];\n';
    return dot;
  }
};

function DiagramClassSlot(owner, port, name) {
  this.owner = owner;
  this.port = port;
  this.name = name;
  this.declarationLineInfo = null;
  this.definitionLineInfo = null;
}
DiagramClassSlot.prototype = {
  markDeclaration: function(path, lineInfo) {
    this.owner.maybeUsePathInfo(path, lineInfo);
  },

  markDefinition: function(path, lineInfo) {
    this.owner.maybeUsePathInfo(path, lineInfo);
  },

  markUse: function(path, lineInfo) {
    this.owner.maybeUsePathInfo(path, lineInfo);
  },

  toDot: function() {
    return '  <TR><TD ALIGN="LEFT" PORT="' + this.port + '">' + this.name + '</TD></TR>\n';
  }
};

/**
 * Regexp to help us to split an unmangled C++ symbol into namespace, class
 * name, and method/field name.  Because we don't actually have the real
 * information available to us to know what's what, we rely on the convention
 * that classes
 */
var RE_CPP_SYMBOL = /^([\w() ]+::)*(\w+)::([\w~]+)$/;
var RE_STARTSWITH_LOWER = /^[a-z]/;
var RE_STD_CLASS_PREFIX = /^ns|moz/;
var RE_JS_SYMBOL = /^(\w+#)*(\w+)#(\w+)$/;

/**
 * Diagram builder, directly driven by deriveDiagram to create and link
 * DiagramNodes and then produce a dot file.
 */
function DiagramSpace() {
  this._classesByName = new Map();
  this._edges = [];
}
DiagramSpace.prototype = {
  /**
   * Retrieve the DiagramClass for the given symbol, or create it if it doesn't
   * exist.
   */
  _ensureClassAndSlot: function(symbol, path) {
    var isJS = /\.js$/.test(path);

    // Break up the symbol into namespace, className, and methodName components
    // on a best-effort basis.  Consider having the server give us more
    // information if this gets any uglier.
    var namespace, className, methodName, match;
    if (isJS) {
      match = RE_JS_SYMBOL.exec(symbol);
      if (match) {
        namespace = match[1] || null;
        className = match[2];
        methodName = match[3];
      } else {
        namespace = null;
        className = symbol;
        methodName = null;
      }
    } else {
      match = RE_CPP_SYMBOL.exec(symbol);
      if (match) {
        namespace = match[1] || null;
        // If the class name starts with lowercase then we may be getting faked
        // out by a namespace unless it's an expected prefix.
        if (RE_STARTSWITH_LOWER.test(match[2]) &&
            !RE_STD_CLASS_PREFIX.test(match[2])) {
          if (namespace) {
            namespace += match[2] + "::";
          } else {
            namespace = match[2];
          }
          className = match[3];
          methodName = null;
        } else {
          className = match[2];
          methodName = match[3];
        }
      } else {
        namespace = null;
        className = symbol;
        methodName = null;
      }
    }

    // Now rebuild the qualified className for keying purposes to avoid
    // collisions.
    var qname;
    if (namespace) {
      qname = namespace + className;
    } else {
      qname = className;
    }

    var dclass = this._classesByName.get(qname);
    if (!dclass) {
      dclass = new DiagramClass(namespace, className, qname);
      this._classesByName.set(qname, dclass);
    }

    // It's okay for methodName to be null here.  A magic slot is created.
    return dclass.ensureSlot(methodName);
  },

  _ensureEdge: function(sourceSlot, targetSlot) {
    this._edges.push({ source: sourceSlot, target: targetSlot });
  },

  addDeclarations: function(symbol, fileResults) {
    for (var iFile=0; iFile < fileResults.length; iFile++) {
      var path = fileResults[iFile].path;
      var lines = fileResults[iFile].lines;
      for (var iLine = 0; iLine < lines.length; iLine++) {
        var lineInfo = lines[iLine];

        var slot = this._ensureClassAndSlot(symbol, path);
        slot.markDeclaration(path, lineInfo);
      }
    }
  },

  addIDLs: function(symbol, fileResults) {
    for (var iFile=0; iFile < fileResults.length; iFile++) {
      var path = fileResults[iFile].path;
      var lines = fileResults[iFile].lines;
      for (var iLine = 0; iLine < lines.length; iLine++) {
        var lineInfo = lines[iLine];

        var slot = this._ensureClassAndSlot(symbol, path);
        slot.markDeclaration(path, lineInfo);
      }
    }
  },

  addDefinitions: function(symbol, fileResults) {
    for (var iFile=0; iFile < fileResults.length; iFile++) {
      var path = fileResults[iFile].path;
      var lines = fileResults[iFile].lines;
      for (var iLine = 0; iLine < lines.length; iLine++) {
        var lineInfo = lines[iLine];

        var slot = this._ensureClassAndSlot(symbol, path);
        slot.markDefinition(path, lineInfo);
      }
    }
  },

  /**
   *
   */
  addUses: function(symbol, fileResults) {
    // Note that the path here corresponds to the usage, not the target symbol,
    // but we're just using it for language hinting anyways.
    var targetSlot = this._ensureClassAndSlot(symbol, path);

    for (var iFile=0; iFile < fileResults.length; iFile++) {
      var path = fileResults[iFile].path;
      var lines = fileResults[iFile].lines;
      for (var iLine = 0; iLine < lines.length; iLine++) {
        var lineInfo = lines[iLine];

        var sourceSlot = this._ensureClassAndSlot(lineInfo.context, path);
        sourceSlot.markUse(path, lineInfo);
        this._ensureEdge(sourceSlot, targetSlot);
      }
    }
  },

  _renderEdge: function(edge) {
    return '"' + edge.source.owner.qname + '":' + edge.source.port + ':e -> ' +
           '"' + edge.target.owner.qname + '":' + edge.target.port + ':w;\n';
  },

  renderToDot: function() {
    var dot = "digraph outer {\n  node [shape=plaintext fontsize=12]\n";

    var clusterer = new SubgraphClusterer();
    for (var dclass of this._classesByName.values()) {
      clusterer.addClustered(dclass.pathParts, dclass);
    }
    dot += clusterer.renderToDot('/');

    for (var edge of this._edges) {
      dot += this._renderEdge(edge);
    }

    dot += "}";
    return dot;
  }
};

/**
 * Helper to cluster dot snippets inside subgraphs.
 */
function SubgraphClusterer() {
  this.root = { kids: new Map(), items: [] };
}
SubgraphClusterer.prototype = {
  addClustered: function(pathParts, item) {
    var cur = this.root;
    if (pathParts) {
      for (var i=0; i < pathParts.length; i++) {
        var part = pathParts[i];
        var next = cur.kids.get(part);
        if (!next) {
          next = { kids: new Map(), items: [] }
          cur.kids.set(part, next);
        }
        cur = next;
      }
    }
    cur.items.push(item);
  },

  renderToDot: function(delim) {
    var dot = "";
    var numClusters = 0;

    function traverse(branch, parts) {
      // We need to emit a subgraph if we have any items at this level or
      // multiple child branches.
      var emitThis = (branch.items.length || branch.kids.size > 1);

      var recurseParts;
      if (emitThis) {
        var curPath = parts.join(delim);
        dot += "subgraph cluster" + (numClusters++) + " {\n";
        dot += 'label="' + curPath + '"\n';
        recurseParts = [];
      } else {
        recurseParts = parts;
      }

      for (var keyPair of branch.kids) {
        var part = keyPair[0];
        var kidBranch = keyPair[1];
        traverse(kidBranch, recurseParts.concat(part));
      }

      for (var i=0; i < branch.items.length; i++) {
        var item = branch.items[i];
        dot += item.toDot() + "\n";
      }

      if (emitThis) {
        dot += "}\n"; // close subgraph
      }
    }
    traverse(this.root, []);

    return dot;
  }
};

/**
 * Process the search results into a diagram.  Note that the results as provided
 * are somewhat pre-chewed.  For example, the keys under generated/normal are of
 * the form "Kind (Symbol)" like "Uses (nsDocShell::Foo)".
 *
 * Here"s what we do based on different kinds:
 * - "Uses (Target)": We use each lines" "context" source symbol to create a
 *   directed edge from the context to the target.  The source/target nodes are
 *   created on-demand.
 * - "Declarations/Definitions/IDL (Symbol)": We create nodes for the given
 *   symbols on demand.  We track declarations and definitions separately so
 *   that the output graph can provide separate links for each.
 */
function deriveDiagram(results, epoch) {
  var diagram = new DiagramSpace();

  function chewQKinds(qkinds) {
    if (!qkinds) {
      return;
    }

    for (var qk in qkinds) {
      var value = qkinds[qk];
      var symbol;

      // Discriminate based on the 3rd letter which varies over all types.
      switch (qk[2]) {
        case "c": // "Declarations (".length === 14
          symbol = qk.slice(14, -1);
          diagram.addDeclarations(symbol, value);
          break;
        case "f": // "Definitions (".length === 13
          symbol = qk.slice(13, -1);
          diagram.addDefinitions(symbol, value);
          break;
        case "e": // "Uses (".length === 6
          symbol = qk.slice(6, -1);
          diagram.addUses(symbol, value);
          break;
        case "s": // "Assignments (".length === 13
          // Someone with a setter-based API might care about this.  We do not.
          continue;
        case "L": // "IDL (".length === 5
          symbol = qk.slice(5, -1);
          diagram.addIDLs(symbol, value);
          break;
      }
    }
  }

  chewQKinds(results.normal);

  var dotStr = diagram.renderToDot();
  postMessage({ type: "debug", dotStr: dotStr });

  // Engine-wise, dot and fdp both work for our needs.  dot uses a simpler
  // layout strategy which, combined with clever edges, can look great.
  // However, the simple horizontal layout strategy can result in a very wide
  // layout because edges are required between nodes for them to be placed
  // vertically beneath nodes.  It then becomes advisable to use "fdp" in those
  // cases.
  //
  // The right course of action might be to have the search page tell us how
  // wide a display area it has.  We perform layout with dot and extract the
  // width.  If it's wider than the display area, we re-run with fdp.
  //
  // But for now we just use fdp all the time.

  var svgDoc = Viz(dotStr, { format: "svg", engine: "fdp", }); // was: dot
  // get rid of the document bits; we just want to inject the svg directly into
  // the document on the other side, not an iframe.
  var svgStr = svgDoc.slice(svgDoc.indexOf('<svg'));

  postMessage({ type: "svg", epoch: epoch, svgStr: svgStr });
}
