// node_modules/lib0/set.js
var create = () => /* @__PURE__ */ new Set();
var from = (entries) => new Set(entries);

// node_modules/lib0/array.js
var last = (arr) => arr[arr.length - 1];
var create2 = () => (
  /** @type {Array<C>} */
  []
);
var copy = (a) => (
  /** @type {Array<D>} */
  a.slice()
);
var appendTo = (dest, src) => {
  for (let i = 0; i < src.length; i++) {
    dest.push(src[i]);
  }
};
var from2 = Array.from;
var every = (arr, f) => {
  for (let i = 0; i < arr.length; i++) {
    if (!f(arr[i], i, arr)) {
      return false;
    }
  }
  return true;
};
var some = (arr, f) => {
  for (let i = 0; i < arr.length; i++) {
    if (f(arr[i], i, arr)) {
      return true;
    }
  }
  return false;
};
var equalFlat = (a, b) => a.length === b.length && every(a, (item, index) => item === b[index]);
var flatten = (arr) => fold(
  arr,
  /** @type {Array<ELEM>} */
  [],
  (acc, val) => acc.concat(val)
);
var unfold = (len, f) => {
  const array = new Array(len);
  for (let i = 0; i < len; i++) {
    array[i] = f(i, array);
  }
  return array;
};
var fold = (arr, seed, folder) => arr.reduce(folder, seed);
var isArray = Array.isArray;
var unique = (arr) => from2(from(arr));
var uniqueBy = (arr, mapper) => {
  const happened = create();
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const el = arr[i];
    const mapped = mapper(el);
    if (!happened.has(mapped)) {
      happened.add(mapped);
      result.push(el);
    }
  }
  return result;
};
var map = (arr, mapper) => {
  const res = Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    res[i] = mapper(
      /** @type {any} */
      arr[i],
      i,
      /** @type {any} */
      arr
    );
  }
  return (
    /** @type {any} */
    res
  );
};
var bubblesortItem = (arr, i, compareFn) => {
  const n = arr[i];
  let j = i;
  while (j + 1 < arr.length && compareFn(n, arr[j + 1]) > 0) {
    arr[j] = arr[j + 1];
    arr[++j] = n;
  }
  if (i === j && j > 0) {
    while (j > 0 && compareFn(arr[j - 1], n) > 0) {
      arr[j] = arr[j - 1];
      arr[--j] = n;
    }
  }
  return j;
};
export {
  appendTo,
  bubblesortItem,
  copy,
  create2 as create,
  equalFlat,
  every,
  flatten,
  fold,
  from2 as from,
  isArray,
  last,
  map,
  some,
  unfold,
  unique,
  uniqueBy
};
