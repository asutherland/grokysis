logan.schema("moz",
  /^(\d+-\d+-\d+) (\d+:\d+:\d+\.\d+) \w+ - \[([^\]]+)\]: ([A-Z])\/(\w+) (.*)$/,
  (all, date, time, thread, level, module, text) => {
    return {
      text: text,
      timestamp: new Date(date + "T" + time + "Z"),
      threadname: thread,
      module: module,
    };
  },
); // moz
