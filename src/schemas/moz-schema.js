// == types
import ClassOfServiceFlags from "moz/types/ClassOfServiceFlags.js";

// == rules
// XXX fix-ups to perform after initial extraction with minimal hunk changes:
// - "netdiag" which has been partially refactored to be per-instance needs to
//   be exposed as such to the rules which are currently accessing it via
//   implicit global.
// fixups that are being performed as they happen
// - "convertProgressStatus" is accessed via no-longer-available lexical scope
//   nesting and being converted to a straight up helper that is imported by the
//   modules where it's used.
import cache2 from "moz/rules/cache2.js";
import DocLoader from "moz/rules/DocLoader.js";
import DocumentLeak from "moz/rules/DocumentLeak.js";
import imgRequest from "moz/rules/imgRequest.js";
import LoadGroup from "moz/rules/LoadGroup.js";
import pipnss from "moz/rules/pipnss.js";
import PresShell from "moz/rules/PresShell.js";
import RequestContext from "moz/rules/RequestContext.js";
import ScriptLoader from "moz/rules/ScriptLoader.js";

import nsChannelClassifier from "moz/rules/nsChannelClassifier";
import nsDocShellLeak from "moz/rules/nsDocShellLeak";
import nsHostResolver from "moz/rules/nsHostResolver";
import nsHttp from "moz/rules/nsHttp.js";
import nsSocketTransport from "moz/rules/nsSocketTransport.js";
import nsWyciwygChannel from "moz/rules/nsWyciwygChannel.js";

export default function(schema) {
  schema.ClassOfServiceFlags = ClassOfServiceFlags;

  schema.module("cache2", cache2);
  schema.module("DocLoader", DocLoader);
  schema.module("DocumentLeak", DocumentLeak);
  schema.module("imgRequest", imgRequest);
  schema.module("LoadGroup", LoadGroup);
  schema.module("pipnss", pipnss);
  schema.module("PresShell", PresShell);
  schema.module("RequestContext", RequestContext);
  schema.module("ScriptLoader", ScriptLoader);

  schema.module("nsChannelClassifier", nsChannelClassifier);
  schema.module("nsDocShellLeak", nsDocShellLeak);
  schema.module("nsHostResolver", nsHostResolver);
  schema.module("nsHttp", nsHttp);
  schema.module("nsSocketTransport", nsSocketTransport);
  schema.module("nsWyciwygChannel", nsWyciwygChannel);

};
