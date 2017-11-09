export default (module) => {
  module.rule("TEST LINE OFFSET %d %d %d", function(linenum, binaryoffset, nextoffset) {
    console.log(`linenumber: ${linenum} = ${this.linenumber}`);
    console.log(`binaryoffset: ${binaryoffset} = ${this.binaryoffset}`);
    console.log(`nextoffset: ${nextoffset} = ${this.nextoffset}`);
  });
};
