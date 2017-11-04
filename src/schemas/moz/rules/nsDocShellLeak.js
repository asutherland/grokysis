export default function(module) {
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
};
