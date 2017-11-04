export default function(module) {
  /******************************************************************************
   * nsSSLIOLayer / SSLSocket
   ******************************************************************************/

  module.rule("[%p] nsSSLIOLayerSetOptions: using TLS version range (%x,%x)", function(fd) {
    this.thread.sslsocket_tls_version = this.line;
  });
  module.rule("[%p] Socket set up\n", function(fd) {
    this.thread.sslsocket = this.obj(fd).create("SSLSocket").capture(this.thread.sslsocket_tls_version).grep();
    delete this.thread.sslsocket_tls_version;
  });
  module.rule("[%p] Shutting down socket\n", function(fd) {
    this.obj(fd).destroy();
  });
};
