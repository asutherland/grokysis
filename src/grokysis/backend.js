import BackendDB from './backend/db.js';
import SearchDriver from './backend/search_driver.js';


/**
 * This backend doesn't actually live in a worker due to our need to do HTML
 * parsing in the backend.  We are decoupled by way of a
 */
class BackendRouter {
  constructor(useAsPort) {
    // In a worker, useAsPort would be `self`, for now we're expecting an actual
    // MessagePort.
    useAsPort.addEventListener("message", this._onMessage.bind(this));
    useAsPort.start();
    this._port = useAsPort;

    this.db = null;
    this.searchDriver = null;
  }

  _onMessage(evt) {
    const data = evt.data;
    console.log("backend got:", data);
    const expectsReply = !!data.msgId;

    const { type, payload } = data;
    const handlerName = "msg_" + type;

    try {
      console.log("processing", type, "message, reply expected?", expectsReply, data);
      // Pass the msgId for the second arg for tracing purposes.
      const result = this[handlerName](payload, data.msgId);
      if (expectsReply) {
        Promise.resolve(result).then(
          (resolvedResult) => {
            console.log("reply sending", type, data);
            this._sendSuccessReply(data.msgId, resolvedResult);
          }, (err) => {
            console.error("exception asynchronously processing message:", err);
          });
      } else if (result && result.then && typeof(result.then) === 'function') {
        console.warn("message handler returned unexpected Promise", result,
                     "in response to", type, "message");
      } else if (result) {
        console.warn(
          "message handler returned unexpected non-Promise result", result);
      }
    } catch(ex) {
      console.error(`Problem processing message of type ${type}:`, data, ex);
      if (expectsReply) {
        this._sendFailureReply(data.msgId, ex);
      }
    }
  }

  _sendSuccessReply(msgId, payload) {
    this._port.postMessage({
      type: "reply",
      msgId,
      success: true,
      payload
    });
  }

  _sendFailureReply(msgId, err) {
    this._port.postMessage({
      type: "reply",
      msgId,
      success: false,
      payload: err.message
    });
  }

  async msg_init({ name }) {
    const treeName = name;
    this.searchDriver = new SearchDriver({ treeName });

    this.db = new BackendDB({ name });

    const { globals, sessionThings } = await this.db.init();
    return { globals, sessionThings };
  }

  msg_search(searchArgs, msgId) {
    return this.searchDriver.performSearch(searchArgs)
  }

  msg_configSetGlobal({ key, value }) {
    return this.db.setGlobal(key, value);
  }

  msg_persistSessionThing(diskRep) {
    return this.db.setSessionThing(diskRep);
  }

  msg_deleteSessionThingById(id) {
    return this.db.deleteSessionThingById(id);
  }
}

export default function makeBackend() {
  const channel = new MessageChannel();
  const router = new BackendRouter(channel.port2);
  return { backend: router, useAsPort: channel.port1 };
}
