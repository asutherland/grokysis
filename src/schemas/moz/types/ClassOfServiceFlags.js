export default ClassOfServiceFlags = {
  Leader: 1 << 0,
  Follower: 1 << 1,
  Speculative: 1 << 2,
  Background: 1 << 3,
  Unblocked: 1 << 4,
  Throttleable: 1 << 5,
  UrgentStart: 1 << 6,
  DontThrottle: 1 << 7,
  Tail: 1 << 8,
  TailAllowed: 1 << 9,
  TailForbidden: 1 << 10,

  stringify: function(cos) {
    let result = "";
    for (let flag in this) {
      if (typeof this[flag] !== "number") {
        continue;
      }
      if (cos & this[flag]) {
        if (result) result += ", ";
        result += flag;
      }
    }
    return result || "0";
  }
};
