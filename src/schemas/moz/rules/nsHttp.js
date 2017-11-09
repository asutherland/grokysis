import { convertProgressStatus } from "../types/ProgressStatus";

export default (module) => {
  /******************************************************************************
   * HttpChannelChild
   ******************************************************************************/

  module.rule("Creating HttpChannelChild @%p", function(ptr) {
    this.thread.httpchannelchild = this.obj(ptr).create("HttpChannelChild").grep();
  });
  module.rule("Destroying HttpChannelChild @%p", function(ptr) {
    this.obj(ptr).destroy();
  });
  module.rule("HttpChannelChild::AsyncOpen [this=%p uri=%s]", function(ptr, uri) {
    this.thread.httpchannelchild = this.obj(ptr).prop("url", uri).state("open").capture();
  });
  module.rule("HttpChannelChild::ContinueAsyncOpen this=%p gid=%u topwinid=%x", function(ch, gid, winid) {
    this.obj(ch).prop("top-win-id", winid).capture().ipcid(gid).send("HttpChannel");
  });
  module.rule("HttpChannelChild::ConnectParent [this=%p, id=%u]\n", function(ch, id) {
    this.obj(ch).capture().ipcid(id).send("HttpChannel::ConnectParent");
  });
  module.rule("HttpChannelChild::DoOnStartRequest [this=%p]", function(ptr) {
    this.obj(ptr).recv("HttpChannel::Start", ch => {
      ch.state("started").capture();
    });
  });
  module.rule("HttpChannelChild::OnTransportAndData [this=%p]", function(ptr) {
    this.obj(ptr).recv("HttpChannel::Data", ch => {
      ch.state("data").capture();
    });
  });
  module.rule("HttpChannelChild::OnStopRequest [this=%p]", function(ptr) {
    this.obj(ptr).recv("HttpChannel::Stop", ch => {
      ch.state("finished").capture();
    });
  });
  module.rule("HttpChannelChild::DoOnStopRequest [this=%p]", function(ptr) {
    this.obj(ptr).recv("HttpChannel::Stop", ch => {
      ch.state("finished").capture();
    });
  });
  module.rule("HttpChannelChild %p ClassOfService=%u", function(ch, cos) {
    ch = this.obj(ch).capture();
    netdiag.channelCOS(ch, parseInt(cos));
  });
  module.rule("HttpChannelChild::SetPriority %p p=%d", function(ch, prio) {
    ch = this.obj(ch).capture();
    netdiag.channelPrio(ch, parseInt(prio));
  });
  schema.summaryProps("HttpChannelChild", ["url", "status"]);

  /******************************************************************************
   * HttpChannelParent
   ******************************************************************************/

  module.rule("Creating HttpChannelParent [this=%p]", function(ptr) {
    this.thread.httpchannelparent = this.obj(ptr).create("HttpChannelParent").grep();
  });
  module.rule("HttpChannelParent RecvAsyncOpen [this=%p uri=%s, gid=%u topwinid=%x]\n", function(parent, uri, gid, winid) {
    this.obj(parent).capture().ipcid(gid).recv("HttpChannel", (parent, child) => {
      parent.httpchannelchild = child.link(parent);
    });
  });
  module.rule("HttpChannelParent::ConnectChannel: Looking for a registered channel [this=%p, id=%u]", function(ch, id) {
    this.obj(ch).ipcid(id).recv("HttpChannel::ConnectParent", (parent, child) => {
      parent.capture().follow("  and it is HttpBaseChannel %p", function(parent, httpch) {
        parent.link(this.obj(httpch).ipcid(parent.ipcid()));
      });
      parent.httpchannelchild = child.link(parent);
    });
  });
  module.rule("HttpChannelParent::OnStopRequest: [this=%p aRequest=%p status=%x]", function(parent, req) {
    this.obj(parent).capture().send("HttpChannel::Stop");
  });
  module.rule("Destroying HttpChannelParent [this=%p]", function(ptr) {
    this.obj(ptr).destroy();
  });

  /******************************************************************************
   * nsHttpChannel
   ******************************************************************************/

  module.rule("Creating nsHttpChannel [this=%p]", function(ch) {
    ch = this.obj(ch).create("nsHttpChannel").grep().expect("uri=%s", (ch, uri) => {
      ch.prop("url", uri);
    });
    this.thread.on("httpchannelparent", parent => {
      parent.link(ch.ipcid(parent.ipcid()));
      ch.httpparentchannel = parent;
    });
  });
  module.rule("Destroying nsHttpChannel [this=%p]", function(ptr) {
    this.obj(ptr).destroy();
  });
  module.rule("nsHttpChannel::Init [this=%p]", function(ptr) {
    this.thread.httpchannel_init = this.obj(ptr).capture();
  });
  schema.ruleIf("nsHttpChannel::SetupReplacementChannel [this=%p newChannel=%p preserveMethod=%d]",
    proc => proc.thread.httpchannel_init,
    function(oldch, newch, presmethod, channel) {
      delete this.thread.httpchannel_init;
      channel.alias(newch);
      this.obj(oldch).capture().link(newch);
    });
  module.rule("nsHttpChannel::AsyncOpen [this=%p]", function(ptr) {
    let channel = this.obj(ptr).state("open").capture();
    channel.__opentime = this.timestamp;
    netdiag.channelAsyncOpen(channel);
  });
  module.rule("nsHttpChannel [%p] created nsChannelClassifier [%p]", function(ch, clas) {
    this.obj(ch).link(clas).capture();
  });
  module.rule("nsHttpChannel::Connect [this=%p]", function(ptr) {
    this.obj(ptr).state("connected").capture();
  });
  module.rule("nsHttpChannel::TriggerNetwork [this=%p]", function(ptr) {
    this.obj(ptr).capture().follow(1);
  });
  module.rule("nsHttpChannel::OnCacheEntryCheck enter [channel=%p entry=%p]", function(ch, entry) {
    this.obj(ch).capture().mention(entry).follow(
      "nsHTTPChannel::OnCacheEntryCheck exit [this=%p doValidation=%d result=%d]", (obj, ptr, doValidation) => {
        obj.capture().prop("revalidates-cache", doValidation);
      },
      obj => obj.capture()
    );
  });
  module.rule("nsHttpChannel::OnCacheEntryAvailable [this=%p entry=%p new=%d appcache=%p status=%x mAppCache=%p mAppCacheForWrite=%p]", function(ch, entry, isnew) {
    this.obj(ch).capture().link(entry);
  });
  module.rule("nsHttpChannel::SetupTransaction [this=%p, cos=%u, prio=%d]\n", function(ch, cos, prio) {
    ch = this.obj(ch).prop("cos-before-trans-open", cos).prop("priority-before-trans-open", prio).capture();
    netdiag.channelCOS(ch, parseInt(cos));
    netdiag.channelPrio(ch, parseInt(prio));
  });
  module.rule("nsHttpChannel %p created nsHttpTransaction %p", function(ch, tr) {
    ch = this.obj(ch).capture().link(tr = this.obj(tr).prop("url", this.obj(ch).props["url"]));
    tr.httpchannel = ch;
    netdiag.channelCreatesTrans(ch, tr);
  });
  module.rule("nsHttpChannel::Starting nsChannelClassifier %p [this=%p]", function(cl, ch) {
    this.obj(ch).capture().link(this.obj(cl).class("nsChannelClassifier"));
  });
  module.rule("nsHttpChannel::ReadFromCache [this=%p] Using cached copy of: %s", function(ptr) {
    this.obj(ptr).prop("from-cache", true).capture();
  });
  module.rule("nsHttpChannel::OnStartRequest [this=%p request=%p status=%x]", function(ch, pump, status) {
    ch = this.obj(ch);
    ch.run("start")
      .prop("start-time", this.duration(ch.__opentime))
      .state("started")
      .capture();
  });
  module.rule("  calling mListener->OnStartRequest by ScopeExit [this=%p, listener=%p]\n", function(ch) {
    this.obj(ch).capture().send("HttpChannel::Start");
  });
  module.rule("  calling mListener->OnStartRequest [this=%p, listener=%p]\n", function(ch) {
    this.obj(ch).capture().send("HttpChannel::Start");
  });
  module.rule("HttpBaseChannel::DoNotifyListener this=%p", function(ch) {
    this.obj(ch).capture().send("HttpChannel::Start");
  });
  module.rule("nsHttpChannel::OnDataAvailable [this=%p request=%p offset=%d count=%d]", function(ch, pump) {
    ch = this.obj(ch);
    ch.run("data")
      .propIfNull("first-data-time", this.duration(ch.__opentime))
      .prop("last-data-time", this.duration(ch.__opentime))
      .state("data")
      .capture()
      .send("HttpChannel::Data");
  });
  module.rule("nsHttpChannel::OnStopRequest [this=%p request=%p status=%x]", function(ch, pump, status) {
    ch = this.obj(ch);
    ch.run("stop")
      .prop("status", status, true)
      .prop("stop-time", this.duration(ch.__opentime))
      .capture();
  });
  module.rule("nsHttpChannel %p calling OnStopRequest\n", function(ch) {
    ch = this.obj(ch).state("finished").capture();
    netdiag.channelDone(ch);
  });
  module.rule("nsHttpChannel::SuspendInternal [this=%p]", function(ch) {
    ch = this.obj(ch).prop("suspendcount", suspendcount => ++suspendcount).capture();
    netdiag.channelSuspend(ch);
  });
  module.rule("nsHttpChannel::ResumeInternal [this=%p]", function(ch) {
    ch = this.obj(ch).run("resume").prop("suspendcount", suspendcount => --suspendcount).capture();
    netdiag.channelResume(ch);
  });
  module.rule("nsHttpChannel::Cancel [this=%p status=%x]", function(ptr, status) {
    this.obj(ptr).prop("cancel-status", status).prop("late-cancel", this.obj(ptr).state() == "finished").state("cancelled").capture();
  });
  module.rule("nsHttpChannel::ContinueProcessResponse1 [this=%p, rv=%x]", function(ptr) {
    this.thread.httpchannel_for_auth = this.obj(ptr).capture();
  });
  module.rule("nsHttpChannel::ProcessResponse [this=%p httpStatus=%d]", function(ptr, status) {
    this.thread.httpchannel_for_auth = this.obj(ptr).prop("http-status", status, true).capture();
  });
  module.rule("sending progress notification [this=%p status=%x progress=%d/%d]", function(ch, status) {
    this.obj(ch).capture().capture("  " + status + " = " + convertProgressStatus(status));
  });
  module.rule("sending progress and status notification [this=%p status=%x progress=%u/%d]", function(ch, status) {
    this.obj(ch).capture().capture("  " + status + " = " + convertProgressStatus(status));
  });
  module.rule("HttpBaseChannel::SetIsTrackingResource %p", function(ch) {
    ch = this.obj(ch).prop("tracker", true).capture();
    netdiag.channelRecognizedTracker(ch);
  });
  module.rule("nsHttpChannel %p on-local-blacklist=%d", function(ch, lcb) {
    this.obj(ch).prop("local-block-list", lcb === "1").capture();
  });
  module.rule("nsHttpChannel::WaitingForTailUnblock this=%p, rc=%p", function(ch, rc) {
    this.thread.tail_request = this.obj(ch).capture().mention(rc).follow("  blocked=%d", (ch, blocked) => {
      if (blocked === "1") {
        ch.prop("tail-blocked", true).capture().__blocktime = this.timestamp;
        netdiag.channelTailing(ch);
      }
    });
  });
  module.rule("nsHttpChannel::OnTailUnblock this=%p rv=%x rc=%p", function(ch, rv, rc) {
    ch = this.obj(ch);
    let after = this.duration(ch.__blocktime);
    ch.prop("tail-blocked", false).prop("tail-block-time", after)
      .capture().capture("  after " + after + "ms").mention(rc);
    netdiag.channelUntailing(ch);
  });
  module.rule("HttpBaseChannel::AddAsNonTailRequest this=%p, rc=%p, already added=%d", function(ch, rc, added) {
    this.thread.tail_request =
      this.obj(ch).prop("tail-blocking", true).capture().mention(rc);
  });
  module.rule("HttpBaseChannel::RemoveAsNonTailRequest this=%p, rc=%p, already added=%d", function(ch, rc, added) {
    this.thread.tail_request =
      this.objIf(ch).propIf("tail-blocking", false, () => added === "1").capture().mention(rc);
  });
  module.rule("HttpBaseChannel::EnsureRequestContextID this=%p id=%x", function(ch, rcid) {
    this.obj(ch).prop("rc-id", rcid).capture();
  });
  module.rule("HttpBaseChannel::EnsureRequestContext this=%p rc=%p", function(ch, rc) {
    this.obj(ch).capture().mention(rc);
  });
  module.rule("nsHttpChannel::OnClassOfServiceUpdated this=%p, cos=%u", function(ch, cos) {
    ch = this.obj(ch).capture().capture("  cos = " + schema.ClassOfServiceFlags.stringify(cos));
    netdiag.channelCOS(ch, parseInt(cos));
  });
  module.rule("nsHttpChannel::SetPriority %p p=%d", function(ch, prio) {
    ch = this.obj(ch).capture();
    netdiag.channelPrio(ch, parseInt(prio));
  });
  schema.summaryProps("nsHttpChannel", ["http-status", "url", "status"]);

  /******************************************************************************
   * nsHttpChannelAuthProvider
   ******************************************************************************/

  schema.ruleIf("nsHttpChannelAuthProvider::ProcessAuthentication [this=%p channel=%p code=%u SSLConnectFailed=%d]",
    proc => proc.thread.httpchannel_for_auth, function(ptr, ch, code, sslcon, auth_ch)
  {
    delete this.thread.httpchannel_for_auth;
    let provider = this.obj(ptr).class("nsHttpChannelAuthProvider").grep().follow(1);
    provider._channel = auth_ch.alias(ch).capture().link(ptr);
  });
  module.rule("nsHttpChannelAuthProvider::PromptForIdentity [this=%p channel=%p]", function(ptr, ch) {
    this.obj(ptr).capture().on("_channel", ch => ch.prop("asked-credentials", true));
  });
  module.rule("nsHttpChannelAuthProvider::AddAuthorizationHeaders? [this=%p channel=%p]\n", function(ptr, ch) {
    this.obj(ptr).capture().follow(2);
  });

  /******************************************************************************
   * nsHttpTransaction
   ******************************************************************************/

  module.rule("Creating nsHttpTransaction @%p", function(trans) {
    this.thread.httptransaction = (trans = this.obj(trans).create("nsHttpTransaction").grep());
  });
  module.rule("nsHttpTransaction::Init [this=%p caps=%x]", function(trans) {
    this.obj(trans).capture().follow("  window-id = %x", function(trans, id) {
      trans.prop("tab-id", id);
    });
  });
  schema.ruleIf("http request [", proc => proc.thread.httptransaction, function(trans) {
    delete this.thread.httptransaction;
    trans.capture().follow((trans, line) => {
      trans.capture(line);
      return line !== "]";
    });
  });
  schema.ruleIf("nsHttpConnectionMgr::AtActiveConnectionLimit [ci=%s caps=%d,totalCount=%d, maxPersistConns=%d]",
    proc => proc.thread.httptransaction, function(ci, caps, total, max, trans) {
      trans.capture().mention(ci);
    });
  schema.ruleIf("AtActiveConnectionLimit result: %s", proc => proc.thread.httptransaction, function(atlimit, trans) {
    delete this.thread.httptransaction;
    trans.capture();
  });
  module.rule("  adding transaction to pending queue [trans=%p pending-count=%d]", function(trans, pc) {
    trans = this.obj(trans).state("pending").capture();
    this.thread.on("conn_info", conn_info => {
      conn_info.link(trans);
    });
  });
  module.rule("nsHttpTransaction::HandleContentStart [this=%p]", function(trans) {
    trans = this.obj(trans);
    trans.dispatch(trans.httpchannel, "start");
    this.thread.httptransaction = trans;
  });
  schema.ruleIf("http response [", proc => proc.thread.httptransaction, function(trans) {
    delete this.thread.httptransaction;
    trans.capture().follow((trans, line) => {
      trans.capture(line);
      return line !== "]";
    });
  });
  module.rule("nsHttpTransaction %p SetRequestContext %p", function(trans, rc) {
    this.obj(rc).link(trans);
  });
  module.rule("   blocked by request context: [rc=%p trans=%p blockers=%d]", function(rc, trans) {
    this.obj(trans).state("blocked").capture().mention(rc);
  });
  module.rule("nsHttpTransaction adding blocking transaction %p from request context %p", function(trans, rc) {
    this.obj(trans).prop("blocking", true).capture();
    this.obj(rc).capture().mention(trans);
  });
  module.rule("nsHttpTransaction removing blocking transaction %p from request context %p. %d blockers remain.", function(trans, rc) {
    this.obj(trans).capture().mention(rc);
  });
  module.rule("nsHttpTransaction %p request context set to null in ReleaseBlockingTransaction() - was %p", function(trans, rc) {
    this.obj(trans).capture().mention(rc);
  });
  module.rule("nsHttpTransaction::Close [this=%p reason=%d]", function(trans, status) {
    trans = this.obj(trans).prop("status", status).state("closed").capture();
    trans.dispatch(trans.httpchannel, "stop");
    netdiag.transactionDone(trans);
    this.thread.closedhttptransaction = trans;
  });
  module.rule("nsHttpTransaction::WritePipeSegment %p written=%u", function(trans, count) {
    trans = this.obj(trans).capture().dispatch(trans.httpchannel, "data");
    netdiag.transactionReceived(trans, parseInt(count));
  });
  module.rule("nsHttpTransaction::ReadRequestSegment %p read=%u", function(trans, count) {
    trans = this.obj(trans).capture();
    netdiag.transactionSended(trans, parseInt(count));
  });
  module.rule("nsHttpTransaction::ShouldStopReading entry pressure this=%p", function(trans) {
    trans = this.obj(trans).prop("throttling-under-pressure", true).capture();
    netdiag.transactionThrottlePressure(trans);
  });
  module.rule("nsHttpTransaction::WriteSegments %p response throttled", function(trans) {
    trans = this.obj(trans).prop("throttled", true).prop("ever-throttled", true).capture();
    netdiag.transactionThrottled(trans);
  });
  module.rule("nsHttpTransaction::ResumeReading %p", function(trans) {
    this.obj(trans).prop("throttled", false).capture();
    netdiag.transactionUnthrottled(trans);
  });
  module.rule("nsHttpConnectionMgr::ShouldThrottle trans=%p", function(trans) {
    this.obj(trans).capture().follow("  %*$", trans => trans.capture());
  });
  module.rule("Destroying nsHttpTransaction @%p", function(ptr) {
    this.obj(ptr).destroy();
  });
  schema.summaryProps("nsHttpTransaction", ["blocking", "tab-id", "url"]);

  /******************************************************************************
   * nsHttpConnection
   ******************************************************************************/

  module.rule("Creating nsHttpConnection @%p", function(ptr) {
    this.obj(ptr).create("nsHttpConnection").grep();
  });
  module.rule("nsHttpConnection::Init this=%p sockettransport=%p", function(conn, sock) {
    conn = this.obj(conn).capture();
    // The socket link is added as part of the halfopen connection creation
  });
  module.rule("nsHttpConnection::Activate [this=%p trans=%p caps=%x]", function(conn, trans, caps) {
    conn = this.obj(conn).capture();
    trans = this.obj(trans).state("active").capture().link(conn);
    trans.httpconnection = conn;
    netdiag.transactionActive(trans);
  });
  module.rule("nsHttpConnection::SetUrgentStartOnly [this=%p urgent=%d]", function(conn, urgent) {
    this.obj(conn).prop("urgent", urgent === "1").capture();
  });
  module.rule("nsHttpConnection::OnSocketWritable %p ReadSegments returned [rv=%d read=%d sock-cond=%x again=%d]", function(conn, rv, read, cond, again) {
    conn = this.obj(conn).class("nsHttpConnection").capture().grep();
    if (parseInt(read) > 0) {
      conn.state("sent");
    }
    this.thread.on("networksocket", st => {
      conn.mention(st);
      return st;
    });
  });
  module.rule("nsHttpConnection::OnSocketReadable [this=%p]", function(conn) {
    conn = this.obj(conn).class("nsHttpConnection").state("recv").capture().grep();
    this.thread.on("networksocket", st => {
      conn.mention(st);
      return st;
    });
  });
  module.rule("nsHttpConnection::CloseTransaction[this=%p trans=%p reason=%x]", function(conn, trans, rv) {
    this.obj(conn).state("done").capture().mention(trans);
  });
  module.rule("Entering Idle Monitoring Mode [this=%p]", function(conn) {
    this.obj(conn).state("idle").capture();
  });
  module.rule("nsHttpConnectionMgr::OnMsgReclaimConnection [ent=%p conn=%p]", function(ent, conn) {
    this.thread.httpconnection_reclame = this.obj(conn).capture().mention(ent);
    this.thread.httpconnection_reclame.closedtransaction = this.thread.closedhttptransaction;
  });
  module.rule("nsHttpConnection::MoveTransactionsToSpdy moves single transaction %p into SpdySession %p", function(tr, session) {
    this.thread.httpspdytransaction = this.obj(tr);
  });
  module.rule("nsHttpConnection::EnsureNPNComplete %p [%s] negotiated to '%s'", function(conn, entry, proto) {
    this.obj(conn).prop("npn", proto).capture();
    this.thread.spdyconnentrykey = entry; // we want the key
  });
  module.rule("Destroying nsHttpConnection @%p", function(ptr) {
    this.obj(ptr).destroy();
  });

  /******************************************************************************
   * Http2Session
   ******************************************************************************/

  module.rule("Http2Session::Http2Session %p serial=%x", function(session) {
    session = this.obj(session).create("Http2Session").grep();
    this.thread.on("spdyconnentrykey", ent => {
      session.prop("key", ent).mention(ent);
    });
  });
  module.rule("Http2Session::~Http2Session %p mDownstreamState=%x", function(session) {
    this.obj(session).destroy();
  });
  module.rule("Http2Session::AddStream session=%p stream=%p serial=%u NextID=0x%X (tentative)",
    function(session, stream, serial, id) {
      stream = this.obj(stream).prop("id", id);
      session = this.obj(session).class("Http2Session").grep().link(stream);
    });
  module.rule("Http2Session::LogIO %p stream=%p id=%x [%*s]", function(session, stream, id, what) {
    this.obj(session).class("Http2Session").capture().mention(stream);
  });
  schema.summaryProps("Http2Session", ["key"]);

  /******************************************************************************
   * Http2Stream
   ******************************************************************************/

  module.rule("Http2Stream::Http2Stream %p", function(ptr) {
    let stream = this.obj(ptr).create("Http2Stream").grep();
    this.thread.on("httpspdytransaction", tr => {
      tr.link(stream);
      stream.prop("url", tr.props["url"]);
      stream.httptransaction = tr;
    });
  });
  module.rule("Http2Stream::~Http2Stream %p", function(ptr) {
    this.obj(ptr).destroy();
  });
  module.rule("Http2Stream::ChangeState() %p from %d to %d", function(stream, oldst, newst) {
    switch (parseInt(newst)) {
      case 0: newst = "GENERATING_HEADERS"; break;
      case 1: newst = "GENERATING_BODY"; break;
      case 2: newst = "SENDING_BODY"; break;
      case 3: newst = "SENDING_FIN_STREAM"; break;
      case 4: newst = "UPSTREAM_COMPLETE"; break;
    }
    this.obj(stream).prop("upstreamstate", newst).capture();
  });
  module.rule("Http2Session::ReadSegments %p stream=%p stream send complete", function(sess, stream) {
    this.obj(stream).state("sent").capture();
  });
  module.rule("Http2Stream::ConvertResponseHeaders %p response code %d", function(stream, code) {
    this.obj(stream).state("headers").capture();
  });
  module.rule("Start Processing Data Frame. Session=%p Stream ID %X Stream Ptr %p Fin=%d Len=%d", function(sess, streamid, stream, fin, len) {
    this.obj(stream).state("data").capture();
  });
  module.rule("Http2Stream::WriteSegments %p Buffered %X %d\n", function(stream, id, count) {
    stream = this.obj(stream).capture();
    // This only buffers the data, but it's an actual read from the socket, hence we
    // want it to be marked.  The rule for "read from flow control buffer" just below
    // will negate this so that the report from the transaction will balance.
    if (stream.httptransaction) {
      netdiag.transactionReceived(stream.httptransaction, parseInt(count));
    }
  });
  module.rule("Http2Stream::OnWriteSegment read from flow control buffer %p %x %d\n", function(stream, id, count) {
    stream = this.obj(stream).capture();
    // This is buffered data read and has already been reported on the transaction in the just above rule,
    // hence, make it negative to be ignored, since the transaction will report it again
    if (stream.httptransaction) {
      netdiag.transactionReceived(stream.httptransaction, -parseInt(count));
    }
  });
  module.rule("Http2Session::CloseStream %p %p 0x%x %X", function(sess, stream, streamid, result) {
    this.obj(stream).state("closed").prop("status", result).capture();
  });
  schema.summaryProps("Http2Stream", ["status", "url"]);

  /******************************************************************************
   * nsHalfOpenSocket
   ******************************************************************************/

  module.rule("Creating nsHalfOpenSocket [this=%p trans=%p ent=%s key=%s]", function(ho, trans, ent, key) {
    this.thread.halfopen = this.obj(ho).create("nsHalfOpenSocket").prop("key", key).grep();
  });
  module.rule("nsHalfOpenSocket::SetupPrimaryStream [this=%p ent=%s rv=%x]", function(ho, ent, rv) {
    ho = this.obj(ho).capture();
    this.thread.on("networksocket", (sock) => {
      ho.link(sock).primarysocket = sock;
    });
  });
  module.rule("nsHalfOpenSocket::SetupBackupStream [this=%p ent=%s rv=%x]", function(ho, ent, rv) {
    ho = this.obj(ho).capture();
    this.thread.on("networksocket", (sock) => {
      ho.link(sock).backupsocket = sock;
    });
  });
  module.rule("nsHalfOpenSocket::OnOutputStreamReady [this=%p ent=%s %s]", function(ho, end, streamtype) {
    this.thread.halfopen = this.obj(ho).capture();
  });
  module.rule("nsHalfOpenSocket::StartFastOpen [this=%p]", function(ho) {
    this.thread.halfopen = this.obj(ho).capture();
  });
  schema.ruleIf("nsHalfOpenSocket::SetupConn Created new nshttpconnection %p", proc => proc.thread.halfopen, function(conn, ho) {
    delete this.thread.halfopen;
    this.thread.on("networksocket", st => {
      conn = this.obj(conn).link(st);
      conn.networksocket = st;
    });
    ho.link(conn).capture();
  });
  module.rule("Destroying nsHalfOpenSocket [this=%p]", function(ptr) {
    this.obj(ptr).destroy();
  });
  schema.summaryProps("nsHalfOpenSocket", ["key"]);

  /******************************************************************************
   * connection manager
   ******************************************************************************/

  module.rule("nsConnectionEntry::nsConnectionEntry this=%p key=%s", function(ptr, key) {
    this.obj(ptr).create("nsConnectionEntry").alias(key).grep().prop("key", key);
  });
  module.rule("nsConnectionEntry::~nsConnectionEntry this=%p", function(ptr, key) {
    this.obj(ptr).destroy();
  });
  module.rule("nsHttpConnectionMgr::OnMsgProcessPendingQ [ci=%s]", function(key) {
    if (key === "nullptr") {
      return;
    }
    let connEntry = this.obj(key).capture();
    this.thread.on("httpconnection_reclame", conn => {
      connEntry.mention(conn);
      conn.on("closedtransaction", trans => {
        connEntry.capture("Last transaction on the connection:").mention(trans);
      });
    });
  });
  module.rule("nsHttpConnectionMgr::ProcessPendingQForEntry [ci=%s ent=%p active=%d idle=%d urgent-start-queue=%d queued=%d]", function(ci, ent) {
    this.obj(ci).class("nsConnectionEntry").grep().capture().follow("  %p", (ci, trans) => {
      return ci.mention(trans);
    }, (ci, line) => {
      ci.capture();
      return line !== "]";
    });
  });
  module.rule("nsHttpConnectionMgr::TryDispatchTransaction without conn " +
              "[trans=%p halfOpen=%p conn=%p ci=%p ci=%s caps=%x tunnelprovider=%p " +
              "onlyreused=%d active=%u idle=%u]", function(trans, half, conn, ci, ci_key) {
      this.thread.httptransaction = this.obj(trans).capture("Attempt to dispatch on " + ci_key).mention(ci_key);
      this.thread.conn_info = this.obj(ci_key).capture().expect("   %*$", (ci) => {
        ci.capture();
      }).mention(trans).mention(conn);
    });
  schema.ruleIf("Spdy Dispatch Transaction via Activate(). Transaction host = %s, Connection host = %s",
    proc => proc.thread.httptransaction, function(trhost, conhost, tr) {
      this.thread.httpspdytransaction = tr;
    });
  module.rule("nsHttpConnectionMgr::TryDispatchTransactionOnIdleConn, ent=%p, trans=%p, urgent=%d", function(ent, trans, ur) {
    this.obj(trans).capture().follow("  %* [conn=%p]", (trans, message, conn) => {
      trans.capture().mention(conn);
    });
  });
  schema.summaryProps("nsConnectionEntry", "key");
};
