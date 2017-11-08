import assert from "assert";

import logan from "logan";

test("basic HTTP log parsing", async function() {
  const raw_log = await (await fetch("simple_http.log")).text();
  const expected_obj = await (await fetch("simple_http_out.json")).json();

  const derived_obj = await logan.parse_log(raw_log);

  assert.equal(derived_obj, expected_obj);
});
