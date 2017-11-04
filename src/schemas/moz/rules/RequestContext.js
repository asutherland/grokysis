export default function(module) {
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
};
