import assert from "assert";

import logan from "logan";

async function loadInput(filename) {
  const response = await fetch(`base/test/expected/${filename}`);
  const blob = await response.blob();
  return blob;
}

async function loadExpectedOutput(filename) {
  try {
    const response = await fetch(`base/test/expected/${filename}`);
    if (response.status != 200) {
      return [];
    }
    const blob = await response.blob();
    return blob;
  } catch (ex) {
    return [];
  }
}

it("should handle basic HTTP2 log parsing", async function() {
  const raw_log = await loadInput("simple_http2_input.log");
  const expected_obj = await loadExpectedOutput("simple_http_out.json");

  const derived_obj = await logan.parse_log(raw_log);

  assert.equal(derived_obj, expected_obj);
});
