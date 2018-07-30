/**
 * Given a SymbolInfo corresponding to a class that has had its implementation
 * file analyzed, attempt to render its relation to other methods in the same
 * class.
 *
 * Practically, this means:
 * - Start by adding edges for all calls into the method and from the method
 *   where the other node is also part of the same class.
 * - Walk the same-class edges of those nodes as well for a small number of
 *   steps, and if a path is found that connects to any nodes already in the
 *   graph, add that path.
 */
export default class InternalDoodler {
  doodleMethodInternalEdges(rootSym, diagram) {
    diagram.visitWithHelpers(
      rootSym,
      (from, to) => {
        if (from.isSameClassAs(to)) {
          return diagram.STRONG_EDGE;
        }
        return diagram.BORING_EDGE;
      });
  }
}
