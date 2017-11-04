export default function(module) {
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
};
