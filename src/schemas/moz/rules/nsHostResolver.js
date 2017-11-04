export default function(module) {
{  /******************************************************************************
   * nsHostResolver
   ******************************************************************************/

  module.resolver = (proc) => proc.obj("nsHostResolver::singleton").class("nsHostResolver");
  module.rule("Resolving host [%s].\n", function(host) {
    module.resolver(this).capture();
  });
  module.rule("Resolving host [%s] - bypassing cache.\n", function(host) {
    module.resolver(this).capture();
  });
};
