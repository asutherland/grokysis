import BackendWorker from './back.worker.js';

class Session {
  constructor() {

  }
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
    this._worker = new Worker()
  }

  createSesion() {

  }

  async loadSession(sessionName) {

  }
}

export default CrashAnalysisFrontend;
