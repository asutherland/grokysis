export default function(module) {
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
};
