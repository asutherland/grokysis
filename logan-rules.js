logan.schema("moz", (line, proc) =>
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
      // this is likely a mixed console log that may have both parent and child logs in it, force ipc usage
      proc._ipc = true;

      let [all, pid, rrline, thread, level, module, text] = match;
      let timestamp = new Date();

      // This is a very hacky way of making the stuff sort correctly
      // TODO - think of something better and less confusing when timestamp is missing
      timestamp.setTime(EPOCH_1970.getTime() + rrline);
      return {
        text: text,
        timestamp: timestamp,
        threadname: thread,
        module: module,
      };
    }

    return undefined; // just express it explicitly
  });
