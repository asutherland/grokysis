import { removeFromArray } from "./utils.js"

const LOG = false ? (output) => { console.log(output) } : () => { };

var logan = null;

const GREP_REGEXP = new RegExp("((?:0x)?[A-Fa-f0-9]{4,})", "g");
const POINTER_REGEXP = /^(?:0x)?0*([0-9A-Fa-f]+)$/;
const NULLPTR_REGEXP = /^(?:(?:0x)?0+|\(null\)|\(nil\))$/;
const CAPTURED_LINE_LABEL = "a log line";

(function() {

  const FILE_SLICE = 5 * 1024 * 1024;
  const USE_RULES_TREE_OPTIMIZATION = true;

  const EPOCH_1970 = new Date("1970-01-01");

  let IF_RULE_INDEXER = 0;

  function isChildFile(file) {
    return file.name.match(/\.child-\d+(?:\.\d+)?$/);
  }

  function isRotateFile(file) {
    return file.name.match(/^(.*)\.\d+$/);
  }

  function rotateFileBaseName(file) {
    let baseName = isRotateFile(file);
    if (baseName) {
      return baseName[1];
    }

    return file.name;
  }

  function escapeRegexp(s) {
    return s.replace(/\n$/, "").replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }

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

  // export
  logan = {
    // processing state sub-object, passed to rule consumers
    _proc: {
      _obj: function(ptr, store) {
        if (Obj.prototype.isPrototypeOf(ptr)) {
          return ptr;
        }

        ptr = pointerTrim(ptr);
        if (ptr === "0") {
          store = false;
        }

        let obj = this.objs[ptr];
        if (!obj) {
          obj = new Obj(ptr);
          if (store) {
            this.objs[ptr] = obj;
            if (!ptr.match(POINTER_REGEXP)) {
              logan._schema.update_alias_regexp();
            }
          }
        }

        obj.__most_recent_accessor = ptr;
        return obj;
      },

      objIf: function(ptr) {
        return this._obj(ptr, false);
      },

      obj: function(ptr) {
        return this._obj(ptr, true);
      },

      duration: function(timestamp) {
        if (!timestamp) {
          return undefined;
        }
        return this.timestamp.getTime() - timestamp.getTime();
      },

      // private

      save: function() {
        return ["timestamp", "thread", "line", "file", "module", "raw"].reduce(
          (result, prop) => (result[prop] = this[prop], result), {});
      },

      restore: function(from) {
        for (let property in from) {
          this[property] = from[property];
        }
      },

      swap: function(through) {
        let result = this.save();
        this.restore(through);
        return result;
      }
    },

    _schemes: {},
    _schema: null,

    schema: function(name, lineRegexp, linePreparer, builder) {
      this._schema = ensure(this._schemes, name, () => new Schema(name, lineRegexp, linePreparer));
      builder(this._schema);
    },

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
                   "'\nat " + this._proc.file.name + ":" + this._proc.linenumber + " (line#s are inaccurate)";
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
      this._proc.global = {};
      this._proc.captureid = 0;
      this._proc._captures = [];
      this._proc._sync = {};

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

    readFile: function(UI, file) {
      UI.addToMaxProgress(file.size);

      file.__line_number = 0;

      let previousLine = "";
      let slice = (segment) => {
        return new Promise((resolve, reject) => {
          let blob = file.slice(segment * FILE_SLICE, (segment + 1) * FILE_SLICE);
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
              UI.addToLoadProgress(blob.size);

              let lines = event.target.result.split(/[\r\n]+/);

              // This simple code assumes that a single line can't be longer than FILE_SLICE
              lines[0] = previousLine + lines[0];
              previousLine = lines.pop();

              resolve({
                file: file,
                lines: lines,
                read_more: () => slice(segment + 1)
              });
            }
          };

          reader.onerror = (event) => {
            console.error(`Error while reading segment ${segment} of ${file.name}`);
            console.exception(reader.error);
            window.onerror(reader.error);

            reader.abort();
            reject(reader.error);
          };

          reader.readAsBinaryString(blob);
        });
      };

      return slice(0);
    },

    consumeParallel: async function(UI, files) {
      while (files.length) {
        // Make sure that the first line on each of the files is prepared
        // Preparation means to determine timestamp, thread name, module, if found,
        // or derived from the last prepared line
        for (let file of Array.from(files)) {
          if (file.prepared) {
            continue;
          }

          if (!file.lines.length) {
            removeFromArray((item) => file === item, files);

            if (!file.read_more) {
              continue;
            }

            file = await file.read_more();
            files.push(file);
          }

          file.prepared = this.prepareLine(file.lines.shift(), file.previous);
          file.file.__line_number++;
        }

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

    prepareLine: function(line, previous) {
      previous = previous || {};

      let match = line.match(this._schema.lineRegexp);
      if (!match) {
        previous.module = 0;
        previous.raw = line;
        previous.text = line;
        previous.timestamp = previous.timestamp || EPOCH_1970;
        return previous;
      }

      previous = this._schema.linePreparer.apply(null, match);
      previous.raw = line;
      return previous;
    },

    consumeLine: function(UI, file, prepared) {
      if (this.consumeLineByRules(UI, file, prepared)) {
        return;
      }

      let follow = this._proc.thread._engaged_follows[prepared.module];
      if (follow && !follow.follow(follow.obj, prepared.text, this._proc)) {
        delete this._proc.thread._engaged_follows[prepared.module];
      }
    },

    consumeLineByRules: function(UI, file, prepared) {
      this._proc.file = file;
      this._proc.timestamp = prepared.timestamp;
      this._proc.line = prepared.text;
      this._proc.raw = prepared.raw;
      this._proc.module = prepared.module;
      this._proc.linenumber = file.__line_number;
      this._proc.thread = ensure(this._proc.threads,
        file.__base_name + "|" + prepared.threadname,
        () => new Bag({ name: prepared.threadname, _engaged_follows: {} }));

      let module = this._schema.modules[prepared.module];
      if (module && this.processLine(module.get_rules(prepared.text), file, prepared)) {
        return true;
      }
      if (this.processLine(this._schema.unmatch, file, prepared)) {
        return true;
      }

      return false;
    },

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

})();
