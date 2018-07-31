const MAX_CALLER_COUNT_FOR_TRAVERSAL_IN = 4;

/**
 * Given a SymbolInfo corresponding to a class that has had its implementation
 * file analyzed, attempt to render its relation to other methods in the same
 * class.
 *
 * Practically, this means:
 * - Add all callers and callees that are "interesting" that live in the same
 *   class to the display graph.
 * - Create a hidden "weak" graph of all the remaining same-class edges that
 *   are reachable from those "strong" nodes.
 * - Allocate a distinct labeling bit for each of these strong nodes.
 * - Perform a BFS flood labeling from each strong node across all the weak
 *   edges visible, accumulating the labeling bits on nodes and edges.
 * - Any nodes or edges labeled with more than a single bit get added to the
 *   display graph.
 */
export default class InternalDoodler {
  doodleMethodInternalEdges(rootSym, diagram) {
    const strongRoots = new Set();

    diagram.nodes.add(rootSym);
    diagram.visitWithHelpers(
      rootSym,
      (from, to) => {
        // Treat calls into methods with a high number of callers as bad.
        const tooBusy =
          (to.receivesCallsFrom.size > MAX_CALLER_COUNT_FOR_TRAVERSAL_IN);

        //console.log(from.prettiestName, to.prettiestName, tooBusy);

        // previously, used isSameClassAs
        if (from.isSameSourceFileAs(to)) {
          // Okay, it's some type of edge, but it's only strong if it's touching
          // something already in the graph.
          if (from === rootSym) {
            if (!tooBusy) {
              strongRoots.add(to);
            }
            return [tooBusy ? diagram.OK_EDGE : diagram.STRONG_EDGE, 0];
          } else if (to === rootSym) {
            if (!tooBusy) {
              strongRoots.add(from);
            }
            return [tooBusy ? diagram.OK_EDGE : diagram.STRONG_EDGE, 0];
          }
          return [tooBusy ? diagram.BORING_EDGE : diagram.WEAK_EDGE, 0];
        }
        return [diagram.BORING_EDGE, null];
      });

    // Now diagram.weakDiag is the weak graph, and we want to run flood
    // propagations from each strong root.
    let iBit = 0;
    for (const strongRoot of strongRoots) {
      //console.log('flooding', strongRoot);
      const bitVal = 1 << (iBit++);
      diagram.floodWeakDiagForPaths(strongRoot, bitVal, strongRoots);
    }

    console.log('rendered diagram', diagram);

    diagram.mergeTraversedWeakDiagIn();
  }
}
