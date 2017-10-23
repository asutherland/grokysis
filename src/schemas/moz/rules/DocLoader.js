export default (module) => {
  /******************************************************************************
   * nsDocLoader
   ******************************************************************************/

  module.rule("DocLoader:%p: created.\n", function(docloader) {
    // This DocLoader is aliased to DocShell
    this.thread.docloader = docloader;
  });
  module.rule("DocLoader:%p: load group %p.\n", function(docloader, loadgroup) {
    docloader = this.objIf(docloader).capture().link(loadgroup);
    loadgroup = this.obj(loadgroup);
    docloader.loadgroup = loadgroup;
    loadgroup.docshell = docloader;
  });
};
