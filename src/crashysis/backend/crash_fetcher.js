/**
 * Caching crash report fetcher.  Provide it with a list of crash id's and a
 * CrashDB and it will provide you with all the crash reports that can be
 * retrieved.  Fetched reports will be persisted in the CacheDB and retrieved
 * from disk next time.
 */
class ReportFetcher {
  constructor({ crashDB }) {
    this._crashDB = crashDB;
  }

  async fetchCrashes(crashIds) {

  }
}
