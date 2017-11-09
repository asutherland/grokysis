function Capture(what) {
  this.id = ++logan._proc.captureid;
  this.time = logan._proc.timestamp;
  this.line = logan._proc.linenumber;
  this.location = {
    file: logan._proc.file,
    offset: logan._proc.binaryoffset,
    next: logan._proc.nextoffset,
  };
  this.thread = logan._proc.thread;
  this.what = what;

  logan._proc._captures[this.id] = this;
}

export default Capture;
