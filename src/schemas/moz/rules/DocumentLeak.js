export default function(module) {
  /******************************************************************************
   * nsDocument
   ******************************************************************************/

  module.rule("DOCUMENT %p created", function(doc) {
    this.obj(doc).create("nsDocument");
  });
  module.rule("DOCUMENT %p destroyed", function(doc) {
    this.obj(doc).destroy();
  });
  module.rule("DOCUMENT %p UnblockDOMContentLoaded", function(doc) {
    doc = this.obj(doc).capture();
    netdiag.DOMContentLoaded(doc.docshell);
  });
  module.rule("DOCUMENT %p with PressShell %p and DocShell %p", function(doc, presshell, docshell) {
    this.thread.on("docshell", ds => {
      docshell = ds.alias(docshell);
    }, () => {
      docshell = this.obj(docshell);
    });
    this.obj(presshell).link(docshell).docshell = docshell;
    this.obj(doc).link(docshell).docshell = docshell;
  });
};
