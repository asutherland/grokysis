export default function(module) {
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
};
