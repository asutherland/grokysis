import makeBackend from './backend.js';

import SessionManager from './frontend/session_manager.js';

import RawSearchResults from './frontend/raw_search_results.js';
import FilteredResults from './frontend/filtered_results.js';
import KnowledgeBase from './frontend/knowledge_base.js';

class GrokAnalysisFrontend {
  /**
   * The frontend name determines the root IndexedDB database name used.
   * Per-session databases are created that are prefixed with this name.  You
   * probably want to pick a single app-specific name and hardcode it.
   */
  constructor({ session }) {
    this.name = session.name;

    this.sessionManager = new SessionManager(session);

    const { backend, useAsPort } = makeBackend();
    this._backend = backend; // the direct destructuring syntax is confusing.
    this._port = useAsPort;
    this._port.addEventListener("message", this._onMessage.bind(this));
    this._port.start();

    this._awaitingReplies = new Map();
    this._nextMsgId = 1;

    this._sendAndAwaitReply(
      "init",
      {
        name: this.name
      }).then((initData) => {
        this._initCompleted(initData);
      });
  }

  _onMessage(evt) {
    const data = evt.data;
    const { type, msgId, payload } = data;

    // -- Replies
    if (type === "reply") {
      if (!this._awaitingReplies.has(msgId)) {
        console.warn("Got reply without map entry:", data, "ignoring.");
        return;
      }
      console.log("reply", msgId, type, payload);
      const { resolve, reject } = this._awaitingReplies.get(msgId);
      if (data.success) {
        resolve(payload);
      } else {
        reject(payload);
      }
      return;
    }

    // -- Everything else, none of which can be expecting a reply.
    const handlerName = "msg_" + type;
    try {
      this[handlerName](payload);
    } catch(ex) {
      console.error(`Problem processing message of type ${type}:`, data, ex);
    }
  }

  _sendNoReply(type, payload) {
    this._port.postMessage({
      type,
      msgId: 0,
      payload
    });
  }

  _sendAndAwaitReply(type, payload) {
    const msgId = this._nextMsgId++;
    console.log("request", msgId, type, payload);
    this._port.postMessage({
      type,
      msgId,
      payload
    });

    return new Promise((resolve, reject) => {
      this._awaitingReplies.set(msgId, { resolve, reject });
    });
  }


  _initCompleted({ globals, sessionThings }) {
    this.sessionManager.consumeSessionData(sessionThings);
  }

  async performSearch(searchStr) {
    const wireResults = await this._sendAndAwaitReply(
      "search",
      {
        searchStr
      });
    const rawResults = new RawSearchResults(wireResults);
    const filtered = new FilteredResults({ rawResultsList: [rawResults] });
    return filtered;
  }


}

export default GrokAnalysisFrontend;
