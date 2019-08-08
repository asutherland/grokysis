/*
 * This server exists to allow for hacks that bypass CORS, and/or use npm binary
 * modules.
 *
 * Currently, the following hacks are in-place:
 * - CORS bypass: fetch data from https://searchfox.org which does not
 *   specifically enable retrieval of data from other origins.  (Searchfox's
 *   configuration could be changed, however.)
 * - npm modules: treesitter is used to parse C++ code into an AST that enables
 *   very simple additional analyses to be prototyped in the UI.  Once something
 *   is known to be useful, it should instead be done in the clang analysis
 *   plugin or searchfox post-passes, with additional data emitted as needed.
 */

const express = require('express');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');

const app = express();
const config = require('./webpack.config.js');
const compiler = webpack(config);

const fetch = require('node-fetch');

function fetchAccept(url, contentType) {
  return fetch(
    url,
    {
      headers: {
        'Accept': contentType
      }
    });
}
function fetchHtml(url) {
  return fetchAccept(url, 'text/html');
}
function fetchJson(url) {
  return fetchAccept(url, 'application/json');
}

// No longer needed since we've moved to searchfox analysis.
//const parseSourceToJsonable = require('./src/server-hacks/treesit-dump.js');

const normalizeSearchResults =
  require('./src/server-hacks/normalize_search_results.js');

const mode = 'dev';
let serverRoot, useRepo;
if (mode === 'local') {
  serverRoot = 'http://localhost:8000';
  useRepo = 'tests';
} else {
  serverRoot = 'https://dev.searchfox.org';
  useRepo = 'mozilla-central';
}

const SEARCHFOX_BASE = serverRoot;
const SEARCHFOX_TREE_BASE = `${SEARCHFOX_BASE}/${useRepo}`;
const SEARCHFOX_SEARCH_URL = `${SEARCHFOX_TREE_BASE}/sorch`;

// Tell express to use the webpack-dev-middleware and use the webpack.config.js
// configuration file as a base.
app.use(webpackDevMiddleware(compiler, {
  publicPath: config.output.publicPath
}));

/**
 * XXX this is largely moot now but I'm leaving it partially in place because
 * having the HTML source is potentially interesting, but this endpoint really
 * wants to go away.
 *
 * Given a URL argument like "dom/clients/api/Clients.cpp":
 * - Fetch the analysis-infused static HTML page
 *   "https://searchfox.org/mozilla-central/source/dom/clients/api/Clients.cpp"
 * - From that page, extract the git commit id via naive regexp.  Unfortunately,
 *   this is not useful on its own.  But the good news is if we hit
 *   https://searchfox.org/mozilla-central/commit/4611b9541894e90a421debb57ddbbcff55c2f369
 *   we can get the hg rev from there.
 * - Fetch the corresponding source code from hg.mozilla.org so that we can
 *   parse the source up:
 *   https://hg.mozilla.org/mozilla-central/raw-file/0e62eb7804c00c0996a9bdde5350328a384fb7af/dom/clients/api/Clients.cpp
 * - Parse the source up into an AST using tree-sitter.
 * - Return a JSON object containing "html", "source", and "ast" if we were able to
 *   derive an AST.
 */
app.get(/^\/sf\/spage\/(.+)$/, async function (req, res) {
  const relpath = req.params[0];
  const sfUrl = `${SEARCHFOX_TREE_BASE}/source/${relpath}`;
  const htmlResp = await fetchHtml(sfUrl);
  const htmlText = await htmlResp.text();

  // The revision id will be visible in some auto-generated HTML that looks like:
  // <span id="rev-id">Showing <a href="/mozilla-central/commit/4611b9541894e90a421debb57ddbbcff55c2f369">4611b954</a>:</span>
  const gitId = /rev-id">Showing [^\n]+\/commit\/([^"]+)"/.exec(htmlText)[1];

  res.json({
    html: htmlText,
    source: null,
    hgId: null,
    gitId,
    ast: null,
    astError: null,
  });
});

app.get('/sf/search', async function(req, res) {
  // Use a regexp to grab the unprocessed query params off the end so we can
  // quote them verbatim.
  const match = /\?(.+)$/.exec(req.originalUrl);
  if (!match) {
    res.sendStatus(400);
    return;
  }
  const url = `${SEARCHFOX_SEARCH_URL}?${match[1]}`;
  console.log('proxying search:', url);

  // Obviously, we could stream the returned JSON as just straight-up bytes, but
  // we're also doing a little bit of normalizing here in the interests of
  // showing how we could improved the data returned by searchfox.  (Especially
  // when moving the search logic from python to rust.)
  const jsonResp = await fetchJson(url);
  // XXX there's no actual need to round-trip through JSON here.
  const rawObj = await jsonResp.json();
  res.json(rawObj);
});

// Serve the files on port 3000.
app.listen(3000, function () {
  console.log('Testing server up on port 3000!\n');
});

process.on('unhandledRejection', error => {
  console.error('unhandledRejection', error);
});
