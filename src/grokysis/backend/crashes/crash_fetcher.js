const PROCESSED_CRASH_ENDPOINT =
  'https://crash-stats.mozilla.com/api/ProcessedCrash/';
const RAW_CRASH_ENDPOINT =
  'https://crash-stats.mozilla.com/api/RawCrash/';

export default class CrashFetcher {
  constructor() {
  }

  async fetchProcessedCrashById(crashId) {
    const params = new URLSearchParams();
    params.set('crash_id', crashId);
    params.set('datatype', 'processed');

    const url = `${PROCESSED_CRASH_ENDPOINT}?${params.toString()}`;

    // TODO: maybe implement leaky/bad caching if this ends up being slow.
    const resp = await fetch(url);
    const result = await resp.json();
    return result;
  }

  async fetchRawCrashMetaById(crashId) {
    const params = new URLSearchParams();
    params.set('crash_id', crashId);
    params.set('format', 'meta');

    const url = `${RAW_CRASH_ENDPOINT}?${params.toString()}`;

    // TODO: maybe implement leaky/bad caching if this ends up being slow.
    const resp = await fetch(url);
    const result = await resp.json();
    return result;
  }
}
