const Parser = require('tree-sitter');

const treeSitterCpp = require('tree-sitter-cpp');

function parseSourceToJsonable(docStr, filePath) {
  const parser = new Parser();
  parser.setLanguage(treeSitterCpp);
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
