const GREP_REGEXP = new RegExp("((?:0x)?[A-Fa-f0-9]{4,})", "g");
const POINTER_REGEXP = /^(?:0x)?0*([0-9A-Fa-f]+)$/;
const NULLPTR_REGEXP = /^(?:(?:0x)?0+|\(null\)|\(nil\))$/;
const CAPTURED_LINE_LABEL = "a log line";
// this was previously "1970-01-01" which works, but using 0 is more clear.
const EPOCH_1970 = new Date(0);

/**
 * Given a string, escape all characters that are recognized as RegExp syntax
 * with a backslash.  This is used both by convertPrintfToRegExp for logan's
 * magic label syntax as well as the search functionality.
 */
function escapeRegexp(s) {
  // "$&" means last match, so "\\$&" amounts to: put a single backslash in
  // front of the thing that just matched.
  return s.replace(/\n$/, "").replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

/**
 * Maps logan magic rule strings to regular expression capture groups.
 */
const printfToRegexpMap = [
  // IMPORTANT!!!
  // Use \\\ to escape regexp special characters in the match regexp (left),
  // we escapeRegexp() the string prior to this conversion which adds
  // a '\' before each of such chars.
  [/%p/g, "((?:(?:0x)?[A-Fa-f0-9]+)|(?:\\(null\\))|(?:\\(nil\\)))"],
  [/%d/g, "(-?[\\d]+)"],
  [/%h?u/g, "([\\d]+)"],
  [/%s/g, "([^\\s]*)"],
  [/%\\\*s/g, "(.*)"],
  [/%\d*[xX]/g, "((?:0x)?[A-Fa-f0-9]+)"],
  [/%(?:\d+\\\.\d+)?f/g, "((?:[\\d]+)\.(?:[\\d]+))"],
  [/%\\\*\\\$/g, "(.*$)"]
];

/**
 * Idempotently transform a logan magic printf style string like "Foo %p created
 * Bar %p and read %d bytes of data." into a Regular Expression.
 */
function convertPrintfToRegexp(printf) {
  if (RegExp.prototype.isPrototypeOf(printf)) {
    // already converted
    return printf;
  }

  printf = escapeRegexp(printf);

  for (let [source, target] of printfToRegexpMap) {
    printf = printf.replace(source, target);
  }

  return new RegExp('^' + printf + '$');
}

/**
 * Remove the first element from the array for which the finder predicate
 * function returns true.
 */
function removeFromArray(finder, arr) {
  let index = arr.findIndex(finder);
  if (index > -1) {
    arr.splice(index, 1);
  }
};

/**
 * XXX whoops, may not be needed, remove unless I missed a dep.
 *
 * Insert the element after the item for which the finder predicate function
 * returns true.  If the predicate didn't return true, push the element onto
 * the end of the array.
 */
function placeInArrayAfter(element, arr, finder) {
  let index = arr.findIndex(finder);
  if (index > -1) {
    arr.splice(index + 1, 0, element);
  } else {
    arr.push(element);
  }
};

/**
 * XXX whoops, may not be needed, remove unless I missed a dep.
 *
 * Insert the element before the item for which the finder predicate function
 * returns true.  If the predicate didn't return true, unshift the element to
 * be the 0th element in the array.
 */
function placeInArrayBefore(element, arr, finder) {
  let index = arr.findIndex(finder);
  if (index > -1) {
    arr.splice(index, 0, element);
  } else {
    arr.unshift(element);
  }
};

/**
 * Get-or-create helper for object dictionaries.  If the given key does not
 * already exist in the dictionary, the provided `def` is invoked to provide the
 * value to place in the object, or if it's not a function, it's used as-is.
 *
 * @param {*} array
 * @param {*} itemName
 * @param {*} def 
 */
function ensure(dict, itemName, def = {}) {
  if (!(itemName in dict)) {
    dict[itemName] = (typeof def === "function") ? def() : def;
  }

  return dict[itemName];
}

/**
 * Normalize string-encoded pointers so that leading 0's are removed and hex
 * letters are all lowercase.  Falsey values are normalized to "0".
 *
 * In particular, this is necessary because Windows sometimes writes %p as
 * upper-case-padded and sometimes as lower-case-unpadded 000001500B043028 ->
 * 1500b043000.
 */
function pointerTrim(ptr) {
  if (!ptr) {
    return "0";
  }

  let pointer = ptr.match(POINTER_REGEXP);
  if (pointer) {
    return pointer[1].toLowerCase();
  }

  return ptr;
}

export {
  GREP_REGEXP,
  POINTER_REGEXP,
  NULLPTR_REGEXP,
  CAPTURED_LINE_LABEL,
  EPOCH_1970,
  ensure,
  placeInArrayAfter,
  placeInArrayBefore,
  pointerTrim,
  removeFromArray,
};
