import { removeFromArray } from "./logysis/utils.js"

const LOG = false ? (output) => { console.log(output) } : () => { };

const USE_RULES_TREE_OPTIMIZATION = true;

let IF_RULE_INDEXER = 0;

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