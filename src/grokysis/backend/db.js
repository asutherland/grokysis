import idb from 'idb';

const DB_GLOBAL = 'global';
const DB_SESSION_THINGS = 'session-things';

export default class BackendDB {
  constructor({ name }) {
    this.dbName = `grok-${name}`;
    this.dbVersion = 1; // want static properties.
    this.db = null;
  }

  /**
   * Asynchronously load all initial state from the database that's needed for
   * the front-end to become user-responsive.  This means configuration data and
   * the notebook sheet level granularity of session things.
   */
  async init() {
    let freshDb = false;
    this.db = await idb.open(this.dbName, (upDb) => {
      // global:
      // - stores singleton-ish data in separate keys for things that should be
      //   transactionally separate and are notionally global from the backend's
      //   perspective.
      upDb.createObjectStore(DB_GLOBAL);

      // session-things:
      // - keys are one-up values issued by the front-end SessionManager,
      //   atomically tracked as 'next-session-thing' in  the 'global' store.
      upDb.createObjectStore(DB_SESSION_THINGS, { keyPath: 'id' });

      freshDb = true;
    });

    if (freshDb) {
      return {
        globals: null,
        sessionThings: null
      };
    }

    const tx = db.transaction([DB_GLOBAL, DB_SESSION_THINGS]);
    const pGlobalKeys = tx.objectStore(DB_GLOBAL).getAllKeys();
    const pGlobalValues = tx.objectStore(DB_GLOBAL).getAll();
    const pSessionThings = tx.objectStore(DB_SESSION_THINGS).getAll();

    const globalKeys = await pGlobalKeys;
    const globalValues = await pGlobalValues;
    const sessionThings = await pSessionThings;

    const globals = {};
    for (let i=0; i < globalKeys.length; i++) {
      const key = globalKeys[i];
      const value = globalValues[i];

      globals[key] = value;
    }

    return { globals, sessionThings };
  }

  /**
   * Set string key to any IDB-friendly value.
   */
  setGlobal(key, value) {
    const tx = this.db.transaction([DB_GLOBAL], 'readwrite');
    tx.objectStore(DB_GLOBAL).put(value, key);
    return tx.complete;
  }

  /**
   * Set a self-identified via `id` property IDB-friendly value.
   */
  async setSessionThing(thing) {
    const tx = this.db.transaction([DB_SESSION_THINGS], 'readwrite');
    tx.objectStore(DB_SESSION_THINGS).put(thing);
    return tx.complete;
  }

  /**
   * Delete a previously provided session-thing via its id (key path extraction
   * doesn't happen).
   */
  async deleteSessionThingById(id) {
    const tx = this.db.transaction([DB_SESSION_THINGS], 'readwrite');
    tx.objectStore(DB_SESSION_THINGS).delete(id);
    return tx.complete;
  }
}
