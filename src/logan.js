import { removeFromArray } from "./utils.js"

const LOG = false ? (output) => { console.log(output) } : () => { };

const GREP_REGEXP = new RegExp("((?:0x)?[A-Fa-f0-9]{4,})", "g");
const POINTER_REGEXP = /^(?:0x)?0*([0-9A-Fa-f]+)$/;
const NULLPTR_REGEXP = /^(?:(?:0x)?0+|\(null\)|\(nil\))$/;
const CAPTURED_LINE_LABEL = "a log line";
const EPOCH_1970 = new Date("1970-01-01");

const FILE_SLICE = 1 * 1024 * 1024;
const USE_RULES_TREE_OPTIMIZATION = true;

let IF_RULE_INDEXER = 0;

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
 * Given a string, escape all characters that are recognized as RegExp syntax
 * with a backslash.  This is used both by convertPrintfToRegExp for logan's
 * magic label syntax as well as the search functionality.
 */
function escapeRegexp(s) {
  // "$&" means last match, so "\\$&" amounts to: put a single backslash in
  // front of the thing that just matched.
  return s.replace(/\n$/, "").replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

/**
 * Maps logan magic rule strings to regular expression capture groups.
 */
const printfToRegexpMap = [
  // IMPORTANT!!!
  // Use \\\ to escape regexp special characters in the match regexp (left),
  // we escapeRegexp() the string prior to this conversion which adds
  // a '\' before each of such chars.
  [/%p/g, "((?:(?:0x)?[A-Fa-f0-9]+)|(?:\\(null\\))|(?:\\(nil\\)))"],
  [/%d/g, "(-?[\\d]+)"],
  [/%h?u/g, "([\\d]+)"],
  [/%s/g, "([^\\s]*)"],
  [/%\\\*s/g, "(.*)"],
  [/%\d*[xX]/g, "((?:0x)?[A-Fa-f0-9]+)"],
  [/%(?:\d+\\\.\d+)?f/g, "((?:[\\d]+)\.(?:[\\d]+))"],
  [/%\\\*\\\$/g, "(.*$)"]
];

/**
 * Idempotently transform a logan magic printf style string like "Foo %p created
 * Bar %p and read %d bytes of data." into a Regular Expression.
 */
function convertPrintfToRegexp(printf) {
  if (RegExp.prototype.isPrototypeOf(printf)) {
    // already converted
    return printf;
  }

  printf = escapeRegexp(printf);

  for (let [source, target] of printfToRegexpMap) {
    printf = printf.replace(source, target);
  }

  return new RegExp('^' + printf + '$');
}

const logan = {
  _schemes: {},
  _schema: null,

  /**
   * MOVE: schema definition support code, now mootish.
   */
  schema: function(name, preparer, builder) {
    this._schema = ensure(this._schemes, name, () => new Schema(name, preparer));
    builder(this._schema);
  },

  /**
   * Misnomer, activates the given schema.
   */
  activeSchema: function(name) {
    this._schema = this._schemes[name];
  },

  parse: function(line, printf, consumer, unmatch) {
    let result;
    if (!this.processRule(line, convertPrintfToRegexp(printf), function() {
      result = consumer.apply(this, arguments);
    })) {
      return (unmatch && unmatch.call(this._proc, line));
    }
    return result;
  },


  // The rest is considered private

  exceptionParse: function(exception) {
    if (typeof exception === "object") {
      exception = "'" + exception.message + "' at " + exception.fileName + ":" + exception.lineNumber
    }
    exception += "\nwhile processing '" + this._proc.raw +
                  "'\nat " + this._proc.file.name + ":" + this._proc.linenumber;
    return new Error(exception);
  },

  files: [],

  init: function() {
    for (let schema of Object.values(this._schemes)) {
      schema._finalize();
    }
  },

  initProc: function(UI) {
    this.objects = [];
    this.searchProps = {};

    let parents = {};
    let children = {};
    let update = (array, item) => {
      return (array[item] = array[item] ? (array[item] + 1) : 1);
    };

    for (let file of this.files) {
      file.__base_name = rotateFileBaseName(file);
      if (isChildFile(file)) {
        file.__is_child = true;
        file.__base_order = update(children, file.__base_name);
      } else {
        file.__base_order = update(parents, file.__base_name);
      }
    }

    parents = Object.keys(parents).length;
    children = Object.keys(children).length;

    if (parents > 1) {
      UI.warn("More than one parent log - is that what you want?");
    }
    if (parents == 0 && children > 1) {
      UI.warn("Loading orphan child logs - is that what you want?");
    }

    this._proc._ipc = parents == 1 && children > 0;
    this._proc.threads = {};
    this._proc.objs = {};

    netdiag.reset();
  },

  /**
   * Fetch a URL as a Blob and hand off the result to `consumeFiles` to further
   * process the logs.
   *
   * TODO: UI entanglements.
   */
  consumeURL: function(UI, url) {
    this.seekId = 0;
    this.initProc(UI);

    fetch(url, { mode: 'cors', credentials: 'omit', }).then(function(response) {
      return response.blob();
    }).then(function(blob) {
      blob.name = "_net_"
      this.consumeFiles(UI, [blob]);
    }.bind(this));
  },

  /**
   * Given a list of log Blobs, trigger chunked parsing of each in parallel via
   * `readFile`, handing off consumption to `consumeParallel`.
   */
  consumeFiles: function(UI, files) {
    UI.searchingEnabled(false);

    this.files = Array.from(files);
    this.seekId = 0;
    this.initProc(UI);

    UI.resetProgress();

    files = [];
    for (let file of this.files) {
      if (!file.__is_child) {
        UI.title(file.__base_name);
      }
      files.push(this.readFile(UI, file));
    }

    Promise.all(files).then((files) => {
      this.consumeParallel(UI, files);
    });
  },

  /**
   * Given a File/Blob, incrementally read chunks of it to split its contents
   * into lines (with persistence of leftovers between chunks).  A promise
   * is returned of the form { file, lines, read_more }, where read_more is a
   * closure that will read the next chunk of the file.  The promise will reject
   * if there is a problem reading the string.
   *
   * Note that the File/Blob instances may have the following expandos set on
   * them:
   * - __is_child: True if `isChildFile` returned true for the file's name in
   *   initProc().
   * -
   * - __line_number: Initialized to 0 here, but updated by consumeParallel.
   * - __binary_offset: Initialize to the provided offset here, but updated by
   *   consumeParallel.  XXX Note that this value currently fails to account for
   *   newlines, so is unlikel to be useful for direct random access at this
   *   time.
   *
   * TODO: UI entanglements.
   * TODO: readAsBinaryString is used which is non-standard and likely a footgun
   * for utf-8 output.
   */
  readFile: function(UI, file, from = 0, chunk = FILE_SLICE) {
    UI && UI.addToMaxProgress(file.size);

    file.__line_number = 0;
    file.__binary_offset = from;

    let previousLine = "";
    let slice = (segmentoffset) => {
      return new Promise((resolve, reject) => {
        let blob = file.slice(segmentoffset, segmentoffset + chunk);
        if (blob.size == 0) {
          resolve({
            file: file,
            lines: [previousLine]
          });
          return;
        }

        let reader = new FileReader();
        reader.onloadend = (event) => {
          if (event.target.readyState == FileReader.DONE && event.target.result) {
            UI && UI.addToLoadProgress(blob.size);

            // Change chunk size to 5MB and Chrome self-time of shift() is 1000x slower!
            let lines = event.target.result.split(/(\r\n|\r|\n)/);

            // This simple code assumes that a single line can't be longer than FILE_SLICE
            lines[0] = previousLine + lines[0];
            previousLine = lines.pop();

            resolve({
              file: file,
              lines: lines,
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
  },

  /**
   * Suspiciously unused legacy function that uses `readFile` to provide lines
   * from the given offset, invoking a filter function for side-effects until
   * the filter function stops returning true and there are still lines.
   */
  readLine: async function(file, offset, filter) {
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
  },

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
  consumeParallel: async function(UI, files) {
    while (files.length) {
      // Make sure that the first line on each of the files is prepared
      // Preparation means to determine timestamp, thread name, module, if found,
      // or derived from the last prepared line
      singlefile: for (let file of Array.from(files)) {
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

          let line = file.lines.shift();

          let offset = file.file.__binary_offset;
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
  },

  /**
   * Helper to generate a prepared line object dictionary.  Additional fields
   * are set by its exclusive caller, `consumeParallel`.
   */
  prepareLine: function(line, previous) {
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
  },

  /**
   * The top of the call-stack for parsing lines and processing follows used
   * by `consumeParallel`.  Consumes a prepared line object dictionary
   * populated by `prepareLine` and with some additions by `consumeParallel`.
   * 
   * See processLine for documentation on how this method participates in the
   * logic related to `follow()` handling.
   */
  consumeLine: function(UI, file, prepared) {
    if (this.consumeLineByRules(UI, file, prepared)) {
      return;
    }

    let follow = this._proc.thread._engaged_follows[prepared.module];
    if (follow && !follow.follow(follow.obj, prepared.text, this._proc)) {
      delete this._proc.thread._engaged_follows[prepared.module];
    }
  },

  /**
   * Gets the Bag representing the named thread for the prepared line, creating
   * it if it does not already exist.  This bag tracks active "engaged" follows
   * keyed by module, or `0` for the un-tagged case.
   */
  ensureThread: function(file, prepared) {
    return ensure(this._proc.threads,
      file.__base_name + "|" + prepared.threadname,
      () => new Bag({ name: prepared.threadname, _engaged_follows: {} }));
  },

  /**
   * Sets up the `_proc` context for the given prepared line, selects the
   * correct set of rules based on the module (if provided) and invokes
   * `processLine`.  In the event the module did not exist or the module level
   * failed to process the line `processLine` is invoked with the `unmatch`
   * scope.  (TODO: better understand this fallback mechanism since it seems
   * error prone if the module was explicitly present.  If it can be inferred,
   * that makes more sense.)
   */
  consumeLineByRules: function(UI, file, prepared) {
    this._proc.file = file;
    this._proc.timestamp = prepared.timestamp;
    this._proc.line = prepared.text;
    this._proc.raw = prepared.raw;
    this._proc.module = prepared.module;
    this._proc.linenumber = prepared.linenumber;
    this._proc.binaryoffset = prepared.binaryoffset;
    this._proc.nextoffset = prepared.nextoffset;
    this._proc.thread = this.ensureThread(file, prepared);

    let module = this._schema.modules[prepared.module];
    if (module && this.processLine(module.get_rules(prepared.text), file, prepared)) {
      return true;
    }
    if (this.processLine(this._schema.unmatch, file, prepared)) {
      return true;
    }

    return false;
  },

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
  processLine: function(rules, file, prepared) {
    this._proc._pending_follow = null;

    if (this.processLineByRules(rules, file, prepared.text)) {
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
  },

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
  processLineByRules: function(rules, file, line) {
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
  },

  /**
   * Given a line and a regexp belonging to the passed-in consumer, attempt to
   * match the regexp.  If a match is returned, invoke the consumer, passing in
   * the capture groups as arguments to the consumer and `proc` passed as
   * `this`.
   */
  processRule: function(line, regexp, consumer) {
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
  },

  /**
   * At End-Of-Stream(?):
   * - report any expected IPC messages that were not observed for user
   *   awareness.
   * - Update a bunch of UI state.
   *
   * TODO: UI entanglement
   */
  processEOS: function(UI) {
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
  },

  /**
   * UI search functionality.  This almost certainly needs to have
   * https://github.com/mayhemer/logan/commit/1cf9780472ba87cd905ceec85a69b2c29023f4f1
   * merged/the post-commit state of that moved here or at least considered
   * before performing any mutations.
   *
   * Implementation-wise, this:
   * - Creates a parametrized matchFunc via closure.
   * - ...needs more investigation...
   */
  search: function(UI, className, propName, matchValue, match, seekId, coloring) {
    var matchFunc;
    propToString = (prop) => (prop === undefined ? "" : prop.toString());
    switch (match) {
      case "==": {
        if (propName === "pointer") {
          matchFunc = prop => pointerTrim(matchValue) == prop;
        } else {
          matchFunc = prop => matchValue == propToString(prop);
        }
        break;
      }
      case "!!": {
        matchFunc = prop => prop !== undefined;
        break;
      }
      case "!": {
        matchFunc = prop => prop === undefined;
        break;
      }
      case ">": {
        matchFunc = prop => prop > matchValue;
        break;
      }
      case "<": {
        matchFunc = prop => prop < matchValue;
        break;
      }
      case "contains": {
        let contains = new RegExp(escapeRegexp(matchValue), "g");
        matchFunc = prop => propToString(prop).match(contains);
        break;
      }
      case "!contains": {
        let ncontains = new RegExp(escapeRegexp(matchValue), "g");
        matchFunc = prop => !propToString(prop).match(ncontains);
        break;
      }
      case "rx": {
        let regexp = new RegExp(matchValue, "g");
        matchFunc = prop => propToString(prop).match(regexp);
        break;
      }
      case "!rx": {
        let nregexp = new RegExp(matchValue, "g");
        matchFunc = prop => !propToString(prop).match(nregexp);
        break;
      }
      default:
        throw "Unexpected match operator";
    }

    for (let obj of this.objects) {
      if (className !== '*' && className != obj.props.className) {
        continue;
      }
      if (seekId && obj.captures[0].id > seekId) {
        continue;
      }

      if (propName === CAPTURED_LINE_LABEL) {
        if (!obj.captures.find(capture => {
          if (seekId && capture.id > seekId) {
            return false;
          }
          return typeof capture.what === "string" && matchFunc(capture.what);
        })) {
          continue;
        }
      } else {
        if (seekId && obj.captures.slice(-1)[0].id >= seekId) {
          // The object lives around the cutting point, find the prop value
          var prop = "";
          let capture = obj.captures.find(capture => {
            if (capture.id > seekId) {
              return true;
            }
            if (typeof capture.what === "object" && capture.what.prop == propName) {
              prop = capture.what.value;
            }
            return false;
          }, this);
        } else {
          var prop = obj.props[propName];
        }
        if (!matchFunc(prop)) {
          continue;
        }
      }
      UI.addResult(obj).addClass("result").css("color", coloring);
    }
  },
}; // logan impl
export default logan;