import Capture from "./capture.js";
import { ensure, pointerTrim } from "./utils.js";

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
  delete this[prop];
};


function Obj(ptr) {
  this.id = logan.objects.length;
  // NOTE: when this list is enhanced, UI.summary has to be updated the "collect properties manually" section
  this.props = new Bag({ pointer: ptr, className: null, logid: this.id });
  this.captures = [];
  this.file = logan._proc.file;
  this.aliases = {};
  this._grep = false;
  this._dispatches = {};

  // This is used for placing the summary of the object (to generate
  // the unique ordered position, see UI.position.)
  // Otherwise there would be no other way than to use the first capture
  // that would lead to complicated duplications.
  this.placement = {
    time: logan._proc.timestamp,
    id: ++logan._proc.captureid,
  };

  logan.objects.push(this);
}

Obj.prototype.on = Bag.prototype.on;

Obj.prototype.create = function(className, capture = true) {
  if (this.props.className) {
    console.warn(logan.exceptionParse("object already exists, recreting automatically from scratch"));
    this.destroy();
    return logan._proc.obj(this.__most_recent_accessor).create(className);
  }

  ensure(logan.searchProps, className, { pointer: true, state: true, logid: true });

  this.props.className = className;
  this.prop("state", "created");

  if (capture) {
    this.capture();
  }
  return this;
};

Obj.prototype.alias = function(alias) {
  if (logan._proc.objs[alias] === this) {
    return this;
  }

  if (alias.match(NULLPTR_REGEXP)) {
    return this;
  }

  alias = pointerTrim(alias);
  logan._proc.objs[alias] = this;
  this.aliases[alias] = true;

  if (!alias.match(POINTER_REGEXP)) {
    logan._schema.update_alias_regexp();
  }

  return this;
};

Obj.prototype.destroy = function(ifClassName) {
  if (ifClassName && this.props.className !== ifClassName) {
    return this;
  }

  delete logan._proc.objs[this.props.pointer];
  let updateAliasRegExp = false;
  for (let alias in this.aliases) {
    if (!alias.match(POINTER_REGEXP)) {
      updateAliasRegExp = true;
    }
    delete logan._proc.objs[alias];
  }
  this.prop("state", "released");
  delete this._references;

  if (updateAliasRegExp) {
    logan._schema.update_alias_regexp();
  }

  return this.capture();
};

Obj.prototype.capture = function(what, info = null) {
  what = what || logan._proc.line;
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

Obj.prototype.expect = function(format, consumer, error = () => true) {
  let match = convertPrintfToRegexp(format);
  let obj = this;
  let thread = logan._proc.thread;
  let rule = logan._schema.plainIf(proc => {
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
  let sync = logan._proc._sync[id];

  if (!sync) {
    logan._proc._sync[id] = create();
    return this;
  }

  if (sync.sender) {
    while (sync.next) {
      sync = sync.next;
    }
    sync.next = create();
    return this;
  }

  delete logan._proc._sync[id];

  LOG(" send() calling on stored recv() " + logan._proc.line + " ipcid=" + this.ipc_id);

  let proc = logan._proc.swap(sync.proc);
  logan._proc.file.__recv_wait = false;
  sync.func(sync.receiver, this);
  logan._proc.restore(proc);

  return this;
},

Obj.prototype.recv = function(message, func = () => {}) {
  if (!logan._proc._ipc) {
    return this;
  }

  if (this.ipc_id === undefined) {
    return this;
  }

  let id = message + "::" + this.ipc_id;

  let sync = logan._proc._sync[id];
  if (!sync) {
    // There was no send() call for this ipcid and message, hence
    // we have to wait.  Store the recv() info and proccessing state
    // and stop parsing this file.
    logan._proc._sync[id] = {
      func: func,
      receiver: this,
      proc: logan._proc.save(),
    };

    logan._proc.file.__recv_wait = true;

    LOG(" blocking and storing recv() " + logan._proc.line + " ipcid=" + this.ipc_id + " file=" + logan._proc.file.name);
    return this;
  }

  if (sync.next) {
    logan._proc._sync[id] = sync.next;
  } else {
    delete logan._proc._sync[id];
  }

  LOG(" recv() taking stored send() " + logan._proc.line + " ipcid=" + this.ipc_id);

  this.capture({ run: sync.origin });
  func(this, sync.sender);

  return this;
};

export default Obj;
