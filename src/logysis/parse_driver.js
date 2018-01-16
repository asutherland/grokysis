import ProcContext from "./proc_context.js";

const FILE_SLICE = 1 * 1024 * 1024;

/**
 * Returns the RegExp match object if the provided DOM File instance's name has
 * a suffix of the form ".child-###" or ".child-###.###".  The latter form is
 * for rotated logs as detected by `isRotateFile`.  No capture group is used.
 */
function isChildFile(file) {
  return file.name.match(/\.child-\d+(?:\.\d+)?$/);
}

/**
 * Returns the RegExp match object if the provided DOM file instance's name has
 * a suffix of the form ".###", with a capture group for the non-suffix part
 * of the string, hereafter to be referred to as "base name".
 */
function isRotateFile(file) {
  return file.name.match(/^(.*)\.\d+$/);
}

/**
 * Normalize the provided log File's name to be its base name if it's a rotate
 * file, or just its name if it's not.  For child files, the child suffix
 * portion will still be included.
 */
function rotateFileBaseName(file) {
  let baseName = isRotateFile(file);
  if (baseName) {
    return baseName[1];
  }

  return file.name;
}

/**
 * Given an array of raw DOM File instances, process their filenames for hints
 * about their contents to simplify parsing.  Currently it's expected that only
 * logs generated by Necko's "about:networking" logging functionality will have
 * such carefully generated names.
 *
 * Returns an array of objects with the following properties:
 * - raw: The DOM File being parsed.
 * - baseName: The log filename without any log rotation numeric suffixes.
 * - isChild: Did the filename include an explicit ".child" suffix, as used by
 *   "about:networking"-generated logs.
 * - baseOrder: The sequence number of this log in rotation sequence.
 * - parseState: An object with the following fields which are intended to be
 *   mutated during the parsing process.  (These replace the expandos previously
 *   set on the File instances.)
 *   - lineNumber: 1-based, initially set to 1.
 *   - binaryOffset: 0-based offset into the file.  XXX at the time of writing
 *     this, newlines, especially cr-lf pairs, are not properly accounted for
 *     and so this is likely to be incorrect.
 *   - prepared: Fully characterizes the current line to be parsed, an object
 *     with properties:
 *     - module:
 *     - raw:
 *     - text:
 *     - timestamp: Date instance parsed out of the line, or the most recent
 *       explicit timestamp.
 *     - linenumber: 1-based line number in its file
 *     - binaryoffset: 0-based file offset corresponding to the start of the
 *       line.  XXX this will be wrong until newlines are compensated for.
 *     - nextoffset: The 0-based file offset corresponding to the line after
 *       the current line.  XXX again, gonna be wrong until newline logic is
 *       improved.
 *
 * @param {File[]} rawFiles
 *   List of the DOM File instances corresponding to logs to be parsed.  This
 *   array will be mutated to place the logs in sorted order.
 */
function analyzeAndWrapFiles(rawFiles, parseProgress) {
  rawFiles.sort((a, b) => a.name.localeCompare(b.name));

  const parents = {};
  const children = {};
  const update = (array, item) => {
    return (array[item] = array[item] ? (array[item] + 1) : 1);
  };

  const wrappedFiles = rawFiles.map((raw, i) => {
    const baseName = rotateFileBaseName(raw);
    const isChild = isChildFile(raw);
    const wrapped = {
      id: `logId:${i}`,
      raw,
      baseName,
      isChild,
      baseOrder: update(isChild ? children : parents, baseName),
      parseState: {
        lineNumber: 1,
        binaryOffset: 0
      }
    };

    parseProgress.reportLogFile({
      id: wrapped.id,
      baseName: wrapped.baseName,
      baseOrder: wrapped.baseOrder,
      sizeBytes: raw.size
    });

    return wrapped;
  });

  const numParents = Object.keys(parents).length;
  const numChildren = Object.keys(children).length;

  if (numParents > 1) {
    parseProgress.warnUser("More than one parent log - is that what you want?");
  }
  if (numParents == 0 && numChildren > 1) {
    parseProgress.warnUser(
      "Loading orphan child logs - is that what you want?");
  }

  return wrappedFiles;
}


/**
 * Drives a single (possibly multi-)log parse.  Invoke `startParsing()` to
 * begin the parsing process and receive a promise that will be resolved when
 * parsing completes.  Progress information will also be provided via the
 * `parseProgress` instance provided to the constructor.
 */
class ParseDriver {
  /**
   *
   * @param schemas
   *   Schema map.
   * @param {File[]} rawFiles
   *   An array of DOM Files.  Their filenames will be analyzed for sequencing
   *   information.
   * @param {ParseProgress} parseProgress
   *   Allows the parse to emit progress events and non-fatal feedback to the
   *   UI.
   */
  constructors({ schemas, rawFiles, parseProgress }) {
    this.schemas = schemas;
    this.rawFiles = rawFiles;
    this.parseProgress = parseProgress;

    // Processing context to hold all the state derived from the parse as well
    // as transient state tracking.
    this._proc = new ProcContext({ parseProgress });

    // XXX State that is no longer tracked here, but other code hasn't
    // realized yet:
    // - seekId: Used by the UI and logan.js search mechanism.
    // - searchProps: same deal.

    this.wrappedFiles = analyzeAndWrapFiles(rawFiles, parseProgress);
    this.parsePromise = null;
  }

  /**
   * Error instance construction helper that attempts to capture parse state.
   */
  exceptionParse(exception) {
    if (typeof exception === "object") {
      exception = "'" + exception.message + "' at " + exception.fileName + ":" + exception.lineNumber
    }
    exception += "\nwhile processing '" + this._proc.raw +
                  "'\nat " + this._proc.file.name + ":" + this._proc.linenumber;
    return new Error(exception);
  }

  /**
   * Begin the asynchronous parsing process of the `rawFiles` provided to the
   * constructor.  Returns a Promise that will be resolved when parsing
   * completes or rejected if a fatal parsing problem is encountered.  Progress
   * information will be provided via the ParseProgress instance provided to the
   * constructor.
   */
  startParsing() {
    return this.consumeFiles();
  }

  /**
   * Fetch a URL as a Blob and hand off the result to `consumeFiles` to further
   * process the logs.
   *
   * TODO: UI entanglements.
   * TODO: This is sorta moot at the current time, move off to a helper class
   * for higher level log file management?  (Like tracking specific analysis
   * jobs, which would stash their logs in a named persisted record.)
   */
  consumeURL(UI, url) {
    this.initProc(UI);

    fetch(url, { mode: 'cors', credentials: 'omit', }).then(function(response) {
      return response.blob();
    }).then(function(blob) {
      blob.name = "_net_"
      this.consumeFiles(UI, [blob]);
    }.bind(this));
  }

  /**
   * Given a list of log Blobs, trigger chunked parsing of each in parallel via
   * `readFile`, handing off consumption to `consumeParallel`.
   */
  consumeFiles() {
    const chunkPromises = this.wrappedFiles.map((wrappedFile) => {
      return this.readFile(wrappedFile);
    });

    return Promise.all(chunkPromises).then((readChunks) => {
      return this.consumeParallel(readChunks);
    });
  }

  /**
   * Given a File/Blob, incrementally read chunks of it to split its contents
   * into lines (with persistence of leftovers between chunks).  A promise
   * is returned of the form { wrappedFile, lines, read_more }, where read_more
   * is a
   * closure that will read the next chunk of the file.  The promise will reject
   * if there is a problem reading the string.
   *
   * TODO: UI entanglements.
   * TODO: readAsBinaryString is used which is non-standard and likely a footgun
   * for utf-8 output.
   */
  readFile(wrappedFile, from = 0, chunk = FILE_SLICE) {
    const rawFile = wrappedFile.raw;
    const parseState = wrappedFile.parseState;
    // Line buffer to hold left-over line data from previous chunk.
    let previousLine = "";
    const slice = (segmentoffset) => {
      return new Promise((resolve, reject) => {
        const blob = rawFile.slice(segmentoffset, segmentoffset + chunk);
        if (blob.size == 0) {
          resolve({
            wrappedFile,
            lines: [previousLine],
            read_more: null
          });
          return;
        }

        const reader = new FileReader();
        reader.onloadend = (event) => {
          if (event.target.readyState == FileReader.DONE && event.target.result) {
            UI && UI.addToLoadProgress(blob.size);

            // Change chunk size to 5MB and Chrome self-time of shift() is 1000x slower!
            const lines = event.target.result.split(/(\r\n|\r|\n)/);

            // This simple code assumes that a single line can't be longer than FILE_SLICE
            lines[0] = previousLine + lines[0];
            previousLine = lines.pop();

            resolve({
              wrappedFile,
              lines,
              read_more: () => slice(segmentoffset + chunk)
            });
          }
        };

        reader.onerror = (event) => {
          console.error(`Error while reading at offset ${segmentoffset} from ${file.name}`);
          console.exception(reader.error);
          window.onerror(reader.error);

          reader.abort();
          reject(reader.error);
        };

        reader.readAsBinaryString(blob);
      });
    };

    return slice(from);
  }

  /**
   * Suspiciously unused legacy function that uses `readFile` to provide lines
   * from the given offset, invoking a filter function for side-effects until
   * the filter function stops returning true and there are still lines.
   */
  async readLine(file, offset, filter) {
    file = await this.readFile(null, file, offset, FILE_SLICE);
    if (!file) {
      return;
    }
    if (!file.lines.length) {
      alert("No more lines in the log");
      return;
    }

    let increment = 0;
    let line;
    do {
      line = file.lines.shift();
      while (file.lines.length && !line.trim()) {
        line += file.lines.shift();
      }
      increment += line.length;
    } while (filter(line.trim(), offset + increment) &&
              file.lines.length);
  }

  /**
   * The primary parser driver.  An async function takes an array of the
   * resolved-promise outputs of readFile ({ file, lines, read_more }) and does
   * the following:
   * - Processes a single line at a time, selecting the file whose next line
   *   has the earliest timestamp.  (Or in the case of a tie, which can occur
   *   due to log file rotation, pick the "earlier" field by base order.)
   * - Invokes read_more() to asynchronously get more lines whenever a file runs
   *   out of lines but hasn't reached EOF.
   */
  async consumeParallel(readChunks) {
    while (readChunks.length) {
      // Make sure that the first line on each of the files is prepared
      // Preparation means to determine timestamp, thread name, module, if found,
      // or derived from the last prepared line
      singlefile: for (const readChunk of readChunks) {
        if (file.prepared) {
          continue;
        }

        do {
          if (!file.lines.length) {
            files.remove((item) => file === item);
            if (!file.read_more) {
              break singlefile;
            }

            file = await file.read_more();
            files.push(file);
          }

          const line = file.lines.shift();

          const offset = file.file.__binary_offset;
          file.file.__binary_offset += line.length;

          if (line.match(/^[\r\n]+$/)) {
            continue;
          }

          file.file.__line_number++;

          if (!line.length) { // a blank line
            continue;
          }

          file.prepared = this.prepareLine(line, file.previous);
          file.prepared.linenumber = file.file.__line_number;
          file.prepared.binaryoffset = offset;
          file.prepared.nextoffset = file.file.__binary_offset;
        } while (!file.prepared);
      } // singlefile: for

      if (!files.length) {
        break;
      }

      // Make sure the file with the earliest timestamp line is the first,
      // we then consume files[0].
      files.sort((a, b) => {
        return a.prepared.timestamp.getTime() - b.prepared.timestamp.getTime() ||
          a.file.__base_order - b.file.__base_order; // overlapping of timestamp in rotated files
      });

      let consume = files.find(file => !file.file.__recv_wait);
      if (!consume) {
        // All files are blocked probably because of large timestamp shift
        // Let's just unblock parsing, in most cases we will satisfy recv()
        // soon after.
        consume = files[0];
      }

      this.consumeLine(UI, consume.file, consume.prepared);
      consume.previous = consume.prepared;
      delete consume.prepared;
    }

    this.processEOS(UI);
  }

  /**
   * At End-Of-Stream(?):
   * - report any expected IPC messages that were not observed for user
   *   awareness.
   * - Update a bunch of UI state.
   *
   * TODO: UI entanglement
   */
  processEOS(UI) {
    for (let sync_id in this._proc._sync) {
      let sync = this._proc._sync[sync_id];
      if (sync.receiver) {
        UI.warn("Missing some IPC synchronization points fulfillment, check web console");
        console.log(`file ${sync.proc.file.name} '${sync.proc.raw}', never received '${sync_id}'`);
      }
    }

    UI.loadProgress(0);
    UI.fillClassNames(this.searchProps);
    UI.fillSearchBy();
    UI.searchingEnabled(true);
  }


  /**
   * Helper to generate a prepared line object dictionary.  Additional fields
   * are set by its exclusive caller, `consumeParallel`.
   */
  prepareLine(line, previous) {
    previous = previous || {};

    let result = this._schema.preparer.call(null, line, this._proc);
    if (!result) {
      previous.module = 0;
      previous.raw = line;
      previous.text = line;
      previous.timestamp = previous.timestamp || EPOCH_1970;
      return previous;
    }

    previous = result;
    previous.raw = line;
    return previous;
  }

  /**
   * The top of the call-stack for parsing lines and processing follows used
   * by `consumeParallel`.  Consumes a prepared line object dictionary
   * populated by `prepareLine` and with some additions by `consumeParallel`.
   * 
   * See processLine for documentation on how this method participates in the
   * logic related to `follow()` handling.
   */
  consumeLine(wrappedFile, prepared) {
    if (this.consumeLineByRules(wrappedFile, prepared)) {
      return;
    }

    const follow = this._proc.thread._engaged_follows[prepared.module];
    if (follow && !follow.follow(follow.obj, prepared.text, this._proc)) {
      delete this._proc.thread._engaged_follows[prepared.module];
    }
  }

  /**
   * Gets the Bag representing the named thread for the prepared line, creating
   * it if it does not already exist.  This bag tracks active "engaged" follows
   * keyed by module, or `0` for the un-tagged case.
   */
  ensureThread(file, prepared) {
    return ensure(this._proc.threads,
      file.__base_name + "|" + prepared.threadname,
      () => new Bag({ name: prepared.threadname, _engaged_follows: {} }));
  }

  /**
   * Sets up the `_proc` context for the given prepared line, selects the
   * correct set of rules based on the module (if provided) and invokes
   * `processLine`.  In the event the module did not exist or the module level
   * failed to process the line `processLine` is invoked with the `unmatch`
   * scope.  (TODO: better understand this fallback mechanism since it seems
   * error prone if the module was explicitly present.  If it can be inferred,
   * that makes more sense.)
   */
  consumeLineByRules(wrappedFile, prepared) {
    // Previously `file`, exposed for obj.send/recv... now we just expose the
    // parseState as a private-prefixed sort of things.
    this._proc._fileParseState = wrappedFile.parseState;
    this._proc.timestamp = prepared.timestamp;
    this._proc.line = prepared.text;
    this._proc.raw = prepared.raw;
    this._proc.module = prepared.module;
    this._proc.linenumber = prepared.linenumber;
    this._proc.binaryoffset = prepared.binaryoffset;
    this._proc.nextoffset = prepared.nextoffset;
    this._proc.thread = this.ensureThread(file, prepared);

    let module = this._schema.modules[prepared.module];
    if (module && this.processLine(module.get_rules(prepared.text), prepared)) {
      return true;
    }
    if (this.processLine(this._schema.unmatch, prepared)) {
      return true;
    }

    return false;
  }

  /**
   * Wraps `processLineByRules`, adding support for `follow` that is paired with
   * logic in `consumeLine`.
   *
   * Follow() allows rules to handle subsequent log lines that don't explicilty
   * match other rules.  The general operation of this is that for each line,
   * `consumeLine()` calls `consumeLinesByRules()` which invokes this method,
   * and 1 of 3 things happens:
   * - A rule matches and calls follow() which results in _pending_follow being
   *   set.  This configures _engaged_follows for both module-tagged and
   *   non-module-tagged output.  (Presumably this covers both the situation
   *   where multiple calls to MOZ_LOG are made versus cases where embedded
   *   newlines are generated.)
   * - A rule matches and does not call follow() which results in
   *   _engaged_follows being cleared because the follow() wants to be cleared.
   * - No rule matched, resulting in all of the calls noted above returning
   *   false, and so consumeLine() invokes the current follow function, deleting
   *   it if it didn't return true (per-contract).
   */
  processLine(rules, prepared) {
    this._proc._pending_follow = null;

    if (this.processLineByRules(rules, prepared.text)) {
      if (this._proc._pending_follow) {
        // a rule matched and called follow(), make sure the right thread is set
        // this follow.
        let module = this._proc._pending_follow.module;
        this._proc._pending_follow.thread._engaged_follows[module] = this._proc._pending_follow;
        // for lines w/o a module use the most recent follow
        this._proc._pending_follow.thread._engaged_follows[0] = this._proc._pending_follow;
      } else {
        // a rule on the module where the last follow() has been setup has
        // matched, what is the signal to remove that follow.
        delete this._proc.thread._engaged_follows[prepared.module];
        delete this._proc.thread._engaged_follows[0];
      }
      return true;
    }

    return false;
  }

  /**
   * Given a list of rules, a line and the file the line is from, try each rule
   * in sequence, returning true if a rule managed to parse the line and false
   * if no rule processed the line.
   *
   * The per-rule check amounts to:
   * - If there's a `cond` check, invoke it and skip the rule if the result was
   *   falsey.
   * - If there's no regexp, it's assumed there was a cond (and an assertion is
   *   thrown if not), and the rule is directly invoked with [line,
   *   conditionResult] as its arguments list and the `proc` as its `this`.
   *   True is then returned.
   * - If there was a regexp, `processRule` is used which tries the RegExp and
   *   invokes the rule's consumer with the capture groups as its arguments and
   *   `proc` its this.  If it match, true is returned.
   */
  processLineByRules(rules, line) {
    this._proc.line = line;
    let conditionResult;
    for (let rule of rules) {
      try {
        if (rule.cond) {
          conditionResult = rule.cond(this._proc);
          if (!conditionResult) {
            continue;
          }
        }
      } catch (exception) {
        throw this.exceptionParse(exception);
      }

      if (!rule.regexp) {
        if (!rule.cond) {
          throw this.exceptionParse("INTERNAL ERROR: No regexp and no cond on a rule");
        }

        try {
          rule.consumer.call(this._proc, line, conditionResult);
        } catch (exception) {
          throw this.exceptionParse(exception);
        }
        return true;
      }

      if (!this.processRule(line, rule.regexp, function() {
            rule.consumer.apply(this, Array.from(arguments).concat(conditionResult));
          })) {
        continue;
      }
      return true;
    }

    return false;
  }

  /**
   * Given a line and a regexp belonging to the passed-in consumer, attempt to
   * match the regexp.  If a match is returned, invoke the consumer, passing in
   * the capture groups as arguments to the consumer and `proc` passed as
   * `this`.
   */
  processRule(line, regexp, consumer) {
    let match = line.match(regexp);
    if (!match) {
      return false;
    }

    try {
      consumer.apply(this._proc, match.slice(1));
    } catch (exception) {
      throw this.exceptionParse(exception);
    }
    return true;
  }
}