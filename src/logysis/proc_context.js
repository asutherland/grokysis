/**
 * Processing context exposed to rule invocations as their `this`.
 */
export default class ProcContext {
  constructor() {
    this.global = {};
    this.captureid = 0;
    this._captures = [];
    this._sync = {};
  }

  _obj(ptr, store) {
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
  }

  objIf(ptr) {
    return this._obj(ptr, false);
  }

  obj(ptr) {
    return this._obj(ptr, true);
  }

  duration(timestamp) {
    if (!timestamp) {
      return undefined;
    }
    return this.timestamp.getTime() - timestamp.getTime();
  }

  // private
  save() {
    return ["timestamp", "thread", "line", "file", "module", "raw", "binaryoffset"].reduce(
      (result, prop) => (result[prop] = this[prop], result), {});
  }

  restore(from) {
    for (let property in from) {
      this[property] = from[property];
    }
  }

  swap(through) {
    let result = this.save();
    this.restore(through);
    return result;
  }
};
