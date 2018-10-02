const Parser = require('tree-sitter');

const l_cpp = require('tree-sitter-cpp');
const l_c = require('tree-sitter-c');
const l_js = require('tree-sitter-javascript');
const l_rust = require('tree-sitter-rust');

const langsByExtension = {
  'cpp': l_cpp,
  'cc': l_cpp,
  'c': l_c,
  'h': l_cpp,
  'js': l_js,
  'rust': l_rust,
};

/**
 * Use the appropriate tree-sitter language from our hardcoded set of languages
 * and file extensions to parse the given source file and its relative path.
 */
function parseSourceToJsonable(docStr, relpath) {
  const ext = relpath.split('.').slice(-1)[0];

  if (!langsByExtension.hasOwnProperty(ext)) {
    throw new Error(`Unsupported extension: ${ext}`);
  }

  const lang = langsByExtension[ext];

  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(docStr);

  function transform(node) {
    const o = {};
    const hasChildren = node.firstChild != null;
    // Don't include text if there are children which break it out further.
    const useText = !hasChildren && node.isNamed;
    o.text = useText ? docStr.slice(node.startIndex, node.endIndex) : null;
    o.type = node.type;
    o.startIndex = node.startIndex;
    o.startPosition = node.startPosition;
    o.endIndex = node.endIndex;
    o.endPosition = node.endPosition;
    const kids = o.children = [];
    for (let child = node.firstChild; child != null; child = child.nextSibling) {
      kids.push(transform(child));
    }
    return o;
  }

  //const bePretty = true;
  return transform(tree.rootNode);
}

module.exports = parseSourceToJsonable;
