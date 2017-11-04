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


function ensure(array, itemName, def = {}) {
  if (!(itemName in array)) {
    array[itemName] = (typeof def === "function") ? def() : def;
  }

  return array[itemName];
}

// Windows sometimes writes %p as upper-case-padded and sometimes as lower-case-unpadded
// 000001500B043028 -> 1500b043000
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
  ensure,
  placeInArrayAfter,
  placeInArrayBefore,
  pointerTrim,
  removeFromArray,
};
