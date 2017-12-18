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
  files: [],

  init: function() {
    for (let schema of Object.values(this._schemes)) {
      schema._finalize();
    }
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