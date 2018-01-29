import makeBackend from './backend.js';

class GrokAnalysisFrontend {
  /**
   * The frontend name determines the root IndexedDB database name used.
   * Per-session databases are created that are prefixed with this name.  You
   * probably want to pick a single app-specific name and hardcode it.
   */
  constructor(name) {
    this.name = name;
    const { backend, useAsPort } = makeBackend();
    this._backend = backend; // the direct destructuring syntax is confusing.
    this._port = useAsPort;
    this._port.addEventListener("message", this._onMessage.bind(this));

    this._awaitingReplies = new Map();
    this._nextMsgId = 1;

    this._sendNoReply({
      type: "init",
      name
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

  _sendNoReply(payload) {
    this._worker.postMessage({
      msgId: 0,
      payload
    });
  }

  _sendAndAwaitReply(type, payload) {
    const msgId = this._nextMsgId++;
    this._worker.postMessage({
      type,
      msgId,
      payload
    });

    return new Promise((resolve, reject) => {
      this._awaitingReplies.set(msgId, { resolve, reject });
    });
  }

  async performSearch(searchStr) {

  }
}

export default GrokAnalysisFrontend;
