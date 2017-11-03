import BackendWorker from 'worker-loader!./backend.js';

/**
 * Sessions are an investigation of one or more signatures that may be
 * associated with one or more bugs.
 */
class Session {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }
}

/**
 * Rather than present simple counts of how many times a NormalizedStack or
 * DerivedStackFamily is seen, we aggregate over interesting factors.  For
 * example, the specific release or platform.  This class exists to provide
 * helpers facilitating further drilling down and/or customized brushing.
 */
class FacetedCounts {

}

/**
 * A normalized stack represents an actual stack we saw in a crash, possibly
 * aggregated across multiple crash reports.
 */
class NormalizedStack {

}

/**
 * A DerivedStackFamily is an aggregation derived from the application of stack
 * patterns to one or more NormalizedStacks to produce a more compact,
 * user-defined explanation of those stacks.
 */
class DerivedStackFamily {
  constuctor(rep) {
    this.id = rep.id;

  }
}

class StackPatternCollection {

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
class StackPattern {

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
class StackCluster {
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

/**
 * The SesssionTopLevel represents the current analysis status of a session.
 *
 */
class SessionTopLevel {

}

/**
 *
 */
class CrashAnalysisFrontend {
  /**
   * The frontend name determines the root IndexedDB database name used.
   * Per-session databases are created that are prefixed with this name.  You
   * probably want to pick a single app-specific name and hardcode it.
   */
  constructor(name) {
    this.name = name;
    this._worker = new BackendWorker();
    this._worker.addEventListener("message", this._onMessage.bind(this));

    this._awaitingReplies = new Map();
    this._nextMsgId = 1;

    this._sendNoReply({
      type: "init",
      name
    });
  }

  _onMessage(evt) {

  }

  _sendNoReply(payload) {
    this._worker.postMessage({
      msgId: 0,
      payload
    });
  }

  _sendAndAwaitReply(payload) {
    this._worker.postMessage({
      msgId: this._nextMsgId++,
      payload
    });
  }

  createSession() {

  }

  async loadSession(sessionName) {

  }
}

export default CrashAnalysisFrontend;
