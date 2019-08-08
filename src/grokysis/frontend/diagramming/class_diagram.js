import EE from 'eventemitter3';

const INDENT = '  ';

// https://graphics.stanford.edu/~seander/bithacks.html via
// https://stackoverflow.com/questions/43122082/efficiently-count-the-number-of-bits-in-an-integer-in-javascript
function bitCount (n) {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return ((n + (n >> 4) & 0xF0F0F0F) * 0x1010101) >> 24;
}

/**
 * Helper to cluster dot snippets inside subgraphs.
 */
class HierNode {
  constructor(parent, name, depth) {
    this.name = name;
    this.depth = depth;
    this.parent = parent;

    this.sym = null;
    this.altSyms = null;
    /**
     * One of:
     * - collapse: Collapse this node into its child.
     * - cluster: be a graphviz cluster
     * - table: be a table and therefore all children are records
     * - record: are a record because the parent is a table.
     * - node: Just be a node.
     */
    this.action = null;
    /**
     * Whenever a node collapses itself into its child, it accumulates itself
     * and its own value of this into its child.
     */
    this.collapsedAncestors = [];

    this.kids = new Map();

    // The graphviz id for this hierarchy node.
    this.id = '';
    // The graphviz id to use for incoming edges.  This matters for ports.
    this.edgeInId = '';
    // The graphviz id to use for outgoing edges.  This matters for ports.
    this.edgeOutId = '';

    /**
     * List of { from, to } objects where from and to are both HierNodes.
     */
    this.edges = [];
    this.descendantEdgeCount = 0;
  }

  getOrCreateKid(name) {
    let kid = this.kids.get(name);
    if (kid) {
      return kid;
    }
    kid = new HierNode(this, name, this.depth + 1);
    this.kids.set(name, kid);
    return kid;
  }

  updateSym(sym) {
    if (!sym) {
      return;
    }
    // It can easily happen that multiple underlying symbols maps to the same
    // pretty/de-mangled name.  Just stash the alternate syms for now.
    if (this.sym) {
      if (!this.altSyms) {
        this.altSyms = [sym];
      } else {
        this.altSyms.push(sym);
      }
      console.warn('trying to clobber existing', this.sym, 'with', sym);
      return;
    }
    this.sym = sym;
  }

  /**
   * Logic around collapsedAncestors, re-joining with delimiters.  Ideally this
   * would be much smarter with us having better symbolic information at each
   * level of hierarchy.
   */
  computeLabel() {
    if (this.collapsedAncestors && this.collapsedAncestors.length) {
      return this.collapsedAncestors.join('::') + '::' + this.name;
    } else {
      return this.name;
    }
  }
}

class HierBuilder {
  constructor() {
    this.root = new HierNode(null, '', 0);
    this.symsToHierNodes = new Map();

    this.idCounter = 0;
  }

  /**
   * Create a HierNode wrapping the provided symbol, returning the provided
   * hierNode.
   */
  addNode(sym) {
    const pathParts = sym.fullyQualifiedParts;

    let cur = this.root;
    if (pathParts) {
      for (const part of pathParts) {
        cur = cur.getOrCreateKid(part);
      }
    }

    cur.updateSym(sym);

    this.symsToHierNodes.set(sym, cur);
  }

  _findCommonAncestor(fromNode, toNode) {
    // special-case self-edges to go in their parent.
    if (fromNode === toNode) {
      // only walk up if we're not somehow at the root.
      if (fromNode.parent) {
        return fromNode.parent;
      }
      return fromNode;
    }

    // Walk both nodes up to be at the same depth.
    const sameDepth = Math.min(fromNode.depth, toNode.depth);
    let curFromNode = fromNode;
    let curToNode = toNode;

    while (curFromNode.depth > sameDepth) {
      curFromNode = curFromNode.parent;
    }
    while (curToNode.depth > sameDepth) {
      curToNode = curToNode.parent;
    }

    // Now that both nodes are at the same level of depth, we're already in the
    // same ancestor, or we keep walking up in lock-step until we find an
    // ancestor or we encounter the root node.
    while (curFromNode !== curToNode && curFromNode.parent) {
      curFromNode = curFromNode.parent;
      curToNode = curToNode.parent;
    }

    return curFromNode;
  }

  /**
   * Create an edge between two symbols.
   */
  addEdge(fromSym, toSym) {
    const fromNode = this.symsToHierNodes.get(fromSym);
    const toNode = this.symsToHierNodes.get(toSym);

    const ancestorNode = this._findCommonAncestor(fromNode, toNode);

    ancestorNode.edges.push({ from: fromNode, to: toNode });
    // Make sure the containing node and all its parents have accurate counts
    // of the total number of edges they contain.  This is used by the action
    // heuristics.
    for (let node = ancestorNode; node; node = node.parent) {
      node.descendantEdgeCount++;
    }
  }

  _determineNodeAction(node, classAncestor, inTable) {
    const isRoot = node.parent === null;

    // If the node has only one child and no edges, we can collapse it UNLESS
    // the child is a class, in which case we really don't want to.
    if (!isRoot && !inTable &&
        node.kids.size === 1 && node.edges.length === 0) {
      const soleKid = Array.from(node.kids.values())[0];

      // The child's needs impact our ability collapse:
      // - If the kid is a class, don't collapse into it.  (Classes can still
      //   be clusters, but the idea is they should/need to be distinguished
      //   from classes.)
      if (!soleKid.sym || !soleKid.sym.isClass) {
        node.id = node.edgeInId = node.edgeOutId = '';
        node.action = 'collapse';
        soleKid.collapsedAncestors = node.collapsedAncestors.concat(node);
        this._determineNodeAction(soleKid, false);
        return;
      }
    }

    const isClass = node.sym && node.sym.isClass;
    let beClass = classAncestor || isClass;
    let beInTable = inTable;

    if (isRoot) {
      node.action = 'flatten';
      node.id = node.edgeInId = node.edgeOutId = '';
    }
    else if (inTable) {
      // there are no more decisions to make if we're in a table; we're a record
      node.action = 'record';
      // and we must shunt our edges to our table's parent.
      inTable.parent.edges.push(...node.edges);
      node.edges = null;

      node.id = 'p' + (this.idCounter++);
      node.edgeInId = node.id + ':w';
      node.edgeOutId = node.id + ':e';
    }
    // If things have collapsed into us or there are edges at our level, we
    // need to be a cluster.
    else if (node.collapsedAncestors.length || node.edges.length > 0) {
      node.action = 'cluster';
      node.id = 'cluster_c' + (this.idCounter++);
      node.edgeInId = node.edgeOutId = node.id;
    }
    // If the number of internal edges are low and we've reached a class AND
    // there are children, then we can switch to being a table.
    else if (beClass && (node.descendantEdgeCount < 5) && node.kids.size) {
      node.action = 'table';
      beInTable = node;
      node.id = 't' + (this.idCounter++);
      const slotId = node.id += 's0';
      node.edgeInId = slotId + ':w';
      node.edgeOutId = slotId + ':e';
    }
    // If there are kids, we want to be a cluster after all.
    else if (node.kids.size > 0) {
      node.action = 'cluster';
      node.id = 'cluster_c' + (this.idCounter++);
      node.edgeInId = node.edgeOutId = node.id;
    }
    // And if there were no kids, we should just be a standard node.
    else {
      node.action = 'node';
      node.id = 'n' + (this.idCounter++);
      node.edgeInId = node.edgeOutId = node.id;
    }

    for (const kid of node.kids.values()) {
      this._determineNodeAction(kid, beClass, beInTable);
    }
  }

  determineNodeActions() {
    this.idCounter = 1;
    this._determineNodeAction(this.root, false, null);
    console.log('root node of graph post-determine:', this.root);
  }

  _renderNode(node, indentStr) {
    let s = '';

    let kidIndent = indentStr;
    let wrapEnd = '';
    if (node.action === 'collapse') {
      const soleKid = Array.from(node.kids.values())[0];
      return this._renderNode(soleKid, indentStr);
    } else if (node.action === 'cluster') {
      s += indentStr + `subgraph ${node.id} {\n`;
      kidIndent += INDENT;
      s += kidIndent + `label = "${node.computeLabel()}";\n\n`;
      wrapEnd = indentStr + '}\n';
    } else if (node.action === 'table') {
      s += indentStr + `${node.id} [label=<<table border="0" cellborder="1" cellspacing="0" cellpadding="4">\n`;
      kidIndent += INDENT;
      s += kidIndent + `<tr><td port="${node.id}s0">${node.name}</td></tr>\n`;
      wrapEnd = indentStr + `</table>>];\n`;
    } else if (node.action === 'record') {
      // XXX tables can potentially have more than 1 level of depth; we need
      // to be doing some type of indentation or using multiple columns/etc.
      // XXX we want to do some additional label styling...
      s += indentStr + `<tr><td port="${node.id}">${node.name}</td></tr>\n`;
      // this is a stop-gap to visually show when we're screwing up in the output.
      kidIndent += INDENT;
    } else if (node.action === 'node') {
      s += indentStr + `${node.id} [label="${node.name}"];\n`;
    } // else 'flatten'

    for (const kid of node.kids.values()) {
      s += this._renderNode(kid, kidIndent) + '\n';
    }

    // node.edges may be null if shunted to the parent in the 'record' case.
    if (node.edges) {
      s += '\n';
      for (const { from, to } of node.edges) {
        // HACK: Don't expose edges to the root node.
        // This is a scenario that happens when clicking on a class Type because
        // all of the members end up referring to the Type itself.
        if (!from.edgeOutId || !to.edgeInId) {
          continue;
        }
        s += kidIndent + from.edgeOutId + ' -> ' + to.edgeInId + ';\n';
      }
    }

    s += wrapEnd;

    return s;
  }

  renderToDot() {
    const dotBody = this._renderNode(this.root, INDENT);
    const dot = `digraph G {
  newrank = true;
  rankdir = "LR";
  fontname = "Arial";
  splines = spline;

  node [shape=none, fontname="Arial", fontsize=10, colorscheme=pastel28];
  edge [arrowhead=open];

  ${dotBody}
}`;

    return dot;
  }
}

/**
 * High level class diagram abstraction used to idempotently expose class
 * structure and edges between methods.
 *
 * Understands a hierarchy that goes roughly:
 * - namespace / file path: We frequently like to cluster by namespaces or
 *   implementation directories.
 * - class: Classes frequently want to be a record-style display where its
 *   methods are their own rows.
 * - (inner class): There may also be inner classes; I think in this case, we
 *   want to cluster with the parent class, as it's usually the case that the
 *   inner class is an important implementation detail but that trying to
 *   expose it on the class proper will be too much.
 * - method: Methods usually like to be rows on the class record.
 * - state-condition of method: Methods may want to be further sub-divided if
 *   they can easily be broken down into switch() blocks or other mutually
 *   exclusive control-flow paths.  (Example: on-main thread and
 *   off-main-thread.)
 *
 */
export default class ClassDiagram extends EE {
  constructor() {
    super();

    this.serial = 0;
    this.batchDepth = 0;
    this._serialWhenBatchBegan = 0;

    this.nodes = new Set();
    // Keys are source nodes, values are a Map whose keys are the target node
    // and whose value is metadata.
    this.forwardEdges = new Map();
    // Keys are target nodes, values are a Map whose keys are the source node
    // and whose value is metadata.
    this.reverseEdges = new Map();

    /**
     * An edge that should not be part of the graph and shouldn't be traversed
     * further.
     */
    this.BORING_EDGE = 1;
    /**
     * An edge that isn't interesting on its own, but could end up being
     * interesting as part of a longer path.  Weak edges are added to a shadow
     * graph that will be added to the graph if a STRONG_EDGE is added.  Weak
     * edges are traversed.
     */
    this.WEAK_EDGE = 2;
    this.STRONG_EDGE = 3;
    /**
     * An OK edge is one that shouldn't cause the weak edges to be upgraded to
     * actual edges.  This would be used for cases for things like methods that
     * provide some type of boring leaf-node functionality.  The fact that other
     * methods also call the boring helper is not useful from a high-level
     * control-flow view, but may be useful to convey only for our starting
     * node.
     */
    this.OK_EDGE = 4;
  }

  markDirty() {
    this.serial++;
    if (!this.batchDepth) {
      this.emit('dirty');
    }
  }

  beginBatch() {
    if (!this.batchDepth) {
      this._serialWhenBatchBegan = this.serial;
    }
    this.batchDepth++;
  }

  endBatch() {
    this.batchDepth--;
    if (!this.batchDepth) {
      if (this.serial > this._serialWhenBatchBegan) {
        this.emit('dirty');
      }
    }
  }

  loadFromSerialized() {
    // TODO: implement serialization.
    // current idea is just to serialize all the edges as raw symbols and then
    // at load time look them all up, plus add ourselves as a listener for when
    // file analyses complete so we can get more correct as things get loaded
    // in.
  }

  ensureEdge(from, to, meta) {
    this.nodes.add(from);
    this.nodes.add(to);

    let forwardMap = this.forwardEdges.get(from);
    if (!forwardMap) {
      forwardMap = new Map();
      this.forwardEdges.set(from, forwardMap);
    }
    forwardMap.set(to, meta);

    let reverseMap = this.reverseEdges.get(to);
    if (!reverseMap) {
      reverseMap = new Map();
      this.reverseEdges.set(to, reverseMap);
    }
    reverseMap.set(from, meta);
    this.markDirty();
  }

  /**
   * Symbol graph traversal helper.  Deals with:
   * - Ensuring each edge is considered at most once.
   * - Dealing with the weak edge shadow graph.
   *
   * Arguments:
   * - from
   * - to
   * - current strength / or value to propgate.
   */
  visitWithHelpers(startNode, considerEdge) {
    // This is actually visited or will-visit.
    const pendingNodes = [startNode];
    const visitedNodes = new Set(pendingNodes);

    // We use another ClassDiagram instance to store our weak wedges.
    const weakDiag = this.weakDiag = new ClassDiagram();

    const handleEdge = (from, to, other) => {
      // ignore erroneous edges.
      if (from === null || to === null) {
        return;
      }
      const [result, meta] = considerEdge(from, to);

      //console.log('considered edge', from, to, 'result', result);
      let addEdge = true;
      let traverseEdge = true;

      switch (result) {
        case this.BORING_EDGE: {
          //console.log("   boring");
          addEdge = false;
          traverseEdge = false;
          return;
        }
        case this.WEAK_EDGE: {
          //console.log("   weak");
          weakDiag.ensureEdge(from, to, meta);
          addEdge = false;
          break;
        }
        case this.STRONG_EDGE: {
          //console.log("   strong");
          // This means we potentially want to uplift portions of the
          break;
        }
        case this.OK_EDGE: {
          //console.log("   ok");
          traverseEdge = false;
          break;
        }
        default:
          throw new Error();
      }

      if (addEdge) {
        this.ensureEdge(from, to, meta);
      }

      if (traverseEdge && !visitedNodes.has(other)) {
        pendingNodes.push(other);
        visitedNodes.add(other);
      } else if (!traverseEdge) {
        // an ok edge should suppress traversal into the node.
        visitedNodes.add(other);
      }
    };

    try {
      this.beginBatch();
      while (pendingNodes.length) {
        const curNode = pendingNodes.pop();
        curNode.ensureCallEdges();

        for (const callsNode of curNode.callsOutTo) {
          callsNode.ensureCallEdges();
          handleEdge(curNode, callsNode, callsNode);
        }
        for (const callerNode of curNode.receivesCallsFrom) {
          callerNode.ensureCallEdges();
          handleEdge(callerNode, curNode, callerNode);
        }
      }
    } finally {
      this.endBatch();
    }
  }

  /**
   * May be called multiple times after a visitWithHelpers call to run flood
   * propagations to find all the paths between externally maintained "strong"
   * nodes.  (The external maintenance can likely be folded in.)
   *
   * This algorithm's flood traversal is directional.  We run via forward edges
   * once and via reverse edges once.  We don't do what visitWithHelpers does
   * where it processes each node in both directions every time.
   */
  floodWeakDiagForPaths(startNode, bitVal, terminusNodes) {
    try {
      // eh, we don't really need this...
      this.beginBatch();

      const weakDiag = this.weakDiag;

      // ## Forward pass.
      let visitedNodes = new Set(terminusNodes); // should include startNode
      let pendingNodes = [startNode];
      while (pendingNodes.length) {
        const curNode = pendingNodes.pop();

        const outMap = weakDiag.forwardEdges.get(curNode);
        if (outMap) {
          for (const [callsNode, meta] of outMap.entries()) {
            outMap.set(callsNode, meta | bitVal);
            // we also want to grab the mirror represenstation of this...
            const mirrorMap = weakDiag.reverseEdges.get(callsNode);
            const mirrorMeta = mirrorMap.get(curNode);
            mirrorMap.set(curNode, mirrorMeta | bitVal);

            if (!visitedNodes.has(callsNode)) {
              pendingNodes.push(callsNode);
              visitedNodes.add(callsNode);
            }
          }
        }
      }

      // ## Reverse pass
      visitedNodes = new Set(terminusNodes); // should include startNode
      pendingNodes = [startNode];
      while (pendingNodes.length) {
        const curNode = pendingNodes.pop();

        const inMap = weakDiag.reverseEdges.get(curNode);
        if (inMap) {
          for (const [callerNode, meta] of inMap.entries()) {
            inMap.set(callerNode, meta | bitVal);
            // we also want to grab the mirror represenstation of this...
            const mirrorMap = weakDiag.forwardEdges.get(callerNode);
            const mirrorMeta = mirrorMap.get(curNode);
            mirrorMap.set(curNode, mirrorMeta | bitVal);

            if (!visitedNodes.has(callerNode)) {
              pendingNodes.push(callerNode);
              visitedNodes.add(callerNode);
            }
          }
        }
      }
    } finally {
      this.endBatch();
    }
  }

  mergeTraversedWeakDiagIn() {
    try {
      this.beginBatch();

      const weakDiag = this.weakDiag;
      for (const [from, toMap] of weakDiag.forwardEdges.entries()) {
        for (const [to, meta] of toMap.entries()) {
          // NB: we could avoid the bit-counting by just noticing that we're
          // or-ing in a value above that's different from the existing value.  We
          // don't actually care about the tally proper or which bits, yet...
          // (There could be a neat color thing that could be done with a VERY
          // small number of colors.)
          if (bitCount(meta) >= 2) {
            this.ensureEdge(from, to, meta);
          }
        }
      }

      for (const [to, fromMap] of weakDiag.reverseEdges.entries()) {
        for (const [from, meta] of fromMap.entries()) {
          // NB: we could avoid the bit-counting by just noticing that we're
          // or-ing in a value above that's different from the existing value.  We
          // don't actually care about the tally proper or which bits, yet...
          // (There could be a neat color thing that could be done with a VERY
          // small number of colors.)
          if (bitCount(meta) >= 2) {
            this.ensureEdge(from, to, meta);
          }
        }
      }
    } finally {
      this.endBatch();
    }
  }

  dumpToConsole() {
    for (const [from, toMap] of this.forwardEdges.entries()) {
      for (const [to, meta] of toMap.entries()) {
        console.log(from, '->', to, 'meta:', meta);
      }
    }
  }

  /**
   * Create a graphviz dot representation of this diagram.
   *
   * The main value-add of this method over the simplest naive graphviz
   * translation is clustering nodes into graphviz clusters and HTML table
   * "records".
   *
   * Our general theory on these choices:
   * - The point of any type of clustering/grouping is to aid understanding by
   *   reducing visual complexity, making it easier for us to understand
   *   like/related things as as alike/related.
   * - An HTML record style works well for classes when we're not dealing with
   *   a high degree of (visualized) internal connectivity.  Self-edges don't
   *   work great, it's better to cluster as independent nodes in that case.
   * - Clusters work well for namespaces and directory structures.
   *
   * ### Implementation ###
   *
   * The current strategy is roughly:
   * - Run through all nodes building a tree hierarchy based on
   *   [namespace, class, method].
   * - Walk all edges, binning the edges into the first level of hierarchy that
   *   contains both nodes as descendants.  Tallies are maintained at each level
   *   of hierarchy so that the internal edge count (edges between children) and
   *   external edge count (edges between a child and a non-child) are always
   *   known when considering what to do for a tree branch.
   * - Walk the tree, deciding for each level which of the following to do.
   *   Note that explicit annotations may eventually be provided on levels of
   *   hierarchy by external actors (users, clever doodlers).
   *   - collapse: For a hierarchy level with only one child, it probably makes
   *     sense to combine the hierarchy level with its child rather than
   *     introduce a gratuitous cluster.
   *   - MAYBE flatten: Like collapse, but multiple children are combined into
   *     their parent without clustering.
   *   - cluster: Create a graphviz cluster.
   *   - make a record table: If the number of internal edges is low compared to
   *     the number of external edges, a record may be appropriate.
   *
   * Much of this logic is farmed out to the HierBuilder.  The documentation
   * above probably wants to move.
   */
  lowerToGraphviz() {
    const builder = new HierBuilder();

    // ## Add all nodes
    for (const sym of this.nodes) {
      builder.addNode(sym);
    }

    // ## Add the edges.
    for (const [from, toMap] of this.forwardEdges.entries()) {
      for (const [to, meta] of toMap.entries()) {
        builder.addEdge(from, to);
      }
    }

    // ## Determine what to do at each level of the hierarchy.
    builder.determineNodeActions();

    // ## And now the actual dot source!
    return builder.renderToDot();
  }
}
