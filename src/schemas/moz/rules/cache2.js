export default (module) => {
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
};
