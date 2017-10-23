function NetDiag() {
}
NetDiag.prototype = {
  enabled: true,

  reset: function() {
    this.channels = [];
    this.toploads = [];
    this.captures = [];
  },

  capture: function(obj, what) {
    if (!this.enabled || !obj) { // e.g. trans.httpchannel on a null transaction
      return {};
    }

    let capture = {};
    obj.capture({ net: what }, capture);
    this.captures.push(capture);
    return capture;
  },

  /*
    // Rules make the following direct object links:
    (PressShell | nsDocument).docshell.loadgroup."rc-id"
    (nsHttpTransaction).httpconnection.networksocket
    (nsHttpTransaction).httpchannel."rc-id"
  */

  topload: function(docshell, url) {
    let cap = this.capture(docshell, { load: url });
    this.toploads.push({ capture: cap, rcid: docshell.loadgroup.props["rc-id"] });
  },
  DOMContentLoaded: function(docshell) {
    if (docshell) {
      this.capture(docshell, { DOMContentLoaded: true });
    }
  },
  FirstPaint: function(docshell) {
    if (docshell) {
      this.capture(docshell, { FirstPaint: true });
    }
  },
  EndPageLoad: function(lg) {
    let topload = Array.from(this.toploads).reverse().find(load => load.rcid == lg.props["rc-id"]);
    if (topload) {
      topload.EndPageLoad_capture = this.capture(lg, { EndPageLoad: true });
    }
  },

  channelAsyncOpen: function(channel) {
    this.channels.push(channel);
    this.capture(channel, { ch_open: true });
  },
  channelCreatesTrans: function(channel, trans) {
    this.capture(channel, { ch_trans: trans });
  },
  channelRecognizedTracker: function(channel) {
    this.capture(channel, { ch_tracker_recon: true });
  },
  channelSuspend: function(channel) {
    this.capture(channel, { ch_suspend: true });
  },
  channelResume: function(channel) {
    this.capture(channel, { ch_resume: true });
  },
  channelCOS: function(channel, cos) {
    this.capture(channel, { ch_cos: cos });
  },
  channelPrio: function(channel, prio) {
    this.capture(channel, { ch_prio: prio });
  },
  channelDone: function(channel) {
    this.capture(channel, { ch_stop: true });
  },
  channelTailing: function(channel) {
    this.capture(channel, { ch_tailed: true });
  },
  channelUntailing: function(channel) {
    this.capture(channel, { ch_tailed: false });
  },

  transactionActive: function(trans) {
    this.capture(trans.httpchannel, { trans_active: trans });
  },
  transactionThrottled: function(trans) {
    this.capture(trans.httpchannel, { trans_throttle: trans });
  },
  transactionUnthrottled: function(trans) {
    this.capture(trans.httpchannel, { trans_unthrottle: trans });
  },
  transactionThrottlePressure: function(trans) {
    this.capture(trans.httpchannel, { trans_throttle_pressure: trans });
  },
  transactionReceived: function(trans, amount) {
    this.capture(trans.httpchannel, { trans_recv: trans, amount: amount });
  },
  transactionSended: function(trans, amount) {
    this.capture(trans.httpchannel, { trans_send: trans, amount: amount });
  },
  transactionDone: function(trans) {
    this.capture(trans.httpchannel, { trans_done: trans });
  },

  newSocket: function(sock) {
    this.capture(sock, { socket_open: sock });
  },
  socketStatus: function(sock, status) {
    this.capture(sock, { socket_status: status });
  },
  socketReady: function(sock) {
    this.capture(sock, { ready_at: now() });
  },
};

export default NetDiag;
