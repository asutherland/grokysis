export default function(module) {
  /******************************************************************************
   * nsChannelClassifier
   ******************************************************************************/

  module.rule("nsChannelClassifier::nsChannelClassifier %p", function(clas) {
    this.obj(clas).create("nsChannelClassifier").grep();
  });
  module.rule("nsChannelClassifier::~nsChannelClassifier %p", function(clas) {
    this.obj(clas).destroy();
  });
};
