import idb from "idb";

const VERSION = 1;

/**
 * Stores the session definitions and all metadata.  That's right, the sessions
 * are atomic units of data.  Uses an autoIncrement id.
 */
const TBL_SESSIONS = "sessions";

/**
 * Stores stack patterns
 */
const TBL_STACK_PATTERNS = "stack_patterns";

/**
 * The app primary database that stores any global configuration data, plus all
 * the canonical user-authored data for the analysis sessions.  Subsidiary
 * CrashDB instances are created for each session as they are opened.
 */
class RootDB {
  constructor(name) {
    this.name = name;
    this.db = null;
  }

  async init() {
    this.db = await idb.open(name, VERSION, upDB => {
      switch(upDB.oldVersion) {
        case 0:
          upDB.createObjectStore(
            TBL_SESSIONS,
            { keyPath: "id", autoIncrement: true });
          upDB.createObjectStore(
            TBL_STACK_PATTERNS,
            { keyPath: "id", autoIncrement: true });
      }
    });
  }

  /**
   * Retrieve all defined sessions.
   */
  getAllSessions() {
    const tx = this.db.transaction(TBL_SESSIONS);
    return tx.objectStore(TBL_SESSIONS).getAll();
  }

  /**
   * Asynchronously saves the given session, returning the id of the session,
   * which may be freshly issued.
   */
  async saveSession(session) {
    const tx = this.db.transaction(TBL_SESSIONS, "readwrite");
    // We want the result of this put because it may have minted a new id using
    // the autoIncrement key generator.
    const id = await tx.objectStore(TBL_SESSIONS).put(session);
    // But let's wait for the transaction to fully have hit disk before
    // returning.
    await tx.complete;
    return id;
  }

  getAllStackPatterns() {
    const tx = this.db.transaction(TBL_STACK_PATTERNS)
    return tx.objectStore(TBL_STACK_PATTERNS).getAll();
  }

  /**
   * Asynchronously save the given stack pattern, returning its allocated id,
   * which may be freshly issued.
   */
  saveStackPattern(stackPattern) {
    const tx = this.db.transaction(TBL_STACK_PATTERNS, "readwrite");
    const id = await tx.objectStore(TBL_STACK_PATTERNS).put(stackPattern);
    await tx.complete;
    return id;
  }
}
