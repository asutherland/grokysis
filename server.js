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

const parseSourceToJsonable = require('./src/server-hacks/treesit-dump.js');

const normalizeSearchResults =
  require('./src/server-hacks/normalize_search_results.js');

const SEARCHFOX_BASE = 'https://searchfox.org';
const SEARCHFOX_TREE_BASE = `${SEARCHFOX_BASE}/mozilla-central`;
const SEARCHFOX_SEARCH_URL = `${SEARCHFOX_TREE_BASE}/search`;

const HG_BASE = 'https://hg.mozilla.org';
const HG_TREE_BASE = `${HG_BASE}/mozilla-central`;

const HG_QUOTED_REV_LINK_RE = new RegExp(`"${HG_TREE_BASE}/rev/([^"]+)"`);

// Tell express to use the webpack-dev-middleware and use the webpack.config.js
// configuration file as a base.
app.use(webpackDevMiddleware(compiler, {
  publicPath: config.output.publicPath
}));

/**
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

  const commitUrl = `${SEARCHFOX_TREE_BASE}/commit/${gitId}`;
  const commitResp = await fetchHtml(commitUrl);
  const commitText = await commitResp.text();

  const hgId = HG_QUOTED_REV_LINK_RE.exec(commitText)[1];

  const sourceUrl = `${HG_TREE_BASE}/raw-file/${hgId}/${relpath}`;
  const sourceResp = await fetch(sourceUrl);
  const sourceText = await sourceResp.text();

  let ast = null;
  let astError = null;
  try {
    console.log('extracting AST for:', relpath);
    ast = parseSourceToJsonable(sourceText, relpath);
  } catch (ex) {
    astError = ex.message;
  }

  res.json({
    html: htmlText,
    source: sourceText,
    hgId,
    gitId,
    ast,
    astError
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
  const rawObj = await jsonResp.json();
  const normalized = normalizeSearchResults(rawObj);
  res.json(normalized);
});

// Serve the files on port 3000.
app.listen(3000, function () {
  console.log('Testing server up on port 3000!\n');
});

process.on('unhandledRejection', error => {
  console.error('unhandledRejection', error);
});
