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
  pointerTrim,
};
