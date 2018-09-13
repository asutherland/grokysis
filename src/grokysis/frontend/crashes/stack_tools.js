/**
 * Rather than present simple counts of how many times a NormalizedStack or
 * DerivedStackFamily is seen, we aggregate over interesting factors.  For
 * example, the specific release or platform.  This class exists to provide
 * helpers facilitating further drilling down and/or customized brushing.
 */
export class FacetedCounts {

}

/**
 * A normalized stack represents an actual stack we saw in a crash, possibly
 * aggregated across multiple crash reports.
 */
export class NormalizedStack {

}

/**
 * A DerivedStackFamily is an aggregation derived from the application of stack
 * patterns to one or more NormalizedStacks to produce a more compact,
 * user-defined explanation of those stacks.
 */
export class DerivedStackFamily {
  constuctor(rep) {
    this.id = rep.id;

  }
}

export class StackPatternCollection {

}

/**
 * StackPatterns are explanations of one or more observed stack frames that
 * are used to create human comprehensible DerivedStackFamily instances from
 * NormalizedStack instances.
 *
 * For example, spinning a nested event loop typically involves multiple stack
 * frames.  A stack pattern can be created for each different mixture of call
 * signatures that amount to "nested event loop".
 */
export class StackPattern {

}

/**
 * Our base type for containers of NormalizedStack representations and their
 * DerivedStackFamily byproducts.  Named subtypes exist to cover our levels of
 * hierarchy.  Although some levels should homogenously only contain specific
 * `childClusters` aggregations and no `normalizedStacks`/`bestStacks`, for
 * implementation simplicity, we use this unified type.
 *
 * Our expected "type" hierarchy looks like:
 * - ThreadGroup: Thread groups, some of which may only contain single
 *   threads (ex: "Main", "PBackground"), while some may contain a family of
 *   homogenous threads that are flattened because they are indistinguishable
 *   ("mozStorage"), and some others may recursively group distinguishable
 *   types (ex: QuotaManager and its specific clients, DOM Cache, and
 *   IndexedDB.  Also, StreamTransportService pools and varying consumers doing
 *   things on those threads).
 * - Subsystem: I guess stuff partitioned by the code that seems to be on the
 *   stack.
 *
 * Property-wise, we have:
 * - childClusters: A list of other StackCluster children.
 * - normalizedStacks: Just the NormalizedStack instances in this cluster,
 *   ignoring the application of StackPatterns to produce DerivedStackFamily
 *   instances.  These will be ordered by descending count.
 * - bestStacks: The result of running stack pattern matching against
 *   normalizedStacks to aggregate the derived stacks into DerivedStackFamily
 *   aggregations.  What fails to match is left as a NormalizedStack, so this
 *   is a heterogenous list.  Ordered by descending count.
 */
export class StackCluster {
  constructor(rep) {
    this.id = rep.id;
    this.type = rep.type;
    this.label = rep.label;

    this.childClusters = rep.childClusters.map((x) => {
      return new StackCluster(x);
    });
    const normStackMap = new Map();
    this.normalizedStacks = rep.normalizedStacks.map((x) => {
      const normStack = new NormalizedStack(x);
      normStackMap.set(normStack.id, normStack);
      return normStack;
    });
    this.bestStacks = rep.bestStacks.map((x) => {

    });
  }
}
