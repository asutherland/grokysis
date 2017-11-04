export default function(module) {
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
};
