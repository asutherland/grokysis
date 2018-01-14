import Capture from "./capture.js";
import { POINTER_REGEXP, NULL_REGEXP, ensure, pointerTrim } from "./utils.js";

function Bag(def) {
  for (let prop in def) {
    this[prop] = def[prop];
  }
}

Bag.prototype.on = function(prop, handler, elseHandler) {
  if (!this[prop]) {
    if (elseHandler) {
      elseHandler();
    }
    return;
  }
  let val = handler(this[prop], this);
  if (val) {
    return (this[prop] = val);
  }
  // XXX asuth blind optimization: previously delete was used here, but that
  // is historically known to transform objects into hashmaps.  That is
  // (probably) undesirable because there is the potential for a useful shape to
  // emerge from log rules, so converting this to consistent assignment of
  // undefined.
  this[prop] = undefined;
};


function Obj(_proc, ptr) {
  this._proc = _proc;
  this.id = _proc.objects.length;
  // NOTE: when this list is enhanced, UI.summary has to be updated the "collect properties manually" section
  this.props = new Bag({ pointer: ptr, className: null, logid: this.id });
  this.captures = [];
  this.file = _proc.file;
  /**
   * List of aliases created to reference this object.  Should be a Set() or an
   * array.
   */
  this.aliases = {};
  this._grep = false;
  this._dispatches = {};

  /**
   * The most recent alias/ptr used to look-up this object.  Updated by
   * ProcContext._obj() on lookup.
   */
  this.__most_recent_accessor = ptr;

  // This is used for placing the summary of the object (to generate
  // the unique ordered position, see UI.position.)
  // Otherwise there would be no other way than to use the first capture
  // that would lead to complicated duplications.
  this.placement = {
    time: _proc.timestamp,
    id: ++_proc.captureid,
  };
}

Obj.prototype.on = Bag.prototype.on;

Obj.prototype.create = function(className, capture = true) {
  if (this.props.className) {
    console.warn(`Request to create with classname ${className} for object ` +
      `that already has classname ${this.props.className}, re-creating.`);
    this.destroy();
    return this._proc.obj(this.__most_recent_accessor).create(className);
  }

  ensure(this.searchProps, className, { pointer: true, state: true, logid: true });

  this.props.className = className;
  this.prop("state", "created");

  if (capture) {
    this.capture();
  }
  return this;
};

Obj.prototype.alias = function(alias) {
  if (this._proc.objs[alias] === this) {
    return this;
  }

  if (alias.match(NULLPTR_REGEXP)) {
    return this;
  }

  alias = pointerTrim(alias);
  this._proc._addAlias(this, alias);
  this.aliases[alias] = true;

  return this;
};

Obj.prototype.destroy = function(ifClassName) {
  if (ifClassName && this.props.className !== ifClassName) {
    return this;
  }

  this._proc._forgetObj(this);

  this.prop("state", "released");

  return this.capture();
};

Obj.prototype.capture = function(what, info = null) {
  what = what || this._proc.raw;

  let capture = Capture.prototype.isPrototypeOf(what) ? what : new Capture(what);

  if (info) {
    info.capture = capture;
    info.source = this;
    info.index = this.captures.length;
  }

  this.captures.push(capture);
  return this;
};

Obj.prototype.grep = function() {
  this._grep = true;
  return this;
};

// TODO: Consider removing the dynamism here in favor of somewhat more explicit
// handling in the ParseDriver so the general parse logic flow can be understood
// from just that file.
Obj.prototype.expect = function(format, consumer, error = () => true) {
  let match = convertPrintfToRegexp(format);
  let obj = this;
  let thread = this._proc.thread;
  let rule = this._schema.plainIf(proc => {
    if (proc.thread !== thread) {
      return false;
    }

    if (!logan.parse(proc.line, match, function() {
      return consumer.apply(this, [obj].concat(Array.from(arguments)).concat([this]));
    }, line => {
      return error(obj, line);
    })) {
      logan._schema.removeIf(rule);
    }
    return false;
  }, () => { throw "Obj.expect() handler should never be called"; });

  return this;
};

// TODO: Similar to expect, this has a bit more dynamism than is strictly,
// required, especially given there is already explicit follow support in the
// parsing logic.
Obj.prototype.follow = function(cond, consumer, error = () => true) {
  let capture = {
    obj: this,
    module: logan._proc.module,
    thread: logan._proc.thread,
  };

  if (typeof cond === "number") {
    capture.count = cond;
    capture.follow = (obj, line, proc) => {
      obj.capture(line);
      return --capture.count;
    };
  } else if (typeof cond === "string") {
    capture.follow = (obj, line, proc) => {
      return logan.parse(line, cond, function() {
        return consumer.apply(this, [obj].concat(Array.from(arguments)).concat([this]));
      }, line => {
        return error(obj, line);
      });
    };
  } else if (typeof cond === "function") {
    capture.follow = cond;
  } else {
    throw logan.exceptionParse("follow() 'cond' argument unexpected type '" + typeof cond + "'");
  }

  logan._proc._pending_follow = capture;
  return this;
}

Obj.prototype.prop = function(name, value, merge = false) {
  ensure(logan.searchProps, this.props.className)[name] = true;

  if (typeof merge === "funtion") {
    merge = merge(this);
  }

  if (value === undefined) {
    delete this.props[name];
  } else if (typeof value === "function") {
    this.props[name] = value(this.props[name] || 0);
  } else if (merge && this.props[name]) {
    this.props[name] += ("," + value);
  } else {
    this.props[name] = value;
  }
  return this.capture({ prop: name, value: this.props[name] });
};

Obj.prototype.propIf = function(name, value, cond, merge) {
  if (!cond(this)) {
    return this;
  }
  return this.prop(name, value, merge);
};

Obj.prototype.propIfNull = function(name, value) {
  if (name in this.props) {
    return this;
  }
  return this.prop(name, value);
};

Obj.prototype.state = function(state, merge = false) {
  if (!state) {
    return this.props["state"];
  }
  return this.prop("state", state, merge);
};

Obj.prototype.stateIf = function(state, cond, merge = false) {
  if (!cond(this)) {
    return this;
  }
  return this.prop("state", state, merge);
};

Obj.prototype.link = function(that) {
  that = logan._proc.obj(that);
  let capture = new Capture({ linkFrom: this, linkTo: that });
  this.capture(capture);
  that.capture(capture);
  return this;
};

Obj.prototype.mention = function(that) {
  if (typeof that === "string" && that.match(NULLPTR_REGEXP)) {
    return this;
  }
  that = logan._proc.obj(that);
  this.capture({ expose: that });
  return this;
};

Obj.prototype.class = function(className) {
  if (this.props.className) {
    // Already created
    return this;
  }
  return this.create(className, false).state("partial").prop("missing-constructor", true);
};

Obj.prototype.dispatch = function(target, name) {
  if (name === undefined) {
    target = this;
    name = target;
  }

  target = logan._proc.obj(target);

  let dispatch = {};
  this.capture({ dispatch: true }, dispatch);

  ensure(target._dispatches, name, []).push(dispatch);
  return this;
},

Obj.prototype.run = function(name) {
  let origin = this._dispatches[name];
  if (!origin) {
    return this;
  }

  let dispatch = origin.shift();
  if (!origin.length) {
    delete this._dispatches[name];
  }
  return this.capture({ run: dispatch }); // dispatch = { capture, source, index }
},

Obj.prototype.ipcid = function(id) {
  if (id === undefined) {
    return this.ipc_id;
  }
  this.ipc_id = id;
  return this.prop("ipc-id", id);
},

Obj.prototype.send = function(message) {
  if (!logan._proc._ipc) {
    return this;
  }
  if (this.ipc_id === undefined) {
    return this;
  }

  let create = () => {
    let origin = {};
    this.capture({ dispatch: true }, origin);
    LOG(" storing send() " + logan._proc.line + " ipcid=" + this.ipc_id);
    return {
      sender: this,
      origin: origin
    };
  };

  let id = message + "::" + this.ipc_id;
  let sync = this._proc._sync[id];

  if (!sync) {
    this._proc._sync[id] = create();
    return this;
  }

  if (sync.sender) {
    while (sync.next) {
      sync = sync.next;
    }
    sync.next = create();
    return this;
  }

  delete this._proc._sync[id];

  LOG(" send() calling on stored recv() " + this._proc.line + " ipcid=" + this.ipc_id);

  let proc = this._proc.swap(sync.proc);
  this._proc.file.__recv_wait = false;
  sync.func(sync.receiver, this);
  this._proc.restore(proc);

  return this;
},

Obj.prototype.recv = function(message, func = () => {}) {
  if (!this._proc._ipc) {
    return this;
  }

  if (this.ipc_id === undefined) {
    return this;
  }

  let id = message + "::" + this.ipc_id;

  let sync = this._proc._sync[id];
  if (!sync) {
    // There was no send() call for this ipcid and message, hence
    // we have to wait.  Store the recv() info and proccessing state
    // and stop parsing this file.
    this._proc._sync[id] = {
      func: func,
      receiver: this,
      proc: this._proc.save(),
    };

    this._proc.file.__recv_wait = true;

    LOG(" blocking and storing recv() " + this._proc.line + " ipcid=" + this.ipc_id + " file=" + this._proc.file.name);
    return this;
  }

  if (sync.next) {
    this._proc._sync[id] = sync.next;
  } else {
    delete this._proc._sync[id];
  }

  LOG(" recv() taking stored send() " + this._proc.line + " ipcid=" + this.ipc_id);

  this.capture({ run: sync.origin });
  func(this, sync.sender);

  return this;
};

export default Obj;
