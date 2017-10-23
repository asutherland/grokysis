// == types
import ClassOfServiceFlags from "moz/types/ClassOfServiceFlags.js";

// == rules
// XXX fix-ups to perform after initial extraction with minimal hunk changes:
// - "netdiag" which has been partially refactored to be per-instance needs to
//   be exposed as such to the rules which are currently accessing it via
//   implicit global.
// fixups that are being performed as they ahppen
// - "convertProgressStatus" is accessed via no-longer-available lexical scope
//   nesting and being converted to a straight up helper that is imported by the
//   modules where it's used.
import DocumentLeak from "moz/rules/DocumentLeak.js";
import PresShell from "moz/rules/PresShell.js";

import nsHttp from "moz/rules/nsHttp.js";
import nsSocketTransport from "moz/rules/nsSocketTransport.js";

export default function(schema) {
  schema.ClassOfServiceFlags = ClassOfServiceFlags;

  schema.module("DocumentLeak", DocumentLeak);
  schema.module("PresShell", PresShell);

  schema.module("nsHttp", nsHttp);
  schema.module("nsSocketTransport", nsSocketTransport);
};
