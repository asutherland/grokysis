/**
 * Interface to report notable log parsing events and general progress from
 * the parsing process in the back-end to the front-end.  For use for when
 * the front-end potentially cares about what would otherwise be a console.log()
 * call.
 *
 * XXX for now, everything is just a console API call to simplify things.
 */
export default class ParseProgress {
  constructor() {

  }


  /**
   * Report the existence of a log file that will be parsed.
   *
   * The provided logInfo should have the following fields:
   * - id: An opaque string identifier that uniquely identifies the log amongst
   *   its siblings for this parse.  Not globally unique.
   * - baseName: The log's filename sans any log-rotation gunk.
   * - baseOrder: 0 if not part of a log rotation, otherwise the index of this
   *   log amongst its fellow rotated logs.
   * - sizeBytes: The log file's size in bytes.
   */
  reportLogFile(logInfo) {
    console.log("learned about log file:", logInfo);
  }

  /**
   * Report some type of progress related to log parsing.
   *
   * progressInfo should contain the following fields:
   * - logId: The id of the log file we are talking about.
   * - bytesParsed: How far into the file have we fully parsed.
   * - bytesRead: How many bytes have been read from disk and fed to the parser.
   * - linesParsed: The number of lines that have been "fully" parsed.  (Fully
   *   does not necesarilly mean we actually knew what to do with the line.)
   */
  logFileProgress(progressInfo) {
    console.log("log processing progress:", progressInfo);
  }

  /**
   * Send a warning message to the UI to be presented to the user in a naggy
   * fashion so that there's a chance the user sees it.
   */
  warnUser(msg) {
    console.warn(msg);
  }

  exception(msg) {
    console.warn(msg);
  }


}