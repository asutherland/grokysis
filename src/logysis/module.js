import { ensure } from "./utils.js";

function ruleMappingGrade1(input) {
  let splitter = /(\W)/;
  let grade1 = input.split(splitter, 1)[0];
  if (!grade1 || grade1.match(/%/g)) {
    // grade1 contains a dynamic part or is empty, use the whole input as mapping
    // this is specially handled in module.set_rule
    return input;
  }
  return grade1;
}

function ruleMappingGrade2(input) {
  let grade1 = ruleMappingGrade1(input);
  let grade2 = input.substring(grade1.length);
  return { grade1, grade2 };
}

function Module(name) {
  this.name = name;
  this.rules_flat = [];
  this.rules_tree = {};

  this.set_rule = function(rule, input) {
    if (USE_RULES_TREE_OPTIMIZATION) {
      let mapping = ruleMappingGrade2(input);
      if (mapping.grade2) {
        let grade2 = ensure(this.rules_tree, mapping.grade1, {});
        grade2[mapping.grade2] = rule;
      } else {
        // all one-grade rules go alone, to allow dynamic parts to be at the begining of rules
        this.rules_flat.push(rule);
      }
    } else {
      this.rules_flat.push(rule);
    }
  };

  this.get_rules = function(input) {
    if (USE_RULES_TREE_OPTIMIZATION) {
      // logan.init() converts rules_tree to array.
      return (this.rules_tree[ruleMappingGrade1(input)] || []).concat(this.rules_flat);
    }
    return this.rules_flat;
  };
}

Module.prototype.rule = function(exp, consumer = function(ptr) { this.obj(ptr).capture(); }) {
  this.set_rule({ regexp: convertPrintfToRegexp(exp), cond: null, consumer: consumer }, exp);
};

export default Module;
