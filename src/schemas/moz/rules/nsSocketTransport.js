import { convertProgressStatus } from "../types/ProgressStatus";

export default (module) => {
  /******************************************************************************
   * nsSocketTransport
   ******************************************************************************/

  module.rule("creating nsSocketTransport @%p", function(sock) {
    this.thread.networksocket = this.obj(sock).create("nsSocketTransport").grep();
    netdiag.newSocket(this.thread.networksocket);
  });
  module.rule("nsSocketTransport::Init [this=%p host=%s:%hu origin=%s:%d proxy=%s:%hu]\n", function(sock, host, hp, origin, op, proxy, pp) {
    this.obj(sock).prop("host", host + ":" + hp).prop("origin", origin + ":" + op).capture();
  });
  module.rule("nsSocketTransport::BuildSocket [this=%p]\n", function(sock) {
    this.obj(sock).capture().follow("  [secinfo=%p callbacks=%p]\n", (sock) => {
      this.thread.on("sslsocket", ssl => {
        sock.link(ssl).sslsocket = ssl;
      });
    });
  });
  module.rule("nsSocketTransport::InitiateSocket TCP Fast Open started [this=%p]", function(sock) {
    this.thread.networksocket = this.obj(sock).prop("attempt-TFO", true).capture()
      .follow("nsSocketTransport::InitiateSocket skipping speculative connection for host %*$", (sock) => { sock.capture() });
  });
  module.rule("nsSocketTransport::OnSocketReady [this=%p outFlags=%d]", function(ptr, flgs) {
    this.thread.networksocket = this.obj(ptr).class("nsSocketTransport").prop("last-poll-flags", flgs).capture();
    netdiag.socketReady(this.thread.networksocket);
  });
  module.rule("nsSocketTransport::SendStatus [this=%p status=%x]", function(sock, st) {
    sock = this.obj(sock).class("nsSocketTransport").capture()
      .capture(`  ${st} = ${convertProgressStatus(st)}`).prop("last-status", convertProgressStatus(st));
    netdiag.socketStatus(sock, convertProgressStatus(st));
  });
  module.rule("nsSocketOutputStream::OnSocketReady [this=%p cond=%d]", function(ptr, cond) {
    this.thread.on("networksocket", st => st.alias(ptr).prop("output-cond", cond).capture());
  });
  module.rule("nsSocketInputStream::OnSocketReady [this=%p cond=%d]", function(ptr, cond) {
    this.thread.on("networksocket", st => st.alias(ptr).prop("input-cond", cond).capture());
  });
  module.rule("nsSocketOutputStream::Write [this=%p count=%u]\n", function(ptr, count) {
    this.obj(ptr).capture().follow("  PR_Write returned [n=%d]\n", (sock, written) => {
      sock.capture();
    }, sock => sock.capture());
  });
  module.rule("nsSocketInputStream::Read [this=%p count=%u]\n", function(ptr, count) {
    this.obj(ptr).capture().follow("  PR_Read returned [n=%d]\n", (sock, read) => {
      sock.capture();
    }, sock => sock.capture());
  });
  module.rule("destroying nsSocketTransport @%p", function(ptr) {
    this.obj(ptr).destroy();
  });
  schema.summaryProps("nsSocketTransport", ["origin"]);
};
