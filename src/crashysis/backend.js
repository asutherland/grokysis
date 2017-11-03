
import CrashDB from "./crash_db";

class BackendRouter() {
  constructor() {
    this.name = "";
    this.db =

    self.addEventListener("message", this._onMessage.bind(this));
  }

  _onMessage(evt) {
    const data = evt.data;
    const expectsReply = !!data.msgId;

    const type = data.payload;
    const handlerName = "msg_" + type;

    try {
      this[handlerName](data.payload);
    } catch(ex) {
      console.error(`Problem processing message of type ${type}:`, data, ex);
    }
  }

  msg_init({ name }) {
    this.name = name;

  }
}

const router = new BackendRouter();
