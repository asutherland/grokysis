var netdiag = null;
var netdiagUI = null;

(function() {

  now = () => logan._proc.timestamp;
  duration = since => now().getTime() - since.getTime();
  interval = (a, b) => a && b ? (a.getTime() - b.getTime()) : undefined
  interval_t = (a, b) => interval(a, b) + " ms";
  assert = (cond, msg) => { if (!cond) throw new Error(msg || "assertion failure"); }
  COS = () => logan._schemes.moz.ClassOfServiceFlags;




})();
