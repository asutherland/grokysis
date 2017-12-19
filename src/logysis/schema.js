import { ensure, pointerTrim, removeFromArray } from "./utils.js";

/**
 *
 *
 * @param {*} namespace
 * @param {*} preparer 
 */
function Schema(namespace, preparer) {
  this.namespace = namespace;
  this.preparer = preparer;
  this.modules = {};
  this.unmatch = [];
  /**
   * Aggregate information to report to the UI for the given schema.
   */
  this.ui = {
    summary: {}, // map: className -> prop to display on the summary line
  };

  this._finalize = function() {
    if (USE_RULES_TREE_OPTIMIZATION) {
      for (let module of Object.values(this.modules)) {
        for (let grade1 in module.rules_tree) {
          module.rules_tree[grade1] = Object.values(module.rules_tree[grade1]);
        }
      }
    }

    // This is grep() handler, has to be added as last because its condition handler
    // never returns true making following conditional rules process the line as well.
    this.plainIf(function(state) {
      for (let regexp of [GREP_REGEXP, this.nonPtrAliases]) {
        if (!regexp) {
          break;
        }
        let pointers = state.line.match(regexp);
        if (pointers) {
          if (pointers.length === 1 && state.line.trim() == pointers[0]) {
            // It doesn't make sense to include (lines only containing the pointer.
            // TODO the condition here should be made even smarter to filter out
            // more of just useless lines.
            break;
          }
          for (let ptr of pointers) {
            let obj = state.objs[pointerTrim(ptr)];
            if (obj && obj._grep) {
              obj.capture();
            }
          }
        }
      }
    }.bind(this), () => { throw "grep() internal consumer should never be called"; });
  };
}

Schema.prototype.module = function(name, builder) {
  builder(ensure(this.modules, name, new Module(name)));
}

Schema.prototype.plainIf = function(condition, consumer) {
  let rule = { cond: condition, consumer: consumer, id: ++IF_RULE_INDEXER };
  this.unmatch.push(rule);
  return rule;
};

Schema.prototype.ruleIf = function(exp, condition, consumer) {
  let rule = { regexp: convertPrintfToRegexp(exp), cond: condition, consumer: consumer, id: ++IF_RULE_INDEXER };
  this.unmatch.push(rule);
  return rule;
};

Schema.prototype.removeIf = function(rule) {
  removeFromArray(item => item.id === rule.id, this.unmatch);
}

/**
 * Defines the list of (interesting) props for the given class so that the UI
 * can expose them.
 */
Schema.prototype.summaryProps = function(className, arrayOfProps) {
  this.ui.summary[className] = arrayOfProps;
};

export default Schema;
