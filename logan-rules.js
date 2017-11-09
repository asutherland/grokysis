logan.schema("moz", (line) =>
  {
    let match;

    match = line.match(/^(\d+-\d+-\d+) (\d+:\d+:\d+\.\d+) \w+ - \[([^\]]+)\]: ([A-Z])\/(\w+) (.*)$/);
    if (match) {
      let [all, date, time, thread, level, module, text] = match;
      return {
        text: text,
        timestamp: new Date(date + "T" + time + "Z"),
        threadname: thread,
        module: module,
      };
    }

    match = line.match(/^\[([^\]]+)\]: ([A-Z])\/(\w+) (.*)$/);
    if (match) {
      let [all, thread, level, module, text] = match;
      return {
        text: text,
        timestamp: EPOCH_1970,
        threadname: thread,
        module: module,
      };
    }

    match = line.match(/^\[rr (\d+) (\d+)\]\[([^\]]+)\]: ([A-Z])\/(\w+) (.*)$/);
    if (match) {
      let [all, pid, rrline, thread, level, module, text] = match;
      return {
        text: text,
        timestamp: EPOCH_1970,
        threadname: thread,
        module: module,
      };
    }

    return undefined; // just express it explicitly
  });
