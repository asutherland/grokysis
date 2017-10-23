export default function(module) {
  /******************************************************************************
   * PresShell
   ******************************************************************************/

  module.rule("PresShell::PresShell this=%p", function(ps) {
    this.obj(ps).create("PresShell");
  });
  module.rule("PresShell::~PresShell this=%p", function(ps) {
    this.obj(ps).destroy();
  });
  module.rule("PresShell::Initialize this=%p", function(ps) {
    this.obj(ps).__init_time = this.timestamp;
  });
  module.rule("PresShell::ScheduleBeforeFirstPaint this=%p", function(ps) {
    ps = this.obj(ps);
    ps.prop("first-paint-time-ms", this.duration(ps.__init_time)).capture();
    netdiag.FirstPaint(ps.docshell);
  });
};
