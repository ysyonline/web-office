// node_modules/lib0/trait/equality.js
var EqualityTraitSymbol = Symbol("Equality");
var equals = (a, b) => a === b || !!a?.[EqualityTraitSymbol]?.(b) || false;

// node_modules/lib0/object.js
var create = () => /* @__PURE__ */ Object.create(null);
var isObject = (o) => typeof o === "object";
var assign = Object.assign;
var keys = Object.keys;
var values = Object.values;
var forEach = (obj, f) => {
  for (const key in obj) {
    f(obj[key], key);
  }
};
var map = (obj, f) => {
  const results = [];
  for (const key in obj) {
    results.push(f(obj[key], key));
  }
  return results;
};
var length = (obj) => keys(obj).length;
var size = (obj) => keys(obj).length;
var some = (obj, f) => {
  for (const key in obj) {
    if (f(obj[key], key)) {
      return true;
    }
  }
  return false;
};
var isEmpty = (obj) => {
  for (const _k in obj) {
    return false;
  }
  return true;
};
var every = (obj, f) => {
  for (const key in obj) {
    if (!f(obj[key], key)) {
      return false;
    }
  }
  return true;
};
var hasProperty = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
var equalFlat = (a, b) => a === b || size(a) === size(b) && every(a, (val, key) => (val !== void 0 || hasProperty(b, key)) && equals(b[key], val));
var freeze = Object.freeze;
var deepFreeze = (o) => {
  for (const key in o) {
    const c = o[key];
    if (typeof c === "object" || typeof c === "function") {
      deepFreeze(o[key]);
    }
  }
  return freeze(o);
};
var setIfUndefined = (o, key, createT) => hasProperty(o, key) ? o[key] : o[key] = createT();
export {
  assign,
  create,
  deepFreeze,
  equalFlat,
  every,
  forEach,
  freeze,
  hasProperty,
  isEmpty,
  isObject,
  keys,
  length,
  map,
  setIfUndefined,
  size,
  some,
  values
};
