import BackendWorker from 'worker-loader!./backend.js';

class LogAnalysisFrontend {
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

export default LogAnalysisFrontend;
