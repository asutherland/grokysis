logan.schema("moz",
  /^(\d+-\d+-\d+) (\d+:\d+:\d+\.\d+) \w+ - \[([^\]]+)\]: ([A-Z])\/(\w+) (.*)$/,
  (all, date, time, thread, level, module, text) => {
    return {
      text: text,
      timestamp: new Date(date + "T" + time + "Z"),
      threadname: thread,
      module: module,
    };
  },

  (schema) => {
    schema.module("DocLoader", ); // DocLoader

    schema.module("nsDocShellLeak", (module) => {

      /******************************************************************************
       * nsDocShell
       ******************************************************************************/

      module.rule("DOCSHELL %p created\n", function(docshell) {
        docshell = this.obj(docshell).create("nsDocShell");
        this.thread.on("docloader", dl => {
          docshell.alias(dl);
        });
      });
      module.rule("DOCSHELL %p destroyed\n", function(docshell) {
        this.obj(docshell).destroy();
      });
      module.rule("nsDocShell[%p]: loading %s with flags 0x%08x", function(docshell, url, flags) {
        docshell = this.obj(docshell).prop("url", url, true).capture();
        netdiag.topload(docshell, url);
      });
      module.rule("DOCSHELL %p SetCurrentURI %s\n", function(docshell, url) {
        this.thread.docshell = this.obj(docshell).capture();
      });
      schema.summaryProps("nsDocShell", ["url"]);

    }); // nsDocShellLeak

    schema.module("RequestContext", (module) => {

      /******************************************************************************
       * RequestContext
       ******************************************************************************/

      module.rule("RequestContext::RequestContext this=%p id=%x", function(ptr, id) {
        this.obj(ptr).create("RequestContext").prop("id", id).grep();
        this.thread.on("loadgroup", (lg) => {
          lg.prop("rc-id", id);
        });
      });
      module.rule("RequestContext::~RequestContext this=%p blockers=%u", function(ptr) {
        this.obj(ptr).destroy();
      });
      module.rule("RequestContext::IsContextTailBlocked this=%p, request=%p, queued=%u", function(rc, req, queued) {
        this.thread.on("tail_request", (tail) => {
          tail.alias(req);
        });
        this.obj(rc).capture().mention(req).follow(1);
      });
      module.rule("RequestContext::CancelTailedRequest %p req=%p removed=%d", function(rc, req) {
        this.obj(rc).capture().mention(req);
      });
      module.rule("RequestContext::RemoveNonTailRequest this=%p, cnt=%d", function(rc, cnt) {
        rc = this.obj(rc).capture();
        this.thread.on("tail_request", (ch) => (rc.mention(ch), ch));
      });
      module.rule("RequestContext::AddNonTailRequest this=%p, cnt=%d", function(rc, cnt) {
        rc = this.obj(rc).capture();
        this.thread.on("tail_request", (ch) => (rc.mention(ch), ch));
      });
      schema.summaryProps("RequestContext", []);

    }); // RequestContext

    schema.module("LoadGroup", (module) => {

      /******************************************************************************
       * nsLoadGroup
       ******************************************************************************/

      module.rule("LOADGROUP [%p]: Created.\n", function(ptr) {
        this.thread.loadgroup = this.obj(ptr).create("nsLoadGroup").prop("requests", 0).prop("foreground-requests", 0).grep();
      });
      module.rule("LOADGROUP [%p]: Destroyed.\n", function(ptr) {
        this.obj(ptr).destroy();
      });
      module.rule("LOADGROUP [%p]: Adding request %p %s (count=%d).\n", function(lg, req, name, count) {
        this.thread.on("httpchannelchild", ch => { ch.alias(req); });
        this.thread.on("wyciwigchild", ch => { ch.alias(req); });
        this.thread.on("imagerequestproxy", ch => { ch.alias(req); });
        this.thread.on("imagerequest", ch => { ch.alias(req); });

        this.obj(lg).prop("requests", count => ++count).prop("foreground-requests", parseInt(count) + 1).capture().link(req);
        this.obj(req).class("unknown request").prop("in-load-group", lg, true);
      });
      module.rule("LOADGROUP [%p]: Removing request %p %s status %x (count=%d).\n", function(lg, req, name, status, count) {
        this.obj(lg).prop("requests", count => --count).prop("foreground-requests", count).capture().mention(req);
        this.obj(req).prop("in-load-group");
      });
      module.rule("LOADGROUP [%p]: Unable to remove request %p. Not in group!\n", function(lg, req) {
        this.obj(lg).prop("requests", count => ++count).capture();
        this.obj(req).prop("not-found-in-loadgroup", true);
      });
      module.rule("nsLoadGroup::SetDefaultLoadRequest this=%p default-request=%p", function(lg, req) {
        // TODO - alias the request?
        this.obj(lg).capture().link(this.obj(req).class("unknown default request"));
      });
      module.rule("nsLoadGroup::OnEndPageLoad this=%p default-request=%p", function(lg, dch) {
        lg = this.obj(lg).capture().mention(dch);
        netdiag.EndPageLoad(lg);
      });
      schema.summaryProps("nsLoadGroup", ["requests", "foreground-requests"]);

    }); // LoadGroup

    schema.module("nsWyciwygChannel", (module) => {

      /******************************************************************************
       * nsWyciwygChannel
       ******************************************************************************/

      module.rule("Creating WyciwygChannelChild @%p\n", function(ptr) {
        this.thread.wyciwigchild = this.obj(ptr).create("WyciwygChannelChild").grep();
      });
      module.rule("WyciwygChannelChild::AsyncOpen [this=%p]\n", function(ptr) {
        this.thread.wyciwigchild = this.obj(ptr).capture();
      });
      module.rule("Destroying WyciwygChannelChild @%p\n", function(ptr) {
        this.obj(ptr).destroy();
      });
    });

    schema.module("imgRequest", (module) => {

      /******************************************************************************
       * imgLoader
       ******************************************************************************/

      module.rule("%d [this=%p] imgLoader::LoadImage (aURI=\"%s\") {ENTER}", function(now, ptr, uri) {
        this.thread.load_image_uri = uri;
        delete this.thread.httpchannelchild;
      });
      module.rule("%d [this=%p] imgLoader::LoadImage {EXIT}", function(now, ptr) {
        delete this.thread.load_image_uri;
      });
      module.rule("%d [this=%p] imgLoader::LoadImage |cache hit| (request=\"%p\")", function(now, ptr, request) {
        this.obj(request).prop("cache-hit", true).capture();
      });
      module.rule("[this=%p] imgLoader::LoadImage -- Created new imgRequest [request=%p]", function(ptr, request) {
        this.thread.on("httpchannelchild", (ch) => {
          this.obj(request).capture().link(ch);
          return ch;
        });
      });

      /******************************************************************************
       * imgRequest
       ******************************************************************************/

      module.rule("%d [this=%p] imgRequest::imgRequest()", function(now, ptr) {
        this.thread.imagerequest = this.obj(ptr).create("imgRequest")
          .prop("url", this.thread.load_image_uri)
          .grep();
      });
      module.rule("%d [this=%p] imgRequest::Init", function(now, ptr) {
        this.obj(ptr).capture().__opentime = this.timestamp;
      });
      module.rule("%d [this=%p] imgRequest::AddProxy (proxy=%p) {ENTER}", function(now, ptr, proxy) {
        this.obj(ptr).capture();
        this.obj(proxy).link(ptr);
      });
      module.rule("[this=%p] imgRequest::BoostPriority for category %x", function(ptr, cat) {
        this.obj(ptr)
          .prop("priority-boost-cat", cat, true)
          .propIf("priority-boost-too-late", cat, obj => "open-to-first-data" in obj.props, true)
          .capture();
      });
      module.rule("%d [this=%p] imgRequest::OnDataAvailable (count=\"%d\") {ENTER}", function(now, ptr, count) {
        let request = this.obj(ptr);
        request.capture().propIfNull("open-to-first-data", this.duration(request.__opentime));
      });
      module.rule("%d [this=%p] imgRequest::OnStopRequest", function(now, ptr) {
        let request = this.obj(ptr);
        request.capture().prop("open-to-stop", this.duration(request.__opentime));
      });
      module.rule("%d [this=%p] imgRequest::~imgRequest() (keyuri=\"%s\")", function(now, ptr, key) {
        this.obj(ptr).destroy();
      });
      module.rule("%d [this=%p] imgRequest::~imgRequest()", function(now, ptr) {
        this.obj(ptr).destroy();
      });
      schema.summaryProps("imgRequest", ["url"]);

      /******************************************************************************
       * imgRequestProxy
       ******************************************************************************/

      module.rule("%d [this=%p] imgRequestProxy::imgRequestProxy", function(now, ptr) {
        this.thread.imagerequestproxy = this.obj(ptr).create("imgRequestProxy").grep();
      });
      module.rule("%d [this=%p] imgRequestProxy::~imgRequestProxy", function(now, ptr) {
        this.obj(ptr).destroy();
      });

    }); // imageRequest

    schema.module("ScriptLoader", (module) => {

      /******************************************************************************
       * ScriptLoader / ScriptLoadRequest
       ******************************************************************************/

      module.rule("ScriptLoader::ScriptLoader %p", function(loader) {
        this.obj(loader).create("ScriptLoader").grep();
      });
      module.rule("ScriptLoader::~ScriptLoader %p", function(loader) {
        this.obj(loader).destroy();
      });
      module.rule("ScriptLoader %p creates ScriptLoadRequest %p", function(loader, request) {
        this.obj(loader).capture().link(this.obj(request).create("ScriptLoadRequest").grep());
      });
      module.rule("ScriptLoadRequest (%p): Start Load (url = %s)", function(request, url) {
        this.obj(request).capture().prop("url", url);
      });
      module.rule("ScriptLoadRequest (%p): async=%d defer=% tracking=%d", function(request, async, defer, tracking) {
        this.obj(request).capture().prop("async", async).prop("defer", defer).prop("tracking", tracking);
      });
      schema.summaryProps("ScriptLoadRequest", ["url"]);

    }); // ScriptLoader

    schema.module("nsChannelClassifier", (module) => {

      /******************************************************************************
       * nsChannelClassifier
       ******************************************************************************/

      module.rule("nsChannelClassifier::nsChannelClassifier %p", function(clas) {
        this.obj(clas).create("nsChannelClassifier").grep();
      });
      module.rule("nsChannelClassifier::~nsChannelClassifier %p", function(clas) {
        this.obj(clas).destroy();
      });

    });

    schema.module("nsHttp", ); // nsHttp

    schema.module("nsSocketTransport", ); // nsSocketTransport

    schema.module("pipnss", (module) => {

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
    }); // pipnss

    schema.module("nsHostResolver", (module) => {

      /******************************************************************************
       * nsHostResolver
       ******************************************************************************/

      module.resolver = (proc) => proc.obj("nsHostResolver::singleton").class("nsHostResolver");
      module.rule("Resolving host [%s].\n", function(host) {
        module.resolver(this).capture();
      });
      module.rule("Resolving host [%s] - bypassing cache.\n", function(host) {
        module.resolver(this).capture();
      });
    }); // nsHostResolver

    schema.module("cache2", (module) => {

      /******************************************************************************
       * CacheEntry
       ******************************************************************************/

      module.rule("CacheEntry::CacheEntry [this=%p]", function(ptr) {
        this.thread.httpcacheentry = this.obj(ptr).create("CacheEntry").grep();
      });
      schema.ruleIf("  new entry %p for %*$", proc => proc.thread.httpcacheentry, function(ptr, key, entry) {
        delete this.thread.httpcacheentry;
        entry.prop("key", key);
      });
      module.rule("New CacheEntryHandle %p for entry %p", function(handle, entry) {
        this.obj(entry).capture().alias(handle);
      });
      module.rule("CacheEntry::~CacheEntry [this=%p]", function(ptr) {
        this.obj(ptr).destroy();
      });
      schema.summaryProps("CacheEntry", "key");

    }); // cache2
  }
); // moz
