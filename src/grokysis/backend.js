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

    this.searchDriver = null;
  }

  _onMessage(evt) {
    const data = evt.data;
    console.log("backend got:", data);
    const expectsReply = !!data.msgId;

    const { type, payload } = data;
    const handlerName = "msg_" + type;

    try {
      // Pass the msgId for the second arg for tracing purposes.
      const result = this[handlerName](payload, data.msgId);
      if (expectsReply) {
        Promise.resolve(result).then((resolvedResult) => {
          this._sendSuccessReply(data.msgId, resolvedResult);
        });
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

  msg_init({ name }) {
    const treeName = name;
    this.searchDriver = new SearchDriver({ treeName });
  }

  msg_search(searchArgs, msgId) {
    return this.searchDriver.performSearch(searchArgs)
  }
}

export default function makeBackend() {
  const channel = new MessageChannel();
  const router = new BackendRouter(channel.port2);
  return { backend: router, useAsPort: channel.port1 };
}
