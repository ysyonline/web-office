var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all3) => {
  for (var name in all3)
    __defProp(target, name, { get: all3[name], enumerable: true });
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/lib0/array.js
var array_exports = {};
__export(array_exports, {
  appendTo: () => appendTo,
  bubblesortItem: () => bubblesortItem,
  copy: () => copy,
  create: () => create2,
  equalFlat: () => equalFlat,
  every: () => every,
  flatten: () => flatten,
  fold: () => fold,
  from: () => from2,
  isArray: () => isArray,
  last: () => last,
  map: () => map,
  some: () => some,
  unfold: () => unfold,
  unique: () => unique,
  uniqueBy: () => uniqueBy
});

// node_modules/lib0/set.js
var set_exports = {};
__export(set_exports, {
  create: () => create,
  first: () => first,
  from: () => from,
  toArray: () => toArray
});
var create = () => /* @__PURE__ */ new Set();
var toArray = (set2) => Array.from(set2);
var first = (set2) => set2.values().next().value;
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

// node_modules/lib0/binary.js
var binary_exports = {};
__export(binary_exports, {
  BIT1: () => BIT1,
  BIT10: () => BIT10,
  BIT11: () => BIT11,
  BIT12: () => BIT12,
  BIT13: () => BIT13,
  BIT14: () => BIT14,
  BIT15: () => BIT15,
  BIT16: () => BIT16,
  BIT17: () => BIT17,
  BIT18: () => BIT18,
  BIT19: () => BIT19,
  BIT2: () => BIT2,
  BIT20: () => BIT20,
  BIT21: () => BIT21,
  BIT22: () => BIT22,
  BIT23: () => BIT23,
  BIT24: () => BIT24,
  BIT25: () => BIT25,
  BIT26: () => BIT26,
  BIT27: () => BIT27,
  BIT28: () => BIT28,
  BIT29: () => BIT29,
  BIT3: () => BIT3,
  BIT30: () => BIT30,
  BIT31: () => BIT31,
  BIT32: () => BIT32,
  BIT4: () => BIT4,
  BIT5: () => BIT5,
  BIT6: () => BIT6,
  BIT7: () => BIT7,
  BIT8: () => BIT8,
  BIT9: () => BIT9,
  BITS0: () => BITS0,
  BITS1: () => BITS1,
  BITS10: () => BITS10,
  BITS11: () => BITS11,
  BITS12: () => BITS12,
  BITS13: () => BITS13,
  BITS14: () => BITS14,
  BITS15: () => BITS15,
  BITS16: () => BITS16,
  BITS17: () => BITS17,
  BITS18: () => BITS18,
  BITS19: () => BITS19,
  BITS2: () => BITS2,
  BITS20: () => BITS20,
  BITS21: () => BITS21,
  BITS22: () => BITS22,
  BITS23: () => BITS23,
  BITS24: () => BITS24,
  BITS25: () => BITS25,
  BITS26: () => BITS26,
  BITS27: () => BITS27,
  BITS28: () => BITS28,
  BITS29: () => BITS29,
  BITS3: () => BITS3,
  BITS30: () => BITS30,
  BITS31: () => BITS31,
  BITS32: () => BITS32,
  BITS4: () => BITS4,
  BITS5: () => BITS5,
  BITS6: () => BITS6,
  BITS7: () => BITS7,
  BITS8: () => BITS8,
  BITS9: () => BITS9
});
var BIT1 = 1;
var BIT2 = 2;
var BIT3 = 4;
var BIT4 = 8;
var BIT5 = 16;
var BIT6 = 32;
var BIT7 = 64;
var BIT8 = 128;
var BIT9 = 256;
var BIT10 = 512;
var BIT11 = 1024;
var BIT12 = 2048;
var BIT13 = 4096;
var BIT14 = 8192;
var BIT15 = 16384;
var BIT16 = 32768;
var BIT17 = 65536;
var BIT18 = 1 << 17;
var BIT19 = 1 << 18;
var BIT20 = 1 << 19;
var BIT21 = 1 << 20;
var BIT22 = 1 << 21;
var BIT23 = 1 << 22;
var BIT24 = 1 << 23;
var BIT25 = 1 << 24;
var BIT26 = 1 << 25;
var BIT27 = 1 << 26;
var BIT28 = 1 << 27;
var BIT29 = 1 << 28;
var BIT30 = 1 << 29;
var BIT31 = 1 << 30;
var BIT32 = 1 << 31;
var BITS0 = 0;
var BITS1 = 1;
var BITS2 = 3;
var BITS3 = 7;
var BITS4 = 15;
var BITS5 = 31;
var BITS6 = 63;
var BITS7 = 127;
var BITS8 = 255;
var BITS9 = 511;
var BITS10 = 1023;
var BITS11 = 2047;
var BITS12 = 4095;
var BITS13 = 8191;
var BITS14 = 16383;
var BITS15 = 32767;
var BITS16 = 65535;
var BITS17 = BIT18 - 1;
var BITS18 = BIT19 - 1;
var BITS19 = BIT20 - 1;
var BITS20 = BIT21 - 1;
var BITS21 = BIT22 - 1;
var BITS22 = BIT23 - 1;
var BITS23 = BIT24 - 1;
var BITS24 = BIT25 - 1;
var BITS25 = BIT26 - 1;
var BITS26 = BIT27 - 1;
var BITS27 = BIT28 - 1;
var BITS28 = BIT29 - 1;
var BITS29 = BIT30 - 1;
var BITS30 = BIT31 - 1;
var BITS31 = 2147483647;
var BITS32 = 4294967295;

// node_modules/lib0/broadcastchannel.js
var broadcastchannel_exports = {};
__export(broadcastchannel_exports, {
  publish: () => publish,
  subscribe: () => subscribe,
  unsubscribe: () => unsubscribe
});

// node_modules/lib0/map.js
var map_exports = {};
__export(map_exports, {
  all: () => all,
  any: () => any,
  copy: () => copy2,
  create: () => create3,
  map: () => map2,
  setIfUndefined: () => setIfUndefined
});
var create3 = () => /* @__PURE__ */ new Map();
var copy2 = (m) => {
  const r = create3();
  m.forEach((v, k) => {
    r.set(k, v);
  });
  return r;
};
var setIfUndefined = (map5, key, createT) => {
  let set2 = map5.get(key);
  if (set2 === void 0) {
    map5.set(key, set2 = createT());
  }
  return set2;
};
var map2 = (m, f) => {
  const res = [];
  for (const [key, value] of m) {
    res.push(f(value, key));
  }
  return res;
};
var any = (m, f) => {
  for (const [key, value] of m) {
    if (f(value, key)) {
      return true;
    }
  }
  return false;
};
var all = (m, f) => {
  for (const [key, value] of m) {
    if (!f(value, key)) {
      return false;
    }
  }
  return true;
};

// node_modules/lib0/buffer.js
var buffer_exports = {};
__export(buffer_exports, {
  copyUint8Array: () => copyUint8Array,
  createUint8ArrayFromArrayBuffer: () => createUint8ArrayFromArrayBuffer,
  createUint8ArrayFromLen: () => createUint8ArrayFromLen,
  createUint8ArrayViewFromArrayBuffer: () => createUint8ArrayViewFromArrayBuffer,
  decodeAny: () => decodeAny,
  encodeAny: () => encodeAny,
  fromBase64: () => fromBase64,
  fromBase64UrlEncoded: () => fromBase64UrlEncoded,
  fromHexString: () => fromHexString,
  shiftNBitsLeft: () => shiftNBitsLeft,
  toBase64: () => toBase64,
  toBase64UrlEncoded: () => toBase64UrlEncoded,
  toHexString: () => toHexString
});

// node_modules/lib0/string.js
var string_exports = {};
__export(string_exports, {
  MAX_UTF16_CHARACTER: () => MAX_UTF16_CHARACTER,
  _decodeUtf8Native: () => _decodeUtf8Native,
  _decodeUtf8Polyfill: () => _decodeUtf8Polyfill,
  _encodeUtf8Native: () => _encodeUtf8Native,
  _encodeUtf8Polyfill: () => _encodeUtf8Polyfill,
  decodeUtf8: () => decodeUtf8,
  encodeUtf8: () => encodeUtf8,
  escapeHTML: () => escapeHTML,
  fromCamelCase: () => fromCamelCase,
  fromCharCode: () => fromCharCode,
  fromCodePoint: () => fromCodePoint,
  repeat: () => repeat,
  splice: () => splice,
  trimLeft: () => trimLeft,
  unescapeHTML: () => unescapeHTML,
  utf8ByteLength: () => utf8ByteLength,
  utf8TextDecoder: () => utf8TextDecoder,
  utf8TextEncoder: () => utf8TextEncoder
});
var fromCharCode = String.fromCharCode;
var fromCodePoint = String.fromCodePoint;
var MAX_UTF16_CHARACTER = fromCharCode(65535);
var toLowerCase = (s) => s.toLowerCase();
var trimLeftRegex = /^\s*/g;
var trimLeft = (s) => s.replace(trimLeftRegex, "");
var fromCamelCaseRegex = /([A-Z])/g;
var fromCamelCase = (s, separator) => trimLeft(s.replace(fromCamelCaseRegex, (match2) => `${separator}${toLowerCase(match2)}`));
var utf8ByteLength = (str) => unescape(encodeURIComponent(str)).length;
var _encodeUtf8Polyfill = (str) => {
  const encodedString = unescape(encodeURIComponent(str));
  const len = encodedString.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    buf[i] = /** @type {number} */
    encodedString.codePointAt(i);
  }
  return buf;
};
var utf8TextEncoder = (
  /** @type {TextEncoder} */
  typeof TextEncoder !== "undefined" ? new TextEncoder() : null
);
var _encodeUtf8Native = (str) => utf8TextEncoder.encode(str);
var encodeUtf8 = utf8TextEncoder ? _encodeUtf8Native : _encodeUtf8Polyfill;
var _decodeUtf8Polyfill = (buf) => {
  let remainingLen = buf.length;
  let encodedString = "";
  let bufPos = 0;
  while (remainingLen > 0) {
    const nextLen = remainingLen < 1e4 ? remainingLen : 1e4;
    const bytes = buf.subarray(bufPos, bufPos + nextLen);
    bufPos += nextLen;
    encodedString += String.fromCodePoint.apply(
      null,
      /** @type {any} */
      bytes
    );
    remainingLen -= nextLen;
  }
  return decodeURIComponent(escape(encodedString));
};
var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
if (utf8TextDecoder && utf8TextDecoder.decode(new Uint8Array()).length === 1) {
  utf8TextDecoder = null;
}
var _decodeUtf8Native = (buf) => (
  /** @type {TextDecoder} */
  utf8TextDecoder.decode(buf)
);
var decodeUtf8 = utf8TextDecoder ? _decodeUtf8Native : _decodeUtf8Polyfill;
var splice = (str, index, remove2, insert = "") => str.slice(0, index) + insert + str.slice(index + remove2);
var repeat = (source, n) => unfold(n, () => source).join("");
var escapeHTML = (str) => str.replace(/[&<>'"]/g, (r) => (
  /** @type {string} */
  {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[r]
));
var unescapeHTML = (str) => str.replace(/&amp;|&lt;|&gt;|&#39;|&quot;/g, (r) => (
  /** @type {string} */
  {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&#39;": "'",
    "&quot;": '"'
  }[r]
));

// node_modules/lib0/environment.js
var environment_exports = {};
__export(environment_exports, {
  ensureConf: () => ensureConf,
  getConf: () => getConf,
  getParam: () => getParam,
  getVariable: () => getVariable,
  hasConf: () => hasConf,
  hasParam: () => hasParam,
  isBrowser: () => isBrowser,
  isMac: () => isMac,
  isNode: () => isNode,
  production: () => production,
  supportsColor: () => supportsColor
});

// node_modules/lib0/conditions.js
var conditions_exports = {};
__export(conditions_exports, {
  undefinedToNull: () => undefinedToNull
});
var undefinedToNull = (v) => v === void 0 ? null : v;

// node_modules/lib0/storage.js
var VarStoragePolyfill = class {
  constructor() {
    this.map = /* @__PURE__ */ new Map();
  }
  /**
   * @param {string} key
   * @param {any} newValue
   */
  setItem(key, newValue) {
    this.map.set(key, newValue);
  }
  /**
   * @param {string} key
   */
  getItem(key) {
    return this.map.get(key);
  }
};
var _localStorage = new VarStoragePolyfill();
var usePolyfill = true;
try {
  if (typeof localStorage !== "undefined" && localStorage) {
    _localStorage = localStorage;
    usePolyfill = false;
  }
} catch (e) {
}
var varStorage = _localStorage;
var onChange = (eventHandler) => usePolyfill || addEventListener(
  "storage",
  /** @type {any} */
  eventHandler
);
var offChange = (eventHandler) => usePolyfill || removeEventListener(
  "storage",
  /** @type {any} */
  eventHandler
);

// node_modules/lib0/function.js
var function_exports = {};
__export(function_exports, {
  apply: () => apply,
  callAll: () => callAll,
  equalityDeep: () => equalityDeep,
  equalityFlat: () => equalityFlat,
  equalityStrict: () => equalityStrict,
  id: () => id,
  is: () => is,
  isArray: () => isArray2,
  isNumber: () => isNumber,
  isOneOf: () => isOneOf,
  isString: () => isString,
  isTemplate: () => isTemplate,
  nop: () => nop
});

// node_modules/lib0/object.js
var object_exports = {};
__export(object_exports, {
  assign: () => assign,
  create: () => create4,
  deepFreeze: () => deepFreeze,
  equalFlat: () => equalFlat2,
  every: () => every2,
  forEach: () => forEach,
  freeze: () => freeze,
  hasProperty: () => hasProperty,
  isEmpty: () => isEmpty,
  isObject: () => isObject,
  keys: () => keys,
  length: () => length,
  map: () => map3,
  setIfUndefined: () => setIfUndefined2,
  size: () => size,
  some: () => some2,
  values: () => values
});

// node_modules/lib0/trait/equality.js
var EqualityTraitSymbol = Symbol("Equality");
var equals = (a, b) => a === b || !!a?.[EqualityTraitSymbol]?.(b) || false;

// node_modules/lib0/object.js
var create4 = () => /* @__PURE__ */ Object.create(null);
var isObject = (o) => typeof o === "object";
var assign = Object.assign;
var keys = Object.keys;
var values = Object.values;
var forEach = (obj, f) => {
  for (const key in obj) {
    f(obj[key], key);
  }
};
var map3 = (obj, f) => {
  const results = [];
  for (const key in obj) {
    results.push(f(obj[key], key));
  }
  return results;
};
var length = (obj) => keys(obj).length;
var size = (obj) => keys(obj).length;
var some2 = (obj, f) => {
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
var every2 = (obj, f) => {
  for (const key in obj) {
    if (!f(obj[key], key)) {
      return false;
    }
  }
  return true;
};
var hasProperty = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
var equalFlat2 = (a, b) => a === b || size(a) === size(b) && every2(a, (val, key) => (val !== void 0 || hasProperty(b, key)) && equals(b[key], val));
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
var setIfUndefined2 = (o, key, createT) => hasProperty(o, key) ? o[key] : o[key] = createT();

// node_modules/lib0/function.js
var callAll = (fs, args2, i = 0) => {
  try {
    for (; i < fs.length; i++) {
      fs[i](...args2);
    }
  } finally {
    if (i < fs.length) {
      callAll(fs, args2, i + 1);
    }
  }
};
var nop = () => {
};
var apply = (f) => f();
var id = (a) => a;
var equalityStrict = (a, b) => a === b;
var equalityFlat = (a, b) => a === b || a != null && b != null && a.constructor === b.constructor && (isArray(a) && equalFlat(
  a,
  /** @type {Array<T>} */
  b
) || typeof a === "object" && equalFlat2(a, b));
var equalityDeep = (a, b) => {
  if (a === b) {
    return true;
  }
  if (a == null || b == null || a.constructor !== b.constructor && (a.constructor || Object) !== (b.constructor || Object)) {
    return false;
  }
  if (a[EqualityTraitSymbol] != null) {
    return a[EqualityTraitSymbol](b);
  }
  switch (a.constructor) {
    case ArrayBuffer:
      a = new Uint8Array(a);
      b = new Uint8Array(b);
    // eslint-disable-next-line no-fallthrough
    case Uint8Array: {
      if (a.byteLength !== b.byteLength) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      break;
    }
    case Set: {
      if (a.size !== b.size) {
        return false;
      }
      for (const value of a) {
        if (!b.has(value)) {
          return false;
        }
      }
      break;
    }
    case Map: {
      if (a.size !== b.size) {
        return false;
      }
      for (const key of a.keys()) {
        if (!b.has(key) || !equalityDeep(a.get(key), b.get(key))) {
          return false;
        }
      }
      break;
    }
    case void 0:
    case Object:
      if (size(a) !== size(b)) {
        return false;
      }
      for (const key in a) {
        if (!hasProperty(a, key) || !equalityDeep(a[key], b[key])) {
          return false;
        }
      }
      break;
    case Array:
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        if (!equalityDeep(a[i], b[i])) {
          return false;
        }
      }
      break;
    default:
      return false;
  }
  return true;
};
var isOneOf = (value, options) => options.includes(value);
var isArray2 = isArray;
var isString = (s) => s && s.constructor === String;
var isNumber = (n) => n != null && n.constructor === Number;
var is = (n, T) => n && n.constructor === T;
var isTemplate = (T) => (
  /**
   * @param {any} n
   * @return {n is InstanceType<TYPE>}
   **/
  (n) => n && n.constructor === T
);

// node_modules/lib0/environment.js
var isNode = typeof process !== "undefined" && process.release && /node|io\.js/.test(process.release.name) && Object.prototype.toString.call(typeof process !== "undefined" ? process : 0) === "[object process]";
var isBrowser = typeof window !== "undefined" && typeof document !== "undefined" && !isNode;
var isMac = typeof navigator !== "undefined" ? /Mac/.test(navigator.platform) : false;
var params;
var args = [];
var computeParams = () => {
  if (params === void 0) {
    if (isNode) {
      params = create3();
      const pargs = process.argv;
      let currParamName = null;
      for (let i = 0; i < pargs.length; i++) {
        const parg = pargs[i];
        if (parg[0] === "-") {
          if (currParamName !== null) {
            params.set(currParamName, "");
          }
          currParamName = parg;
        } else {
          if (currParamName !== null) {
            params.set(currParamName, parg);
            currParamName = null;
          } else {
            args.push(parg);
          }
        }
      }
      if (currParamName !== null) {
        params.set(currParamName, "");
      }
    } else if (typeof location === "object") {
      params = create3();
      (location.search || "?").slice(1).split("&").forEach((kv) => {
        if (kv.length !== 0) {
          const [key, value] = kv.split("=");
          params.set(`--${fromCamelCase(key, "-")}`, value);
          params.set(`-${fromCamelCase(key, "-")}`, value);
        }
      });
    } else {
      params = create3();
    }
  }
  return params;
};
var hasParam = (name) => computeParams().has(name);
var getParam = (name, defaultVal) => computeParams().get(name) || defaultVal;
var getVariable = (name) => isNode ? undefinedToNull(process.env[name.toUpperCase().replaceAll("-", "_")]) : undefinedToNull(varStorage.getItem(name));
var getConf = (name) => computeParams().get("--" + name) || getVariable(name);
var ensureConf = (name) => {
  const c = getConf(name);
  if (c == null) throw new Error(`Expected configuration "${name.toUpperCase().replaceAll("-", "_")}"`);
  return c;
};
var hasConf = (name) => hasParam("--" + name) || getVariable(name) !== null;
var production = hasConf("production");
var forceColor = isNode && isOneOf(process.env.FORCE_COLOR, ["true", "1", "2"]);
var supportsColor = forceColor || !hasParam("--no-colors") && // @todo deprecate --no-colors
!hasConf("no-color") && (!isNode || process.stdout.isTTY) && (!isNode || hasParam("--color") || getVariable("COLORTERM") !== null || (getVariable("TERM") || "").includes("color"));

// node_modules/lib0/math.js
var math_exports = {};
__export(math_exports, {
  abs: () => abs,
  add: () => add,
  ceil: () => ceil,
  exp10: () => exp10,
  floor: () => floor,
  imul: () => imul,
  isNaN: () => isNaN,
  isNegativeZero: () => isNegativeZero,
  log: () => log,
  log10: () => log10,
  log2: () => log2,
  max: () => max,
  min: () => min,
  pow: () => pow,
  round: () => round,
  sign: () => sign,
  sqrt: () => sqrt
});
var floor = Math.floor;
var ceil = Math.ceil;
var abs = Math.abs;
var imul = Math.imul;
var round = Math.round;
var log10 = Math.log10;
var log2 = Math.log2;
var log = Math.log;
var sqrt = Math.sqrt;
var add = (a, b) => a + b;
var min = (a, b) => a < b ? a : b;
var max = (a, b) => a > b ? a : b;
var isNaN = Number.isNaN;
var pow = Math.pow;
var exp10 = (exp) => Math.pow(10, exp);
var sign = Math.sign;
var isNegativeZero = (n) => n !== 0 ? n < 0 : 1 / n < 0;

// node_modules/lib0/encoding.js
var encoding_exports = {};
__export(encoding_exports, {
  Encoder: () => Encoder,
  IncUintOptRleEncoder: () => IncUintOptRleEncoder,
  IntDiffEncoder: () => IntDiffEncoder,
  IntDiffOptRleEncoder: () => IntDiffOptRleEncoder,
  RleEncoder: () => RleEncoder,
  RleIntDiffEncoder: () => RleIntDiffEncoder,
  StringEncoder: () => StringEncoder,
  UintOptRleEncoder: () => UintOptRleEncoder,
  _writeVarStringNative: () => _writeVarStringNative,
  _writeVarStringPolyfill: () => _writeVarStringPolyfill,
  createEncoder: () => createEncoder,
  encode: () => encode,
  hasContent: () => hasContent,
  length: () => length2,
  set: () => set,
  setUint16: () => setUint16,
  setUint32: () => setUint32,
  setUint8: () => setUint8,
  toUint8Array: () => toUint8Array,
  verifyLen: () => verifyLen,
  write: () => write,
  writeAny: () => writeAny,
  writeBigInt64: () => writeBigInt64,
  writeBigUint64: () => writeBigUint64,
  writeBinaryEncoder: () => writeBinaryEncoder,
  writeFloat32: () => writeFloat32,
  writeFloat64: () => writeFloat64,
  writeOnDataView: () => writeOnDataView,
  writeTerminatedString: () => writeTerminatedString,
  writeTerminatedUint8Array: () => writeTerminatedUint8Array,
  writeUint16: () => writeUint16,
  writeUint32: () => writeUint32,
  writeUint32BigEndian: () => writeUint32BigEndian,
  writeUint8: () => writeUint8,
  writeUint8Array: () => writeUint8Array,
  writeVarInt: () => writeVarInt,
  writeVarString: () => writeVarString,
  writeVarUint: () => writeVarUint,
  writeVarUint8Array: () => writeVarUint8Array
});

// node_modules/lib0/number.js
var number_exports = {};
__export(number_exports, {
  HIGHEST_INT32: () => HIGHEST_INT32,
  HIGHEST_UINT32: () => HIGHEST_UINT32,
  LOWEST_INT32: () => LOWEST_INT32,
  MAX_SAFE_INTEGER: () => MAX_SAFE_INTEGER,
  MIN_SAFE_INTEGER: () => MIN_SAFE_INTEGER,
  countBits: () => countBits,
  isInteger: () => isInteger,
  isNaN: () => isNaN2,
  parseInt: () => parseInt
});
var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
var MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;
var LOWEST_INT32 = 1 << 31;
var HIGHEST_INT32 = BITS31;
var HIGHEST_UINT32 = BITS32;
var isInteger = Number.isInteger || ((num) => typeof num === "number" && isFinite(num) && floor(num) === num);
var isNaN2 = Number.isNaN;
var parseInt = Number.parseInt;
var countBits = (n) => {
  n &= BITS32;
  let count2 = 0;
  while (n) {
    n &= n - 1;
    count2++;
  }
  return count2;
};

// node_modules/lib0/encoding.js
var Encoder = class {
  constructor() {
    this.cpos = 0;
    this.cbuf = new Uint8Array(100);
    this.bufs = [];
  }
};
var createEncoder = () => new Encoder();
var encode = (f) => {
  const encoder = createEncoder();
  f(encoder);
  return toUint8Array(encoder);
};
var length2 = (encoder) => {
  let len = encoder.cpos;
  for (let i = 0; i < encoder.bufs.length; i++) {
    len += encoder.bufs[i].length;
  }
  return len;
};
var hasContent = (encoder) => encoder.cpos > 0 || encoder.bufs.length > 0;
var toUint8Array = (encoder) => {
  const uint8arr = new Uint8Array(length2(encoder));
  let curPos = 0;
  for (let i = 0; i < encoder.bufs.length; i++) {
    const d = encoder.bufs[i];
    uint8arr.set(d, curPos);
    curPos += d.length;
  }
  uint8arr.set(new Uint8Array(encoder.cbuf.buffer, 0, encoder.cpos), curPos);
  return uint8arr;
};
var verifyLen = (encoder, len) => {
  const bufferLen = encoder.cbuf.length;
  if (bufferLen - encoder.cpos < len) {
    encoder.bufs.push(new Uint8Array(encoder.cbuf.buffer, 0, encoder.cpos));
    encoder.cbuf = new Uint8Array(max(bufferLen, len) * 2);
    encoder.cpos = 0;
  }
};
var write = (encoder, num) => {
  const bufferLen = encoder.cbuf.length;
  if (encoder.cpos === bufferLen) {
    encoder.bufs.push(encoder.cbuf);
    encoder.cbuf = new Uint8Array(bufferLen * 2);
    encoder.cpos = 0;
  }
  encoder.cbuf[encoder.cpos++] = num;
};
var set = (encoder, pos, num) => {
  let buffer = null;
  for (let i = 0; i < encoder.bufs.length && buffer === null; i++) {
    const b = encoder.bufs[i];
    if (pos < b.length) {
      buffer = b;
    } else {
      pos -= b.length;
    }
  }
  if (buffer === null) {
    buffer = encoder.cbuf;
  }
  buffer[pos] = num;
};
var writeUint8 = write;
var setUint8 = set;
var writeUint16 = (encoder, num) => {
  write(encoder, num & BITS8);
  write(encoder, num >>> 8 & BITS8);
};
var setUint16 = (encoder, pos, num) => {
  set(encoder, pos, num & BITS8);
  set(encoder, pos + 1, num >>> 8 & BITS8);
};
var writeUint32 = (encoder, num) => {
  for (let i = 0; i < 4; i++) {
    write(encoder, num & BITS8);
    num >>>= 8;
  }
};
var writeUint32BigEndian = (encoder, num) => {
  for (let i = 3; i >= 0; i--) {
    write(encoder, num >>> 8 * i & BITS8);
  }
};
var setUint32 = (encoder, pos, num) => {
  for (let i = 0; i < 4; i++) {
    set(encoder, pos + i, num & BITS8);
    num >>>= 8;
  }
};
var writeVarUint = (encoder, num) => {
  while (num > BITS7) {
    write(encoder, BIT8 | BITS7 & num);
    num = floor(num / 128);
  }
  write(encoder, BITS7 & num);
};
var writeVarInt = (encoder, num) => {
  const isNegative = isNegativeZero(num);
  if (isNegative) {
    num = -num;
  }
  write(encoder, (num > BITS6 ? BIT8 : 0) | (isNegative ? BIT7 : 0) | BITS6 & num);
  num = floor(num / 64);
  while (num > 0) {
    write(encoder, (num > BITS7 ? BIT8 : 0) | BITS7 & num);
    num = floor(num / 128);
  }
};
var _strBuffer = new Uint8Array(3e4);
var _maxStrBSize = _strBuffer.length / 3;
var _writeVarStringNative = (encoder, str) => {
  if (str.length < _maxStrBSize) {
    const written = utf8TextEncoder.encodeInto(str, _strBuffer).written || 0;
    writeVarUint(encoder, written);
    for (let i = 0; i < written; i++) {
      write(encoder, _strBuffer[i]);
    }
  } else {
    writeVarUint8Array(encoder, encodeUtf8(str));
  }
};
var _writeVarStringPolyfill = (encoder, str) => {
  const encodedString = unescape(encodeURIComponent(str));
  const len = encodedString.length;
  writeVarUint(encoder, len);
  for (let i = 0; i < len; i++) {
    write(
      encoder,
      /** @type {number} */
      encodedString.codePointAt(i)
    );
  }
};
var writeVarString = utf8TextEncoder && /** @type {any} */
utf8TextEncoder.encodeInto ? _writeVarStringNative : _writeVarStringPolyfill;
var writeTerminatedString = (encoder, str) => writeTerminatedUint8Array(encoder, encodeUtf8(str));
var writeTerminatedUint8Array = (encoder, buf) => {
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0 || b === 1) {
      write(encoder, 1);
    }
    write(encoder, buf[i]);
  }
  write(encoder, 0);
};
var writeBinaryEncoder = (encoder, append2) => writeUint8Array(encoder, toUint8Array(append2));
var writeUint8Array = (encoder, uint8Array2) => {
  const bufferLen = encoder.cbuf.length;
  const cpos = encoder.cpos;
  const leftCopyLen = min(bufferLen - cpos, uint8Array2.length);
  const rightCopyLen = uint8Array2.length - leftCopyLen;
  encoder.cbuf.set(uint8Array2.subarray(0, leftCopyLen), cpos);
  encoder.cpos += leftCopyLen;
  if (rightCopyLen > 0) {
    encoder.bufs.push(encoder.cbuf);
    encoder.cbuf = new Uint8Array(max(bufferLen * 2, rightCopyLen));
    encoder.cbuf.set(uint8Array2.subarray(leftCopyLen));
    encoder.cpos = rightCopyLen;
  }
};
var writeVarUint8Array = (encoder, uint8Array2) => {
  writeVarUint(encoder, uint8Array2.byteLength);
  writeUint8Array(encoder, uint8Array2);
};
var writeOnDataView = (encoder, len) => {
  verifyLen(encoder, len);
  const dview = new DataView(encoder.cbuf.buffer, encoder.cpos, len);
  encoder.cpos += len;
  return dview;
};
var writeFloat32 = (encoder, num) => writeOnDataView(encoder, 4).setFloat32(0, num, false);
var writeFloat64 = (encoder, num) => writeOnDataView(encoder, 8).setFloat64(0, num, false);
var writeBigInt64 = (encoder, num) => (
  /** @type {any} */
  writeOnDataView(encoder, 8).setBigInt64(0, num, false)
);
var writeBigUint64 = (encoder, num) => (
  /** @type {any} */
  writeOnDataView(encoder, 8).setBigUint64(0, num, false)
);
var floatTestBed = new DataView(new ArrayBuffer(4));
var isFloat32 = (num) => {
  floatTestBed.setFloat32(0, num);
  return floatTestBed.getFloat32(0) === num;
};
var writeAny = (encoder, data) => {
  switch (typeof data) {
    case "string":
      write(encoder, 119);
      writeVarString(encoder, data);
      break;
    case "number":
      if (isInteger(data) && abs(data) <= BITS31) {
        write(encoder, 125);
        writeVarInt(encoder, data);
      } else if (isFloat32(data)) {
        write(encoder, 124);
        writeFloat32(encoder, data);
      } else {
        write(encoder, 123);
        writeFloat64(encoder, data);
      }
      break;
    case "bigint":
      write(encoder, 122);
      writeBigInt64(encoder, data);
      break;
    case "object":
      if (data === null) {
        write(encoder, 126);
      } else if (isArray(data)) {
        write(encoder, 117);
        writeVarUint(encoder, data.length);
        for (let i = 0; i < data.length; i++) {
          writeAny(encoder, data[i]);
        }
      } else if (data instanceof Uint8Array) {
        write(encoder, 116);
        writeVarUint8Array(encoder, data);
      } else {
        write(encoder, 118);
        const keys2 = Object.keys(data);
        writeVarUint(encoder, keys2.length);
        for (let i = 0; i < keys2.length; i++) {
          const key = keys2[i];
          writeVarString(encoder, key);
          writeAny(encoder, data[key]);
        }
      }
      break;
    case "boolean":
      write(encoder, data ? 120 : 121);
      break;
    default:
      write(encoder, 127);
  }
};
var RleEncoder = class extends Encoder {
  /**
   * @param {function(Encoder, T):void} writer
   */
  constructor(writer) {
    super();
    this.w = writer;
    this.s = null;
    this.count = 0;
  }
  /**
   * @param {T} v
   */
  write(v) {
    if (this.s === v) {
      this.count++;
    } else {
      if (this.count > 0) {
        writeVarUint(this, this.count - 1);
      }
      this.count = 1;
      this.w(this, v);
      this.s = v;
    }
  }
};
var IntDiffEncoder = class extends Encoder {
  /**
   * @param {number} start
   */
  constructor(start) {
    super();
    this.s = start;
  }
  /**
   * @param {number} v
   */
  write(v) {
    writeVarInt(this, v - this.s);
    this.s = v;
  }
};
var RleIntDiffEncoder = class extends Encoder {
  /**
   * @param {number} start
   */
  constructor(start) {
    super();
    this.s = start;
    this.count = 0;
  }
  /**
   * @param {number} v
   */
  write(v) {
    if (this.s === v && this.count > 0) {
      this.count++;
    } else {
      if (this.count > 0) {
        writeVarUint(this, this.count - 1);
      }
      this.count = 1;
      writeVarInt(this, v - this.s);
      this.s = v;
    }
  }
};
var flushUintOptRleEncoder = (encoder) => {
  if (encoder.count > 0) {
    writeVarInt(encoder.encoder, encoder.count === 1 ? encoder.s : -encoder.s);
    if (encoder.count > 1) {
      writeVarUint(encoder.encoder, encoder.count - 2);
    }
  }
};
var UintOptRleEncoder = class {
  constructor() {
    this.encoder = new Encoder();
    this.s = 0;
    this.count = 0;
  }
  /**
   * @param {number} v
   */
  write(v) {
    if (this.s === v) {
      this.count++;
    } else {
      flushUintOptRleEncoder(this);
      this.count = 1;
      this.s = v;
    }
  }
  /**
   * Flush the encoded state and transform this to a Uint8Array.
   *
   * Note that this should only be called once.
   */
  toUint8Array() {
    flushUintOptRleEncoder(this);
    return toUint8Array(this.encoder);
  }
};
var IncUintOptRleEncoder = class {
  constructor() {
    this.encoder = new Encoder();
    this.s = 0;
    this.count = 0;
  }
  /**
   * @param {number} v
   */
  write(v) {
    if (this.s + this.count === v) {
      this.count++;
    } else {
      flushUintOptRleEncoder(this);
      this.count = 1;
      this.s = v;
    }
  }
  /**
   * Flush the encoded state and transform this to a Uint8Array.
   *
   * Note that this should only be called once.
   */
  toUint8Array() {
    flushUintOptRleEncoder(this);
    return toUint8Array(this.encoder);
  }
};
var flushIntDiffOptRleEncoder = (encoder) => {
  if (encoder.count > 0) {
    const encodedDiff = encoder.diff * 2 + (encoder.count === 1 ? 0 : 1);
    writeVarInt(encoder.encoder, encodedDiff);
    if (encoder.count > 1) {
      writeVarUint(encoder.encoder, encoder.count - 2);
    }
  }
};
var IntDiffOptRleEncoder = class {
  constructor() {
    this.encoder = new Encoder();
    this.s = 0;
    this.count = 0;
    this.diff = 0;
  }
  /**
   * @param {number} v
   */
  write(v) {
    if (this.diff === v - this.s) {
      this.s = v;
      this.count++;
    } else {
      flushIntDiffOptRleEncoder(this);
      this.count = 1;
      this.diff = v - this.s;
      this.s = v;
    }
  }
  /**
   * Flush the encoded state and transform this to a Uint8Array.
   *
   * Note that this should only be called once.
   */
  toUint8Array() {
    flushIntDiffOptRleEncoder(this);
    return toUint8Array(this.encoder);
  }
};
var StringEncoder = class {
  constructor() {
    this.sarr = [];
    this.s = "";
    this.lensE = new UintOptRleEncoder();
  }
  /**
   * @param {string} string
   */
  write(string) {
    this.s += string;
    if (this.s.length > 19) {
      this.sarr.push(this.s);
      this.s = "";
    }
    this.lensE.write(string.length);
  }
  toUint8Array() {
    const encoder = new Encoder();
    this.sarr.push(this.s);
    this.s = "";
    writeVarString(encoder, this.sarr.join(""));
    writeUint8Array(encoder, this.lensE.toUint8Array());
    return toUint8Array(encoder);
  }
};

// node_modules/lib0/decoding.js
var decoding_exports = {};
__export(decoding_exports, {
  Decoder: () => Decoder,
  IncUintOptRleDecoder: () => IncUintOptRleDecoder,
  IntDiffDecoder: () => IntDiffDecoder,
  IntDiffOptRleDecoder: () => IntDiffOptRleDecoder,
  RleDecoder: () => RleDecoder,
  RleIntDiffDecoder: () => RleIntDiffDecoder,
  StringDecoder: () => StringDecoder,
  UintOptRleDecoder: () => UintOptRleDecoder,
  _readVarStringNative: () => _readVarStringNative,
  _readVarStringPolyfill: () => _readVarStringPolyfill,
  clone: () => clone,
  createDecoder: () => createDecoder,
  hasContent: () => hasContent2,
  peekUint16: () => peekUint16,
  peekUint32: () => peekUint32,
  peekUint8: () => peekUint8,
  peekVarInt: () => peekVarInt,
  peekVarString: () => peekVarString,
  peekVarUint: () => peekVarUint,
  readAny: () => readAny,
  readBigInt64: () => readBigInt64,
  readBigUint64: () => readBigUint64,
  readFloat32: () => readFloat32,
  readFloat64: () => readFloat64,
  readFromDataView: () => readFromDataView,
  readTailAsUint8Array: () => readTailAsUint8Array,
  readTerminatedString: () => readTerminatedString,
  readTerminatedUint8Array: () => readTerminatedUint8Array,
  readUint16: () => readUint16,
  readUint32: () => readUint32,
  readUint32BigEndian: () => readUint32BigEndian,
  readUint8: () => readUint8,
  readUint8Array: () => readUint8Array,
  readVarInt: () => readVarInt,
  readVarString: () => readVarString,
  readVarUint: () => readVarUint,
  readVarUint8Array: () => readVarUint8Array,
  skip8: () => skip8
});

// node_modules/lib0/error.js
var error_exports = {};
__export(error_exports, {
  assert: () => assert,
  create: () => create5,
  methodUnimplemented: () => methodUnimplemented,
  unexpectedCase: () => unexpectedCase
});
var create5 = (s) => new Error(s);
var methodUnimplemented = () => {
  throw create5("Method unimplemented");
};
var unexpectedCase = () => {
  throw create5("Unexpected case");
};
var assert = (property) => {
  if (!property) throw create5("Assert failed");
};

// node_modules/lib0/decoding.js
var errorUnexpectedEndOfArray = create5("Unexpected end of array");
var errorIntegerOutOfRange = create5("Integer out of Range");
var subarray = (arr, begin, len) => {
  if (begin < 0 || len < 0 || begin + len > arr.length) {
    throw errorUnexpectedEndOfArray;
  }
  return new Uint8Array(arr.buffer, arr.byteOffset + begin, len);
};
var subdataview = (arr, begin, len) => {
  if (begin < 0 || len < 0 || begin + len > arr.length) {
    throw errorUnexpectedEndOfArray;
  }
  return new DataView(arr.buffer, arr.byteOffset + begin, len);
};
var Decoder = class {
  /**
   * @param {Uint8Array<Buf>} uint8Array Binary data to decode
   */
  constructor(uint8Array2) {
    this.arr = uint8Array2;
    this.pos = 0;
  }
};
var createDecoder = (uint8Array2) => new Decoder(uint8Array2);
var hasContent2 = (decoder) => decoder.pos !== decoder.arr.length;
var clone = (decoder, newPos = decoder.pos) => {
  const _decoder = createDecoder(decoder.arr);
  _decoder.pos = newPos;
  return _decoder;
};
var readUint8Array = (decoder, len) => {
  const view = subarray(decoder.arr, decoder.pos, len);
  decoder.pos += len;
  return view;
};
var readVarUint8Array = (decoder) => readUint8Array(decoder, readVarUint(decoder));
var readTailAsUint8Array = (decoder) => readUint8Array(decoder, decoder.arr.length - decoder.pos);
var skip8 = (decoder) => decoder.pos++;
var readUint8 = (decoder) => decoder.arr[decoder.pos++];
var readUint16 = (decoder) => {
  const uint = decoder.arr[decoder.pos] + (decoder.arr[decoder.pos + 1] << 8);
  decoder.pos += 2;
  return uint;
};
var readUint32 = (decoder) => {
  const uint = decoder.arr[decoder.pos] + (decoder.arr[decoder.pos + 1] << 8) + (decoder.arr[decoder.pos + 2] << 16) + (decoder.arr[decoder.pos + 3] << 24) >>> 0;
  decoder.pos += 4;
  return uint;
};
var readUint32BigEndian = (decoder) => {
  const uint = decoder.arr[decoder.pos + 3] + (decoder.arr[decoder.pos + 2] << 8) + (decoder.arr[decoder.pos + 1] << 16) + (decoder.arr[decoder.pos] << 24) >>> 0;
  decoder.pos += 4;
  return uint;
};
var peekUint8 = (decoder) => decoder.arr[decoder.pos];
var peekUint16 = (decoder) => decoder.arr[decoder.pos] + (decoder.arr[decoder.pos + 1] << 8);
var peekUint32 = (decoder) => decoder.arr[decoder.pos] + (decoder.arr[decoder.pos + 1] << 8) + (decoder.arr[decoder.pos + 2] << 16) + (decoder.arr[decoder.pos + 3] << 24) >>> 0;
var readVarUint = (decoder) => {
  let num = 0;
  let mult = 1;
  const len = decoder.arr.length;
  while (decoder.pos < len) {
    const r = decoder.arr[decoder.pos++];
    num = num + (r & BITS7) * mult;
    mult *= 128;
    if (r < BIT8) {
      return num;
    }
    if (num > MAX_SAFE_INTEGER) {
      throw errorIntegerOutOfRange;
    }
  }
  throw errorUnexpectedEndOfArray;
};
var readVarInt = (decoder) => {
  let r = decoder.arr[decoder.pos++];
  let num = r & BITS6;
  let mult = 64;
  const sign2 = (r & BIT7) > 0 ? -1 : 1;
  if ((r & BIT8) === 0) {
    return sign2 * num;
  }
  const len = decoder.arr.length;
  while (decoder.pos < len) {
    r = decoder.arr[decoder.pos++];
    num = num + (r & BITS7) * mult;
    mult *= 128;
    if (r < BIT8) {
      return sign2 * num;
    }
    if (num > MAX_SAFE_INTEGER) {
      throw errorIntegerOutOfRange;
    }
  }
  throw errorUnexpectedEndOfArray;
};
var peekVarUint = (decoder) => {
  const pos = decoder.pos;
  const s = readVarUint(decoder);
  decoder.pos = pos;
  return s;
};
var peekVarInt = (decoder) => {
  const pos = decoder.pos;
  const s = readVarInt(decoder);
  decoder.pos = pos;
  return s;
};
var _readVarStringPolyfill = (decoder) => {
  let remainingLen = readVarUint(decoder);
  if (remainingLen === 0) {
    return "";
  } else {
    let encodedString = String.fromCodePoint(readUint8(decoder));
    if (--remainingLen < 100) {
      while (remainingLen--) {
        encodedString += String.fromCodePoint(readUint8(decoder));
      }
    } else {
      while (remainingLen > 0) {
        const nextLen = remainingLen < 1e4 ? remainingLen : 1e4;
        const bytes = decoder.arr.subarray(decoder.pos, decoder.pos + nextLen);
        decoder.pos += nextLen;
        encodedString += String.fromCodePoint.apply(
          null,
          /** @type {any} */
          bytes
        );
        remainingLen -= nextLen;
      }
    }
    return decodeURIComponent(escape(encodedString));
  }
};
var _readVarStringNative = (decoder) => (
  /** @type any */
  utf8TextDecoder.decode(readVarUint8Array(decoder))
);
var readVarString = utf8TextDecoder ? _readVarStringNative : _readVarStringPolyfill;
var readTerminatedUint8Array = (decoder) => {
  const encoder = createEncoder();
  let b;
  while (true) {
    b = readUint8(decoder);
    if (b === 0) {
      return toUint8Array(encoder);
    }
    if (b === 1) {
      b = readUint8(decoder);
    }
    write(encoder, b);
  }
};
var readTerminatedString = (decoder) => decodeUtf8(readTerminatedUint8Array(decoder));
var peekVarString = (decoder) => {
  const pos = decoder.pos;
  const s = readVarString(decoder);
  decoder.pos = pos;
  return s;
};
var readFromDataView = (decoder, len) => {
  const dv = subdataview(decoder.arr, decoder.pos, len);
  decoder.pos += len;
  return dv;
};
var readFloat32 = (decoder) => readFromDataView(decoder, 4).getFloat32(0, false);
var readFloat64 = (decoder) => readFromDataView(decoder, 8).getFloat64(0, false);
var readBigInt64 = (decoder) => (
  /** @type {any} */
  readFromDataView(decoder, 8).getBigInt64(0, false)
);
var readBigUint64 = (decoder) => (
  /** @type {any} */
  readFromDataView(decoder, 8).getBigUint64(0, false)
);
var readAnyLookupTable = [
  (decoder) => void 0,
  // CASE 127: undefined
  (decoder) => null,
  // CASE 126: null
  readVarInt,
  // CASE 125: integer
  readFloat32,
  // CASE 124: float32
  readFloat64,
  // CASE 123: float64
  readBigInt64,
  // CASE 122: bigint
  (decoder) => false,
  // CASE 121: boolean (false)
  (decoder) => true,
  // CASE 120: boolean (true)
  readVarString,
  // CASE 119: string
  (decoder) => {
    const len = readVarUint(decoder);
    const obj = {};
    for (let i = 0; i < len; i++) {
      const key = readVarString(decoder);
      obj[key] = readAny(decoder);
    }
    return obj;
  },
  (decoder) => {
    const len = readVarUint(decoder);
    const arr = [];
    for (let i = 0; i < len; i++) {
      arr.push(readAny(decoder));
    }
    return arr;
  },
  readVarUint8Array
  // CASE 116: Uint8Array
];
var readAny = (decoder) => readAnyLookupTable[127 - readUint8(decoder)](decoder);
var RleDecoder = class extends Decoder {
  /**
   * @param {Uint8Array} uint8Array
   * @param {function(Decoder):T} reader
   */
  constructor(uint8Array2, reader) {
    super(uint8Array2);
    this.reader = reader;
    this.s = null;
    this.count = 0;
  }
  read() {
    if (this.count === 0) {
      this.s = this.reader(this);
      if (hasContent2(this)) {
        this.count = readVarUint(this) + 1;
      } else {
        this.count = -1;
      }
    }
    this.count--;
    return (
      /** @type {T} */
      this.s
    );
  }
};
var IntDiffDecoder = class extends Decoder {
  /**
   * @param {Uint8Array} uint8Array
   * @param {number} start
   */
  constructor(uint8Array2, start) {
    super(uint8Array2);
    this.s = start;
  }
  /**
   * @return {number}
   */
  read() {
    this.s += readVarInt(this);
    return this.s;
  }
};
var RleIntDiffDecoder = class extends Decoder {
  /**
   * @param {Uint8Array} uint8Array
   * @param {number} start
   */
  constructor(uint8Array2, start) {
    super(uint8Array2);
    this.s = start;
    this.count = 0;
  }
  /**
   * @return {number}
   */
  read() {
    if (this.count === 0) {
      this.s += readVarInt(this);
      if (hasContent2(this)) {
        this.count = readVarUint(this) + 1;
      } else {
        this.count = -1;
      }
    }
    this.count--;
    return (
      /** @type {number} */
      this.s
    );
  }
};
var UintOptRleDecoder = class extends Decoder {
  /**
   * @param {Uint8Array} uint8Array
   */
  constructor(uint8Array2) {
    super(uint8Array2);
    this.s = 0;
    this.count = 0;
  }
  read() {
    if (this.count === 0) {
      this.s = readVarInt(this);
      const isNegative = isNegativeZero(this.s);
      this.count = 1;
      if (isNegative) {
        this.s = -this.s;
        this.count = readVarUint(this) + 2;
      }
    }
    this.count--;
    return (
      /** @type {number} */
      this.s
    );
  }
};
var IncUintOptRleDecoder = class extends Decoder {
  /**
   * @param {Uint8Array} uint8Array
   */
  constructor(uint8Array2) {
    super(uint8Array2);
    this.s = 0;
    this.count = 0;
  }
  read() {
    if (this.count === 0) {
      this.s = readVarInt(this);
      const isNegative = isNegativeZero(this.s);
      this.count = 1;
      if (isNegative) {
        this.s = -this.s;
        this.count = readVarUint(this) + 2;
      }
    }
    this.count--;
    return (
      /** @type {number} */
      this.s++
    );
  }
};
var IntDiffOptRleDecoder = class extends Decoder {
  /**
   * @param {Uint8Array} uint8Array
   */
  constructor(uint8Array2) {
    super(uint8Array2);
    this.s = 0;
    this.count = 0;
    this.diff = 0;
  }
  /**
   * @return {number}
   */
  read() {
    if (this.count === 0) {
      const diff = readVarInt(this);
      const hasCount = diff & 1;
      this.diff = floor(diff / 2);
      this.count = 1;
      if (hasCount) {
        this.count = readVarUint(this) + 2;
      }
    }
    this.s += this.diff;
    this.count--;
    return this.s;
  }
};
var StringDecoder = class {
  /**
   * @param {Uint8Array} uint8Array
   */
  constructor(uint8Array2) {
    this.decoder = new UintOptRleDecoder(uint8Array2);
    this.str = readVarString(this.decoder);
    this.spos = 0;
  }
  /**
   * @return {string}
   */
  read() {
    const end = this.spos + this.decoder.read();
    const res = this.str.slice(this.spos, end);
    this.spos = end;
    return res;
  }
};

// node_modules/lib0/buffer.js
var createUint8ArrayFromLen = (len) => new Uint8Array(len);
var createUint8ArrayViewFromArrayBuffer = (buffer, byteOffset, length3) => new Uint8Array(buffer, byteOffset, length3);
var createUint8ArrayFromArrayBuffer = (buffer) => new Uint8Array(buffer);
var toBase64Browser = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    s += fromCharCode(bytes[i]);
  }
  return btoa(s);
};
var toBase64Node = (bytes) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
var fromBase64Browser = (s) => {
  const a = atob(s);
  const bytes = createUint8ArrayFromLen(a.length);
  for (let i = 0; i < a.length; i++) {
    bytes[i] = a.charCodeAt(i);
  }
  return bytes;
};
var fromBase64Node = (s) => new Uint8Array(Buffer.from(s, "base64"));
var toBase64 = isBrowser ? toBase64Browser : toBase64Node;
var fromBase64 = isBrowser ? fromBase64Browser : fromBase64Node;
var toBase64UrlEncoded = (buf) => toBase64(buf).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
var fromBase64UrlEncoded = (base64) => fromBase64(base64.replaceAll("-", "+").replaceAll("_", "/"));
var toHexString = (buf) => map(buf, (b) => b.toString(16).padStart(2, "0")).join("");
var fromHexString = (hex) => {
  const hlen = hex.length;
  const buf = new Uint8Array(ceil(hlen / 2));
  for (let i = 0; i < hlen; i += 2) {
    buf[buf.length - i / 2 - 1] = Number.parseInt(hex.slice(hlen - i - 2, hlen - i), 16);
  }
  return buf;
};
var copyUint8Array = (uint8Array2) => {
  const newBuf = createUint8ArrayFromLen(uint8Array2.byteLength);
  newBuf.set(uint8Array2);
  return newBuf;
};
var encodeAny = (data) => encode((encoder) => writeAny(encoder, data));
var decodeAny = (buf) => readAny(createDecoder(buf));
var shiftNBitsLeft = (bs, N2) => {
  if (N2 === 0) return bs;
  bs = new Uint8Array(bs);
  bs[0] <<= N2;
  for (let i = 1; i < bs.length; i++) {
    bs[i - 1] |= bs[i] >>> 8 - N2;
    bs[i] <<= N2;
  }
  return bs;
};

// node_modules/lib0/broadcastchannel.js
var channels = /* @__PURE__ */ new Map();
var LocalStoragePolyfill = class {
  /**
   * @param {string} room
   */
  constructor(room) {
    this.room = room;
    this.onmessage = null;
    this._onChange = (e) => e.key === room && this.onmessage !== null && this.onmessage({ data: fromBase64(e.newValue || "") });
    onChange(this._onChange);
  }
  /**
   * @param {ArrayBuffer} buf
   */
  postMessage(buf) {
    varStorage.setItem(this.room, toBase64(createUint8ArrayFromArrayBuffer(buf)));
  }
  close() {
    offChange(this._onChange);
  }
};
var BC = typeof BroadcastChannel === "undefined" ? LocalStoragePolyfill : BroadcastChannel;
var getChannel = (room) => setIfUndefined(channels, room, () => {
  const subs = create();
  const bc = new BC(room);
  bc.onmessage = (e) => subs.forEach((sub) => sub(e.data, "broadcastchannel"));
  return {
    bc,
    subs
  };
});
var subscribe = (room, f) => {
  getChannel(room).subs.add(f);
  return f;
};
var unsubscribe = (room, f) => {
  const channel = getChannel(room);
  const unsubscribed = channel.subs.delete(f);
  if (unsubscribed && channel.subs.size === 0) {
    channel.bc.close();
    channels.delete(room);
  }
  return unsubscribed;
};
var publish = (room, data, origin = null) => {
  const c = getChannel(room);
  c.bc.postMessage(data);
  c.subs.forEach((sub) => sub(data, origin));
};

// node_modules/lib0/diff.js
var diff_exports = {};
__export(diff_exports, {
  simpleDiff: () => simpleDiff,
  simpleDiffArray: () => simpleDiffArray,
  simpleDiffString: () => simpleDiffString,
  simpleDiffStringWithCursor: () => simpleDiffStringWithCursor
});
var highSurrogateRegex = /[\uD800-\uDBFF]/;
var lowSurrogateRegex = /[\uDC00-\uDFFF]/;
var simpleDiffString = (a, b) => {
  let left = 0;
  let right = 0;
  while (left < a.length && left < b.length && a[left] === b[left]) {
    left++;
  }
  if (left > 0 && highSurrogateRegex.test(a[left - 1])) left--;
  while (right + left < a.length && right + left < b.length && a[a.length - right - 1] === b[b.length - right - 1]) {
    right++;
  }
  if (right > 0 && lowSurrogateRegex.test(a[a.length - right])) right--;
  return {
    index: left,
    remove: a.length - left - right,
    insert: b.slice(left, b.length - right)
  };
};
var simpleDiff = simpleDiffString;
var simpleDiffArray = (a, b, compare = equalityStrict) => {
  let left = 0;
  let right = 0;
  while (left < a.length && left < b.length && compare(a[left], b[left])) {
    left++;
  }
  while (right + left < a.length && right + left < b.length && compare(a[a.length - right - 1], b[b.length - right - 1])) {
    right++;
  }
  return {
    index: left,
    remove: a.length - left - right,
    insert: b.slice(left, b.length - right)
  };
};
var simpleDiffStringWithCursor = (a, b, cursor) => {
  let left = 0;
  let right = 0;
  while (left < a.length && left < b.length && a[left] === b[left] && left < cursor) {
    left++;
  }
  if (left > 0 && highSurrogateRegex.test(a[left - 1])) left--;
  while (right + left < a.length && right + left < b.length && a[a.length - right - 1] === b[b.length - right - 1]) {
    right++;
  }
  if (right > 0 && lowSurrogateRegex.test(a[a.length - right])) right--;
  while (right + left < a.length && right + left < b.length && a[left] === b[left]) {
    left++;
  }
  if (left > 0 && highSurrogateRegex.test(a[left - 1])) left--;
  return {
    index: left,
    remove: a.length - left - right,
    insert: b.slice(left, b.length - right)
  };
};

// node_modules/lib0/dom.js
var dom_exports = {};
__export(dom_exports, {
  $element: () => $element,
  $fragment: () => $fragment,
  $node: () => $node,
  $text: () => $text,
  CDATA_SECTION_NODE: () => CDATA_SECTION_NODE,
  COMMENT_NODE: () => COMMENT_NODE,
  DOCUMENT_FRAGMENT_NODE: () => DOCUMENT_FRAGMENT_NODE,
  DOCUMENT_NODE: () => DOCUMENT_NODE,
  DOCUMENT_TYPE_NODE: () => DOCUMENT_TYPE_NODE,
  ELEMENT_NODE: () => ELEMENT_NODE,
  TEXT_NODE: () => TEXT_NODE,
  addEventListener: () => addEventListener2,
  addEventListeners: () => addEventListeners,
  append: () => append,
  appendChild: () => appendChild,
  canvas: () => canvas,
  checkNodeType: () => checkNodeType,
  createDocumentFragment: () => createDocumentFragment,
  createElement: () => createElement,
  createTextNode: () => createTextNode,
  doc: () => doc,
  domParser: () => domParser,
  element: () => element,
  emitCustomEvent: () => emitCustomEvent,
  fragment: () => fragment,
  getElementById: () => getElementById,
  insertBefore: () => insertBefore,
  isParentOf: () => isParentOf,
  mapToStyleString: () => mapToStyleString,
  pairToStyleString: () => pairToStyleString,
  pairsToStyleString: () => pairsToStyleString,
  parseElement: () => parseElement,
  parseFragment: () => parseFragment,
  querySelector: () => querySelector,
  querySelectorAll: () => querySelectorAll,
  remove: () => remove,
  removeEventListener: () => removeEventListener2,
  removeEventListeners: () => removeEventListeners,
  replaceWith: () => replaceWith,
  setAttributes: () => setAttributes,
  setAttributesMap: () => setAttributesMap,
  text: () => text
});

// node_modules/lib0/pair.js
var pair_exports = {};
__export(pair_exports, {
  Pair: () => Pair,
  create: () => create6,
  createReversed: () => createReversed,
  forEach: () => forEach2,
  map: () => map4
});
var Pair = class {
  /**
   * @param {L} left
   * @param {R} right
   */
  constructor(left, right) {
    this.left = left;
    this.right = right;
  }
};
var create6 = (left, right) => new Pair(left, right);
var createReversed = (right, left) => new Pair(left, right);
var forEach2 = (arr, f) => arr.forEach((p) => f(p.left, p.right));
var map4 = (arr, f) => arr.map((p) => f(p.left, p.right));

// node_modules/lib0/prng.js
var prng_exports = {};
__export(prng_exports, {
  DefaultPRNG: () => DefaultPRNG,
  bool: () => bool,
  char: () => char,
  create: () => create7,
  int31: () => int31,
  int32: () => int32,
  int53: () => int53,
  letter: () => letter,
  oneOf: () => oneOf,
  real53: () => real53,
  uint16Array: () => uint16Array,
  uint32: () => uint32,
  uint32Array: () => uint32Array,
  uint53: () => uint53,
  uint8Array: () => uint8Array,
  utf16Rune: () => utf16Rune,
  utf16String: () => utf16String,
  word: () => word
});

// node_modules/lib0/prng/Xorshift32.js
var Xorshift32 = class {
  /**
   * @param {number} seed Unsigned 32 bit number
   */
  constructor(seed) {
    this.seed = seed;
    this._state = seed;
  }
  /**
   * Generate a random signed integer.
   *
   * @return {Number} A 32 bit signed integer.
   */
  next() {
    let x = this._state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this._state = x;
    return (x >>> 0) / (BITS32 + 1);
  }
};

// node_modules/lib0/prng/Xoroshiro128plus.js
var Xoroshiro128plus = class {
  /**
   * @param {number} seed Unsigned 32 bit number
   */
  constructor(seed) {
    this.seed = seed;
    const xorshift32 = new Xorshift32(seed);
    this.state = new Uint32Array(4);
    for (let i = 0; i < 4; i++) {
      this.state[i] = xorshift32.next() * BITS32;
    }
    this._fresh = true;
  }
  /**
   * @return {number} Float/Double in [0,1)
   */
  next() {
    const state = this.state;
    if (this._fresh) {
      this._fresh = false;
      return (state[0] + state[2] >>> 0) / (BITS32 + 1);
    } else {
      this._fresh = true;
      const s0 = state[0];
      const s1 = state[1];
      const s2 = state[2] ^ s0;
      const s3 = state[3] ^ s1;
      state[0] = (s1 << 23 | s0 >>> 9) ^ s2 ^ (s2 << 14 | s3 >>> 18);
      state[1] = (s0 << 23 | s1 >>> 9) ^ s3 ^ s3 << 14;
      state[2] = s3 << 4 | s2 >>> 28;
      state[3] = s2 << 4 | s3 >>> 28;
      return (state[1] + state[3] >>> 0) / (BITS32 + 1);
    }
  }
};

// node_modules/lib0/prng.js
var DefaultPRNG = Xoroshiro128plus;
var create7 = (seed) => new DefaultPRNG(seed);
var bool = (gen) => gen.next() >= 0.5;
var int53 = (gen, min2, max2) => floor(gen.next() * (max2 + 1 - min2) + min2);
var uint53 = (gen, min2, max2) => abs(int53(gen, min2, max2));
var int32 = (gen, min2, max2) => floor(gen.next() * (max2 + 1 - min2) + min2);
var uint32 = (gen, min2, max2) => int32(gen, min2, max2) >>> 0;
var int31 = (gen, min2, max2) => int32(gen, min2, max2);
var real53 = (gen) => gen.next();
var char = (gen) => fromCharCode(int31(gen, 32, 126));
var letter = (gen) => fromCharCode(int31(gen, 97, 122));
var word = (gen, minLen = 0, maxLen = 20) => {
  const len = int31(gen, minLen, maxLen);
  let str = "";
  for (let i = 0; i < len; i++) {
    str += letter(gen);
  }
  return str;
};
var utf16Rune = (gen) => {
  const codepoint = int31(gen, 0, 256);
  return fromCodePoint(codepoint);
};
var utf16String = (gen, maxlen = 20) => {
  const len = int31(gen, 0, maxlen);
  let str = "";
  for (let i = 0; i < len; i++) {
    str += utf16Rune(gen);
  }
  return str;
};
var oneOf = (gen, array) => array[int31(gen, 0, array.length - 1)];
var uint8Array = (gen, len) => {
  const buf = createUint8ArrayFromLen(len);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = int32(gen, 0, BITS8);
  }
  return buf;
};
var uint16Array = (gen, len) => new Uint16Array(uint8Array(gen, len * 2).buffer);
var uint32Array = (gen, len) => new Uint32Array(uint8Array(gen, len * 4).buffer);

// node_modules/lib0/schema.js
var schemaSymbol = Symbol("0schema");
var ValidationError = class {
  constructor() {
    this._rerrs = [];
  }
  /**
   * @param {string?} path
   * @param {string} expected
   * @param {string} has
   * @param {string?} message
   */
  extend(path, expected, has, message = null) {
    this._rerrs.push({ path, expected, has, message });
  }
  toString() {
    const s = [];
    for (let i = this._rerrs.length - 1; i > 0; i--) {
      const r = this._rerrs[i];
      s.push(repeat(" ", (this._rerrs.length - i) * 2) + `${r.path != null ? `[${r.path}] ` : ""}${r.has} doesn't match ${r.expected}. ${r.message}`);
    }
    return s.join("\n");
  }
};
var shapeExtends = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null || a.constructor !== b.constructor) return false;
  if (a[EqualityTraitSymbol]) return equals(a, b);
  if (isArray(a)) {
    return every(
      a,
      (aitem) => some(b, (bitem) => shapeExtends(aitem, bitem))
    );
  } else if (isObject(a)) {
    return every2(
      a,
      (aitem, akey) => shapeExtends(aitem, b[akey])
    );
  }
  return false;
};
var Schema = class {
  /**
   * @param {Schema<any>} other
   */
  extends(other) {
    let [a, b] = [
      /** @type {any} */
      this.shape,
      /** @type {any} */
      other.shape
    ];
    if (
      /** @type {typeof Schema<any>} */
      this.constructor._dilutes
    ) [b, a] = [a, b];
    return shapeExtends(a, b);
  }
  /**
   * Overwrite this when necessary. By default, we only check the `shape` property which every shape
   * should have.
   * @param {Schema<any>} other
   */
  equals(other) {
    return this.constructor === other.constructor && equalityDeep(this.shape, other.shape);
  }
  [schemaSymbol]() {
    return true;
  }
  /**
   * @param {object} other
   */
  [EqualityTraitSymbol](other) {
    return this.equals(
      /** @type {any} */
      other
    );
  }
  /**
   * Use `schema.validate(obj)` with a typed parameter that is already of typed to be an instance of
   * Schema. Validate will check the structure of the parameter and return true iff the instance
   * really is an instance of Schema.
   *
   * @param {T} o
   * @return {boolean}
   */
  validate(o) {
    return this.check(o);
  }
  /* c8 ignore start */
  /**
   * Similar to validate, but this method accepts untyped parameters.
   *
   * @param {any} _o
   * @param {ValidationError} [_err]
   * @return {_o is T}
   */
  check(_o, _err) {
    methodUnimplemented();
  }
  /* c8 ignore stop */
  /**
   * @type {Schema<T?>}
   */
  get nullable() {
    return $union(this, $null);
  }
  /**
   * @type {$Optional<Schema<T>>}
   */
  get optional() {
    return new $Optional(
      /** @type {Schema<T>} */
      this
    );
  }
  /**
   * Cast a variable to a specific type. Returns the casted value, or throws an exception otherwise.
   * Use this if you know that the type is of a specific type and you just want to convince the type
   * system.
   *
   * **Do not rely on these error messages!**
   * Performs an assertion check only if not in a production environment.
   *
   * @template OO
   * @param {OO} o
   * @return {Extract<OO, T> extends never ? T : (OO extends Array<never> ? T : Extract<OO,T>)}
   */
  cast(o) {
    assert2(o, this);
    return (
      /** @type {any} */
      o
    );
  }
  /**
   * EXPECTO PATRONUM!! 🪄
   * This function protects against type errors. Though it may not work in the real world.
   *
   * "After all this time?"
   * "Always." - Snape, talking about type safety
   *
   * Ensures that a variable is a a specific type. Returns the value, or throws an exception if the assertion check failed.
   * Use this if you know that the type is of a specific type and you just want to convince the type
   * system.
   *
   * Can be useful when defining lambdas: `s.lambda(s.$number, s.$void).expect((n) => n + 1)`
   *
   * **Do not rely on these error messages!**
   * Performs an assertion check if not in a production environment.
   *
   * @param {T} o
   * @return {o extends T ? T : never}
   */
  expect(o) {
    assert2(o, this);
    return o;
  }
};
// this.shape must not be defined on Schema. Otherwise typecheck on metatypes (e.g. $$object) won't work as expected anymore
/**
 * If true, the more things are added to the shape the more objects this schema will accept (e.g.
 * union). By default, the more objects are added, the the fewer objects this schema will accept.
 * @protected
 */
__publicField(Schema, "_dilutes", false);
var $ConstructedBy = class extends Schema {
  /**
   * @param {C} c
   * @param {((o:Instance<C>)=>boolean)|null} check
   */
  constructor(c, check) {
    super();
    this.shape = c;
    this._c = check;
  }
  /**
   * @param {any} o
   * @param {ValidationError} [err]
   * @return {o is C extends ((...args:any[]) => infer T) ? T : (C extends (new (...args:any[]) => any) ? InstanceType<C> : never)} o
   */
  check(o, err = void 0) {
    const c = o?.constructor === this.shape && (this._c == null || this._c(o));
    !c && err?.extend(null, this.shape.name, o?.constructor.name, o?.constructor !== this.shape ? "Constructor match failed" : "Check failed");
    return c;
  }
};
var $constructedBy = (c, check = null) => new $ConstructedBy(c, check);
var $$constructedBy = $constructedBy($ConstructedBy);
var $Custom = class extends Schema {
  /**
   * @param {(o:any) => boolean} check
   */
  constructor(check) {
    super();
    this.shape = check;
  }
  /**
   * @param {any} o
   * @param {ValidationError} err
   * @return {o is any}
   */
  check(o, err) {
    const c = this.shape(o);
    !c && err?.extend(null, "custom prop", o?.constructor.name, "failed to check custom prop");
    return c;
  }
};
var $custom = (check) => new $Custom(check);
var $$custom = $constructedBy($Custom);
var $Literal = class extends Schema {
  /**
   * @param {Array<T>} literals
   */
  constructor(literals) {
    super();
    this.shape = literals;
  }
  /**
   *
   * @param {any} o
   * @param {ValidationError} [err]
   * @return {o is T}
   */
  check(o, err) {
    const c = this.shape.some((a) => a === o);
    !c && err?.extend(null, this.shape.join(" | "), o.toString());
    return c;
  }
};
var $literal = (...literals) => new $Literal(literals);
var $$literal = $constructedBy($Literal);
var _regexEscape = (
  /** @type {any} */
  RegExp.escape || /** @type {(str:string) => string} */
  ((str) => str.replace(/[().|&,$^[\]]/g, (s) => "\\" + s))
);
var _schemaStringTemplateToRegex = (s) => {
  if ($string.check(s)) {
    return [_regexEscape(s)];
  }
  if ($$literal.check(s)) {
    return (
      /** @type {Array<string|number>} */
      s.shape.map((v) => v + "")
    );
  }
  if ($$number.check(s)) {
    return ["[+-]?\\d+.?\\d*"];
  }
  if ($$string.check(s)) {
    return [".*"];
  }
  if ($$union.check(s)) {
    return s.shape.map(_schemaStringTemplateToRegex).flat(1);
  }
  unexpectedCase();
};
var $StringTemplate = class extends Schema {
  /**
   * @param {T} shape
   */
  constructor(shape) {
    super();
    this.shape = shape;
    this._r = new RegExp("^" + shape.map(_schemaStringTemplateToRegex).map((opts) => `(${opts.join("|")})`).join("") + "$");
  }
  /**
   * @param {any} o
   * @param {ValidationError} [err]
   * @return {o is CastStringTemplateArgsToTemplate<T>}
   */
  check(o, err) {
    const c = this._r.exec(o) != null;
    !c && err?.extend(null, this._r.toString(), o.toString(), "String doesn't match string template.");
    return c;
  }
};
var $$stringTemplate = $constructedBy($StringTemplate);
var isOptionalSymbol = Symbol("optional");
var $Optional = class extends Schema {
  /**
   * @param {S} shape
   */
  constructor(shape) {
    super();
    this.shape = shape;
  }
  /**
   * @param {any} o
   * @param {ValidationError} [err]
   * @return {o is (Unwrap<S>|undefined)}
   */
  check(o, err) {
    const c = o === void 0 || this.shape.check(o);
    !c && err?.extend(null, "undefined (optional)", "()");
    return c;
  }
  get [isOptionalSymbol]() {
    return true;
  }
};
var $$optional = $constructedBy($Optional);
var $Never = class extends Schema {
  /**
   * @param {any} _o
   * @param {ValidationError} [err]
   * @return {_o is never}
   */
  check(_o, err) {
    err?.extend(null, "never", typeof _o);
    return false;
  }
};
var $never = new $Never();
var $$never = $constructedBy($Never);
var _$Object = class _$Object extends Schema {
  /**
   * @param {S} shape
   * @param {boolean} partial
   */
  constructor(shape, partial = false) {
    super();
    this.shape = shape;
    this._isPartial = partial;
  }
  /**
   * @type {Schema<Partial<$ObjectToType<S>>>}
   */
  get partial() {
    return new _$Object(this.shape, true);
  }
  /**
   * @param {any} o
   * @param {ValidationError} err
   * @return {o is $ObjectToType<S>}
   */
  check(o, err) {
    if (o == null) {
      err?.extend(null, "object", "null");
      return false;
    }
    return every2(this.shape, (vv, vk) => {
      const c = this._isPartial && !hasProperty(o, vk) || vv.check(o[vk], err);
      !c && err?.extend(vk.toString(), vv.toString(), typeof o[vk], "Object property does not match");
      return c;
    });
  }
};
__publicField(_$Object, "_dilutes", true);
var $Object = _$Object;
var $object = (def) => (
  /** @type {any} */
  new $Object(def)
);
var $$object = $constructedBy($Object);
var $objectAny = $custom((o) => o != null && (o.constructor === Object || o.constructor == null));
var $Record = class extends Schema {
  /**
   * @param {Keys} keys
   * @param {Values} values
   */
  constructor(keys2, values2) {
    super();
    this.shape = {
      keys: keys2,
      values: values2
    };
  }
  /**
   * @param {any} o
   * @param {ValidationError} err
   * @return {o is { [key in Unwrap<Keys>]: Unwrap<Values> }}
   */
  check(o, err) {
    return o != null && every2(o, (vv, vk) => {
      const ck = this.shape.keys.check(vk, err);
      !ck && err?.extend(vk + "", "Record", typeof o, ck ? "Key doesn't match schema" : "Value doesn't match value");
      return ck && this.shape.values.check(vv, err);
    });
  }
};
var $record = (keys2, values2) => new $Record(keys2, values2);
var $$record = $constructedBy($Record);
var $Tuple = class extends Schema {
  /**
   * @param {S} shape
   */
  constructor(shape) {
    super();
    this.shape = shape;
  }
  /**
   * @param {any} o
   * @param {ValidationError} err
   * @return {o is { [K in keyof S]: S[K] extends Schema<infer Type> ? Type : never }}
   */
  check(o, err) {
    return o != null && every2(this.shape, (vv, vk) => {
      const c = (
        /** @type {Schema<any>} */
        vv.check(o[vk], err)
      );
      !c && err?.extend(vk.toString(), "Tuple", typeof vv);
      return c;
    });
  }
};
var $tuple = (...def) => new $Tuple(def);
var $$tuple = $constructedBy($Tuple);
var $Array = class extends Schema {
  /**
   * @param {Array<S>} v
   */
  constructor(v) {
    super();
    this.shape = v.length === 1 ? v[0] : new $Union(v);
  }
  /**
   * @param {any} o
   * @param {ValidationError} [err]
   * @return {o is Array<S extends Schema<infer T> ? T : never>} o
   */
  check(o, err) {
    const c = isArray(o) && every(o, (oi) => this.shape.check(oi));
    !c && err?.extend(null, "Array", "");
    return c;
  }
};
var $array = (...def) => new $Array(def);
var $$array = $constructedBy($Array);
var $arrayAny = $custom((o) => isArray(o));
var $InstanceOf = class extends Schema {
  /**
   * @param {new (...args:any) => T} constructor
   * @param {((o:T) => boolean)|null} check
   */
  constructor(constructor, check) {
    super();
    this.shape = constructor;
    this._c = check;
  }
  /**
   * @param {any} o
   * @param {ValidationError} err
   * @return {o is T}
   */
  check(o, err) {
    const c = o instanceof this.shape && (this._c == null || this._c(o));
    !c && err?.extend(null, this.shape.name, o?.constructor.name);
    return c;
  }
};
var $instanceOf = (c, check = null) => new $InstanceOf(c, check);
var $$instanceOf = $constructedBy($InstanceOf);
var $$schema = $instanceOf(Schema);
var $Lambda = class extends Schema {
  /**
   * @param {Args} args
   */
  constructor(args2) {
    super();
    this.len = args2.length - 1;
    this.args = $tuple(...args2.slice(-1));
    this.res = args2[this.len];
  }
  /**
   * @param {any} f
   * @param {ValidationError} err
   * @return {f is _LArgsToLambdaDef<Args>}
   */
  check(f, err) {
    const c = f.constructor === Function && f.length <= this.len;
    !c && err?.extend(null, "function", typeof f);
    return c;
  }
};
var $$lambda = $constructedBy($Lambda);
var $function = $custom((o) => typeof o === "function");
var $Intersection = class extends Schema {
  /**
   * @param {T} v
   */
  constructor(v) {
    super();
    this.shape = v;
  }
  /**
   * @param {any} o
   * @param {ValidationError} [err]
   * @return {o is Intersect<UnwrapArray<T>>}
   */
  check(o, err) {
    const c = every(this.shape, (check) => check.check(o, err));
    !c && err?.extend(null, "Intersectinon", typeof o);
    return c;
  }
};
var $$intersect = $constructedBy($Intersection, (o) => o.shape.length > 0);
var $Union = class extends Schema {
  /**
   * @param {Array<Schema<S>>} v
   */
  constructor(v) {
    super();
    this.shape = v;
  }
  /**
   * @param {any} o
   * @param {ValidationError} [err]
   * @return {o is S}
   */
  check(o, err) {
    const c = some(this.shape, (vv) => vv.check(o, err));
    err?.extend(null, "Union", typeof o);
    return c;
  }
};
__publicField($Union, "_dilutes", true);
var $union = (...schemas) => schemas.findIndex(($s) => $$union.check($s)) >= 0 ? $union(...schemas.map(($s) => $($s)).map(($s) => $$union.check($s) ? $s.shape : [$s]).flat(1)) : schemas.length === 1 ? schemas[0] : new $Union(schemas);
var $$union = (
  /** @type {Schema<$Union<any>>} */
  $constructedBy($Union)
);
var _t = () => true;
var $any = $custom(_t);
var $$any = (
  /** @type {Schema<Schema<any>>} */
  $constructedBy($Custom, (o) => o.shape === _t)
);
var $bigint = $custom((o) => typeof o === "bigint");
var $$bigint = (
  /** @type {Schema<Schema<BigInt>>} */
  $custom((o) => o === $bigint)
);
var $symbol = $custom((o) => typeof o === "symbol");
var $$symbol = (
  /** @type {Schema<Schema<Symbol>>} */
  $custom((o) => o === $symbol)
);
var $number = $custom((o) => typeof o === "number");
var $$number = (
  /** @type {Schema<Schema<number>>} */
  $custom((o) => o === $number)
);
var $string = $custom((o) => typeof o === "string");
var $$string = (
  /** @type {Schema<Schema<string>>} */
  $custom((o) => o === $string)
);
var $boolean = $custom((o) => typeof o === "boolean");
var $$boolean = (
  /** @type {Schema<Schema<Boolean>>} */
  $custom((o) => o === $boolean)
);
var $undefined = $literal(void 0);
var $$undefined = (
  /** @type {Schema<Schema<undefined>>} */
  $constructedBy($Literal, (o) => o.shape.length === 1 && o.shape[0] === void 0)
);
var $void = $literal(void 0);
var $null = $literal(null);
var $$null = (
  /** @type {Schema<Schema<null>>} */
  $constructedBy($Literal, (o) => o.shape.length === 1 && o.shape[0] === null)
);
var $uint8Array = $constructedBy(Uint8Array);
var $$uint8Array = (
  /** @type {Schema<Schema<Uint8Array>>} */
  $constructedBy($ConstructedBy, (o) => o.shape === Uint8Array)
);
var $primitive = $union($number, $string, $null, $undefined, $bigint, $boolean, $symbol);
var $json = (() => {
  const $jsonArr = (
    /** @type {$Array<$any>} */
    $array($any)
  );
  const $jsonRecord = (
    /** @type {$Record<$string,$any>} */
    $record($string, $any)
  );
  const $json2 = $union($number, $string, $null, $boolean, $jsonArr, $jsonRecord);
  $jsonArr.shape = $json2;
  $jsonRecord.shape.values = $json2;
  return $json2;
})();
var $ = (o) => {
  if ($$schema.check(o)) {
    return (
      /** @type {any} */
      o
    );
  } else if ($objectAny.check(o)) {
    const o2 = {};
    for (const k in o) {
      o2[k] = $(o[k]);
    }
    return (
      /** @type {any} */
      $object(o2)
    );
  } else if ($arrayAny.check(o)) {
    return (
      /** @type {any} */
      $union(...o.map($))
    );
  } else if ($primitive.check(o)) {
    return (
      /** @type {any} */
      $literal(o)
    );
  } else if ($function.check(o)) {
    return (
      /** @type {any} */
      $constructedBy(
        /** @type {any} */
        o
      )
    );
  }
  unexpectedCase();
};
var assert2 = production ? () => {
} : (o, schema) => {
  const err = new ValidationError();
  if (!schema.check(o, err)) {
    throw create5(`Expected value to be of type ${schema.constructor.name}.
${err.toString()}`);
  }
};
var PatternMatcher = class {
  /**
   * @param {Schema<State>} [$state]
   */
  constructor($state) {
    this.patterns = [];
    this.$state = $state;
  }
  /**
   * @template P
   * @template R
   * @param {P} pattern
   * @param {(o:NoInfer<Unwrap<ReadSchema<P>>>,s:State)=>R} handler
   * @return {PatternMatcher<State,Patterns|Pattern<Unwrap<ReadSchema<P>>,R>>}
   */
  if(pattern, handler) {
    this.patterns.push({ if: $(pattern), h: handler });
    return this;
  }
  /**
   * @template R
   * @param {(o:any,s:State)=>R} h
   */
  else(h) {
    return this.if($any, h);
  }
  /**
   * @return {State extends undefined
   *   ? <In extends Unwrap<Patterns['if']>>(o:In,state?:undefined)=>PatternMatchResult<Patterns,In>
   *   : <In extends Unwrap<Patterns['if']>>(o:In,state:State)=>PatternMatchResult<Patterns,In>}
   */
  done() {
    return (
      /** @type {any} */
      (o, s) => {
        for (let i = 0; i < this.patterns.length; i++) {
          const p = this.patterns[i];
          if (p.if.check(o)) {
            return p.h(o, s);
          }
        }
        throw create5("Unhandled pattern");
      }
    );
  }
};
var match = (state) => new PatternMatcher(
  /** @type {any} */
  state
);
var _random = (
  /** @type {any} */
  match(
    /** @type {Schema<prng.PRNG>} */
    $any
  ).if($$number, (_o, gen) => int53(gen, MIN_SAFE_INTEGER, MAX_SAFE_INTEGER)).if($$string, (_o, gen) => word(gen)).if($$boolean, (_o, gen) => bool(gen)).if($$bigint, (_o, gen) => BigInt(int53(gen, MIN_SAFE_INTEGER, MAX_SAFE_INTEGER))).if($$union, (o, gen) => random(gen, oneOf(gen, o.shape))).if($$object, (o, gen) => {
    const res = {};
    for (const k in o.shape) {
      let prop = o.shape[k];
      if ($$optional.check(prop)) {
        if (bool(gen)) {
          continue;
        }
        prop = prop.shape;
      }
      res[k] = _random(prop, gen);
    }
    return res;
  }).if($$array, (o, gen) => {
    const arr = [];
    const n = int32(gen, 0, 42);
    for (let i = 0; i < n; i++) {
      arr.push(random(gen, o.shape));
    }
    return arr;
  }).if($$literal, (o, gen) => {
    return oneOf(gen, o.shape);
  }).if($$null, (o, gen) => {
    return null;
  }).if($$lambda, (o, gen) => {
    const res = random(gen, o.res);
    return () => res;
  }).if($$any, (o, gen) => random(gen, oneOf(gen, [
    $number,
    $string,
    $null,
    $undefined,
    $bigint,
    $boolean,
    $array($number),
    $record($union("a", "b", "c"), $number)
  ]))).if($$record, (o, gen) => {
    const res = {};
    const keysN = int53(gen, 0, 3);
    for (let i = 0; i < keysN; i++) {
      const key = random(gen, o.shape.keys);
      const val = random(gen, o.shape.values);
      res[key] = val;
    }
    return res;
  }).done()
);
var random = (gen, schema) => (
  /** @type {any} */
  _random($(schema), gen)
);

// node_modules/lib0/dom.js
var doc = (
  /** @type {Document} */
  typeof document !== "undefined" ? document : {}
);
var createElement = (name) => doc.createElement(name);
var createDocumentFragment = () => doc.createDocumentFragment();
var $fragment = $custom((el) => el.nodeType === DOCUMENT_FRAGMENT_NODE);
var createTextNode = (text2) => doc.createTextNode(text2);
var domParser = (
  /** @type {DOMParser} */
  typeof DOMParser !== "undefined" ? new DOMParser() : null
);
var emitCustomEvent = (el, name, opts) => el.dispatchEvent(new CustomEvent(name, opts));
var setAttributes = (el, attrs) => {
  forEach2(attrs, (key, value) => {
    if (value === false) {
      el.removeAttribute(key);
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, value);
    }
  });
  return el;
};
var setAttributesMap = (el, attrs) => {
  attrs.forEach((value, key) => {
    el.setAttribute(key, value);
  });
  return el;
};
var fragment = (children) => {
  const fragment2 = createDocumentFragment();
  for (let i = 0; i < children.length; i++) {
    appendChild(fragment2, children[i]);
  }
  return fragment2;
};
var append = (parent, nodes) => {
  appendChild(parent, fragment(nodes));
  return parent;
};
var remove = (el) => el.remove();
var addEventListener2 = (el, name, f) => el.addEventListener(name, f);
var removeEventListener2 = (el, name, f) => el.removeEventListener(name, f);
var addEventListeners = (node, listeners) => {
  forEach2(listeners, (name, f) => addEventListener2(node, name, f));
  return node;
};
var removeEventListeners = (node, listeners) => {
  forEach2(listeners, (name, f) => removeEventListener2(node, name, f));
  return node;
};
var element = (name, attrs = [], children = []) => append(setAttributes(createElement(name), attrs), children);
var $element = $custom((el) => el.nodeType === ELEMENT_NODE);
var canvas = (width, height) => {
  const c = (
    /** @type {HTMLCanvasElement} */
    createElement("canvas")
  );
  c.height = height;
  c.width = width;
  return c;
};
var text = createTextNode;
var $text = $custom((el) => el.nodeType === TEXT_NODE);
var pairToStyleString = (pair) => `${pair.left}:${pair.right};`;
var pairsToStyleString = (pairs) => pairs.map(pairToStyleString).join("");
var mapToStyleString = (m) => map2(m, (value, key) => `${key}:${value};`).join("");
var querySelector = (el, query) => el.querySelector(query);
var querySelectorAll = (el, query) => el.querySelectorAll(query);
var getElementById = (id2) => (
  /** @type {HTMLElement} */
  doc.getElementById(id2)
);
var _parse = (html) => domParser.parseFromString(`<html><body>${html}</body></html>`, "text/html").body;
var parseFragment = (html) => fragment(
  /** @type {any} */
  _parse(html).childNodes
);
var parseElement = (html) => (
  /** @type HTMLElement */
  _parse(html).firstElementChild
);
var replaceWith = (oldEl, newEl) => oldEl.replaceWith(newEl);
var insertBefore = (parent, el, ref) => parent.insertBefore(el, ref);
var appendChild = (parent, child) => parent.appendChild(child);
var ELEMENT_NODE = doc.ELEMENT_NODE;
var TEXT_NODE = doc.TEXT_NODE;
var CDATA_SECTION_NODE = doc.CDATA_SECTION_NODE;
var COMMENT_NODE = doc.COMMENT_NODE;
var DOCUMENT_NODE = doc.DOCUMENT_NODE;
var DOCUMENT_TYPE_NODE = doc.DOCUMENT_TYPE_NODE;
var DOCUMENT_FRAGMENT_NODE = doc.DOCUMENT_FRAGMENT_NODE;
var $node = $custom((el) => el.nodeType === DOCUMENT_NODE);
var checkNodeType = (node, type) => node.nodeType === type;
var isParentOf = (parent, child) => {
  let p = child.parentNode;
  while (p && p !== parent) {
    p = p.parentNode;
  }
  return p === parent;
};

// node_modules/lib0/eventloop.js
var eventloop_exports = {};
__export(eventloop_exports, {
  Animation: () => Animation,
  animationFrame: () => animationFrame,
  createDebouncer: () => createDebouncer,
  enqueue: () => enqueue,
  idleCallback: () => idleCallback,
  interval: () => interval,
  timeout: () => timeout
});

// node_modules/lib0/time.js
var time_exports = {};
__export(time_exports, {
  getDate: () => getDate,
  getUnixTime: () => getUnixTime,
  humanizeDuration: () => humanizeDuration
});

// node_modules/lib0/metric.js
var prefixUp = ["", "k", "M", "G", "T", "P", "E", "Z", "Y"];
var prefixDown = ["", "m", "\u03BC", "n", "p", "f", "a", "z", "y"];
var prefix = (n, baseMultiplier = 0) => {
  const nPow = n === 0 ? 0 : log10(n);
  let mult = 0;
  while (nPow < mult * 3 && baseMultiplier > -8) {
    baseMultiplier--;
    mult--;
  }
  while (nPow >= 3 + mult * 3 && baseMultiplier < 8) {
    baseMultiplier++;
    mult++;
  }
  const prefix2 = baseMultiplier < 0 ? prefixDown[-baseMultiplier] : prefixUp[baseMultiplier];
  return {
    n: round((mult > 0 ? n / exp10(mult * 3) : n * exp10(mult * -3)) * 1e12) / 1e12,
    prefix: prefix2
  };
};

// node_modules/lib0/time.js
var getDate = () => /* @__PURE__ */ new Date();
var getUnixTime = Date.now;
var humanizeDuration = (d) => {
  if (d < 6e4) {
    const p = prefix(d, -1);
    return round(p.n * 100) / 100 + p.prefix + "s";
  }
  d = floor(d / 1e3);
  const seconds = d % 60;
  const minutes = floor(d / 60) % 60;
  const hours = floor(d / 3600) % 24;
  const days = floor(d / 86400);
  if (days > 0) {
    return days + "d" + (hours > 0 || minutes > 30 ? " " + (minutes > 30 ? hours + 1 : hours) + "h" : "");
  }
  if (hours > 0) {
    return hours + "h" + (minutes > 0 || seconds > 30 ? " " + (seconds > 30 ? minutes + 1 : minutes) + "min" : "");
  }
  return minutes + "min" + (seconds > 0 ? " " + seconds + "s" : "");
};

// node_modules/lib0/eventloop.js
var queue = [];
var _runQueue = () => {
  for (let i = 0; i < queue.length; i++) {
    queue[i]();
  }
  queue = [];
};
var enqueue = (f) => {
  queue.push(f);
  if (queue.length === 1) {
    setTimeout(_runQueue, 0);
  }
};
var createTimeoutClass = (clearFunction) => class TT {
  /**
   * @param {number} timeoutId
   */
  constructor(timeoutId) {
    this._ = timeoutId;
  }
  destroy() {
    clearFunction(this._);
  }
};
var Timeout = createTimeoutClass(clearTimeout);
var timeout = (timeout2, callback) => new Timeout(setTimeout(callback, timeout2));
var Interval = createTimeoutClass(clearInterval);
var interval = (timeout2, callback) => new Interval(setInterval(callback, timeout2));
var Animation = createTimeoutClass((arg) => typeof requestAnimationFrame !== "undefined" && cancelAnimationFrame(arg));
var animationFrame = (cb) => typeof requestAnimationFrame === "undefined" ? timeout(0, cb) : new Animation(requestAnimationFrame(cb));
var Idle = createTimeoutClass((arg) => typeof cancelIdleCallback !== "undefined" && cancelIdleCallback(arg));
var idleCallback = (cb) => typeof requestIdleCallback !== "undefined" ? new Idle(requestIdleCallback(cb)) : timeout(1e3, cb);
var createDebouncer = (timeout2, triggerAfter = -1) => {
  let timer = -1;
  let lastCall = null;
  return (cb) => {
    clearTimeout(timer);
    if (cb) {
      if (triggerAfter >= 0) {
        const now = getUnixTime();
        if (lastCall === null) lastCall = now;
        if (now - lastCall > triggerAfter) {
          lastCall = null;
          timer = /** @type {any} */
          setTimeout(cb, 0);
          return;
        }
      }
      timer = /** @type {any} */
      setTimeout(() => {
        lastCall = null;
        cb();
      }, timeout2);
    } else {
      lastCall = null;
    }
  };
};

// node_modules/lib0/indexeddb.js
var indexeddb_exports = {};
__export(indexeddb_exports, {
  add: () => add2,
  addAutoKey: () => addAutoKey,
  count: () => count,
  createIDBKeyRangeBound: () => createIDBKeyRangeBound,
  createIDBKeyRangeLowerBound: () => createIDBKeyRangeLowerBound,
  createIDBKeyRangeUpperBound: () => createIDBKeyRangeUpperBound,
  createStores: () => createStores,
  del: () => del,
  deleteDB: () => deleteDB,
  get: () => get,
  getAll: () => getAll,
  getAllKeys: () => getAllKeys,
  getAllKeysValues: () => getAllKeysValues,
  getFirstKey: () => getFirstKey,
  getLastKey: () => getLastKey,
  getStore: () => getStore,
  iterate: () => iterate,
  iterateKeys: () => iterateKeys,
  openDB: () => openDB,
  put: () => put,
  queryFirst: () => queryFirst,
  rtop: () => rtop,
  transact: () => transact
});

// node_modules/lib0/promise.js
var promise_exports = {};
__export(promise_exports, {
  all: () => all2,
  create: () => create8,
  createEmpty: () => createEmpty,
  isPromise: () => isPromise,
  reject: () => reject,
  resolve: () => resolve,
  resolveWith: () => resolveWith,
  until: () => until,
  untilAsync: () => untilAsync,
  wait: () => wait
});
var create8 = (f) => (
  /** @type {Promise<T>} */
  new Promise(f)
);
var createEmpty = (f) => new Promise(f);
var all2 = Promise.all.bind(Promise);
var reject = (reason) => Promise.reject(reason);
var resolve = (res) => Promise.resolve(res);
var resolveWith = (res) => Promise.resolve(res);
var until = (timeout2, check, intervalResolution = 10) => create8((resolve2, reject2) => {
  const startTime = getUnixTime();
  const hasTimeout = timeout2 > 0;
  const untilInterval = () => {
    if (check()) {
      clearInterval(intervalHandle);
      resolve2();
    } else if (hasTimeout) {
      if (getUnixTime() - startTime > timeout2) {
        clearInterval(intervalHandle);
        reject2(new Error("Timeout"));
      }
    }
  };
  const intervalHandle = setInterval(untilInterval, intervalResolution);
});
var untilAsync = async (check, timeout2 = 0, intervalResolution = 10) => {
  const startTime = getUnixTime();
  const noTimeout = timeout2 <= 0;
  while (noTimeout || getUnixTime() - startTime <= timeout2) {
    if (await check()) return;
    await wait(intervalResolution);
  }
  throw new Error("Timeout");
};
var wait = (timeout2) => create8((resolve2, _reject) => setTimeout(resolve2, timeout2));
var isPromise = (p) => p instanceof Promise || p && p.then && p.catch && p.finally;

// node_modules/lib0/indexeddb.js
var rtop = (request) => create8((resolve2, reject2) => {
  request.onerror = (event) => reject2(new Error(event.target.error));
  request.onsuccess = (event) => resolve2(event.target.result);
});
var openDB = (name, initDB) => create8((resolve2, reject2) => {
  const request = indexedDB.open(name);
  request.onupgradeneeded = (event) => initDB(event.target.result);
  request.onerror = (event) => reject2(create5(event.target.error));
  request.onsuccess = (event) => {
    const db = event.target.result;
    db.onversionchange = () => {
      db.close();
    };
    resolve2(db);
  };
});
var deleteDB = (name) => rtop(indexedDB.deleteDatabase(name));
var createStores = (db, definitions) => definitions.forEach(
  (d) => (
    // @ts-ignore
    db.createObjectStore.apply(db, d)
  )
);
var transact = (db, stores, access = "readwrite") => {
  const transaction = db.transaction(stores, access);
  return stores.map((store) => getStore(transaction, store));
};
var count = (store, range) => rtop(store.count(range));
var get = (store, key) => rtop(store.get(key));
var del = (store, key) => rtop(store.delete(key));
var put = (store, item, key) => rtop(store.put(item, key));
var add2 = (store, item, key) => rtop(store.add(item, key));
var addAutoKey = (store, item) => rtop(store.add(item));
var getAll = (store, range, limit) => rtop(store.getAll(range, limit));
var getAllKeys = (store, range, limit) => rtop(store.getAllKeys(range, limit));
var queryFirst = (store, query, direction) => {
  let first2 = null;
  return iterateKeys(store, query, (key) => {
    first2 = key;
    return false;
  }, direction).then(() => first2);
};
var getLastKey = (store, range = null) => queryFirst(store, range, "prev");
var getFirstKey = (store, range = null) => queryFirst(store, range, "next");
var getAllKeysValues = (store, range, limit) => (
  // @ts-ignore
  all2([getAllKeys(store, range, limit), getAll(store, range, limit)]).then(([ks, vs]) => ks.map((k, i) => ({ k, v: vs[i] })))
);
var iterateOnRequest = (request, f) => create8((resolve2, reject2) => {
  request.onerror = reject2;
  request.onsuccess = async (event) => {
    const cursor = event.target.result;
    if (cursor === null || await f(cursor) === false) {
      return resolve2();
    }
    cursor.continue();
  };
});
var iterate = (store, keyrange, f, direction = "next") => iterateOnRequest(store.openCursor(keyrange, direction), (cursor) => f(cursor.value, cursor.key));
var iterateKeys = (store, keyrange, f, direction = "next") => iterateOnRequest(store.openKeyCursor(keyrange, direction), (cursor) => f(cursor.key));
var getStore = (t, store) => t.objectStore(store);
var createIDBKeyRangeBound = (lower, upper, lowerOpen, upperOpen) => IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen);
var createIDBKeyRangeUpperBound = (upper, upperOpen) => IDBKeyRange.upperBound(upper, upperOpen);
var createIDBKeyRangeLowerBound = (lower, lowerOpen) => IDBKeyRange.lowerBound(lower, lowerOpen);

// node_modules/lib0/iterator.js
var iterator_exports = {};
__export(iterator_exports, {
  createIterator: () => createIterator,
  iteratorFilter: () => iteratorFilter,
  iteratorMap: () => iteratorMap,
  mapIterator: () => mapIterator
});
var mapIterator = (iterator, f) => ({
  [Symbol.iterator]() {
    return this;
  },
  // @ts-ignore
  next() {
    const r = iterator.next();
    return { value: r.done ? void 0 : f(r.value), done: r.done };
  }
});
var createIterator = (next) => ({
  /**
   * @return {IterableIterator<T>}
   */
  [Symbol.iterator]() {
    return this;
  },
  // @ts-ignore
  next
});
var iteratorFilter = (iterator, filter) => createIterator(() => {
  let res;
  do {
    res = iterator.next();
  } while (!res.done && !filter(res.value));
  return res;
});
var iteratorMap = (iterator, fmap) => createIterator(() => {
  const { done, value } = iterator.next();
  return { done, value: done ? void 0 : fmap(value) };
});

// node_modules/lib0/json.js
var json_exports = {};
__export(json_exports, {
  parse: () => parse,
  stringify: () => stringify
});
var stringify = JSON.stringify;
var parse = JSON.parse;

// node_modules/lib0/logging.js
var logging_exports = {};
__export(logging_exports, {
  BLUE: () => BLUE,
  BOLD: () => BOLD,
  GREEN: () => GREEN,
  GREY: () => GREY,
  ORANGE: () => ORANGE,
  PURPLE: () => PURPLE,
  RED: () => RED,
  UNBOLD: () => UNBOLD,
  UNCOLOR: () => UNCOLOR,
  VConsole: () => VConsole,
  createModuleLogger: () => createModuleLogger2,
  createVConsole: () => createVConsole,
  group: () => group,
  groupCollapsed: () => groupCollapsed,
  groupEnd: () => groupEnd,
  print: () => print,
  printCanvas: () => printCanvas,
  printDom: () => printDom,
  printError: () => printError,
  printImg: () => printImg,
  printImgBase64: () => printImgBase64,
  vconsoles: () => vconsoles,
  warn: () => warn
});

// node_modules/lib0/symbol.js
var symbol_exports = {};
__export(symbol_exports, {
  create: () => create9,
  isSymbol: () => isSymbol
});
var create9 = Symbol;
var isSymbol = (s) => typeof s === "symbol";

// node_modules/lib0/logging.common.js
var BOLD = create9();
var UNBOLD = create9();
var BLUE = create9();
var GREY = create9();
var GREEN = create9();
var RED = create9();
var PURPLE = create9();
var ORANGE = create9();
var UNCOLOR = create9();
var computeNoColorLoggingArgs = (args2) => {
  if (args2.length === 1 && args2[0]?.constructor === Function) {
    args2 = /** @type {Array<string|Symbol|Object|number>} */
    /** @type {[function]} */
    args2[0]();
  }
  const strBuilder = [];
  const logArgs = [];
  let i = 0;
  for (; i < args2.length; i++) {
    const arg = args2[i];
    if (arg === void 0) {
      break;
    } else if (arg.constructor === String || arg.constructor === Number) {
      strBuilder.push(arg);
    } else if (arg.constructor === Object) {
      break;
    }
  }
  if (i > 0) {
    logArgs.push(strBuilder.join(""));
  }
  for (; i < args2.length; i++) {
    const arg = args2[i];
    if (!(arg instanceof Symbol)) {
      logArgs.push(arg);
    }
  }
  return logArgs;
};
var loggingColors = [GREEN, PURPLE, ORANGE, BLUE];
var nextColor = 0;
var lastLoggingTime = getUnixTime();
var createModuleLogger = (_print, moduleName) => {
  const color = loggingColors[nextColor];
  const debugRegexVar = getVariable("log");
  const doLogging = debugRegexVar !== null && (debugRegexVar === "*" || debugRegexVar === "true" || new RegExp(debugRegexVar, "gi").test(moduleName));
  nextColor = (nextColor + 1) % loggingColors.length;
  moduleName += ": ";
  return !doLogging ? nop : (...args2) => {
    if (args2.length === 1 && args2[0]?.constructor === Function) {
      args2 = args2[0]();
    }
    const timeNow = getUnixTime();
    const timeDiff = timeNow - lastLoggingTime;
    lastLoggingTime = timeNow;
    _print(
      color,
      moduleName,
      UNCOLOR,
      ...args2.map((arg) => {
        if (arg != null && arg.constructor === Uint8Array) {
          arg = Array.from(arg);
        }
        const t = typeof arg;
        switch (t) {
          case "string":
          case "symbol":
            return arg;
          default: {
            return stringify(arg);
          }
        }
      }),
      color,
      " +" + timeDiff + "ms"
    );
  };
};

// node_modules/lib0/logging.js
var _browserStyleMap = {
  [BOLD]: create6("font-weight", "bold"),
  [UNBOLD]: create6("font-weight", "normal"),
  [BLUE]: create6("color", "blue"),
  [GREEN]: create6("color", "green"),
  [GREY]: create6("color", "grey"),
  [RED]: create6("color", "red"),
  [PURPLE]: create6("color", "purple"),
  [ORANGE]: create6("color", "orange"),
  // not well supported in chrome when debugging node with inspector - TODO: deprecate
  [UNCOLOR]: create6("color", "black")
};
var computeBrowserLoggingArgs = (args2) => {
  if (args2.length === 1 && args2[0]?.constructor === Function) {
    args2 = /** @type {Array<string|Symbol|Object|number>} */
    /** @type {[function]} */
    args2[0]();
  }
  const strBuilder = [];
  const styles = [];
  const currentStyle = create3();
  let logArgs = [];
  let i = 0;
  for (; i < args2.length; i++) {
    const arg = args2[i];
    const style = _browserStyleMap[arg];
    if (style !== void 0) {
      currentStyle.set(style.left, style.right);
    } else {
      if (arg === void 0) {
        break;
      }
      if (arg.constructor === String || arg.constructor === Number) {
        const style2 = mapToStyleString(currentStyle);
        if (i > 0 || style2.length > 0) {
          strBuilder.push("%c" + arg);
          styles.push(style2);
        } else {
          strBuilder.push(arg);
        }
      } else {
        break;
      }
    }
  }
  if (i > 0) {
    logArgs = styles;
    logArgs.unshift(strBuilder.join(""));
  }
  for (; i < args2.length; i++) {
    const arg = args2[i];
    if (!(arg instanceof Symbol)) {
      logArgs.push(arg);
    }
  }
  return logArgs;
};
var computeLoggingArgs = supportsColor ? computeBrowserLoggingArgs : computeNoColorLoggingArgs;
var print = (...args2) => {
  console.log(...computeLoggingArgs(args2));
  vconsoles.forEach((vc) => vc.print(args2));
};
var warn = (...args2) => {
  console.warn(...computeLoggingArgs(args2));
  args2.unshift(ORANGE);
  vconsoles.forEach((vc) => vc.print(args2));
};
var printError = (err) => {
  console.error(err);
  vconsoles.forEach((vc) => vc.printError(err));
};
var printImg = (url, height) => {
  if (isBrowser) {
    console.log(
      "%c                      ",
      `font-size: ${height}px; background-size: contain; background-repeat: no-repeat; background-image: url(${url})`
    );
  }
  vconsoles.forEach((vc) => vc.printImg(url, height));
};
var printImgBase64 = (base64, height) => printImg(`data:image/gif;base64,${base64}`, height);
var group = (...args2) => {
  console.group(...computeLoggingArgs(args2));
  vconsoles.forEach((vc) => vc.group(args2));
};
var groupCollapsed = (...args2) => {
  console.groupCollapsed(...computeLoggingArgs(args2));
  vconsoles.forEach((vc) => vc.groupCollapsed(args2));
};
var groupEnd = () => {
  console.groupEnd();
  vconsoles.forEach((vc) => vc.groupEnd());
};
var printDom = (createNode) => vconsoles.forEach((vc) => vc.printDom(createNode()));
var printCanvas = (canvas2, height) => printImg(canvas2.toDataURL(), height);
var vconsoles = create();
var _computeLineSpans = (args2) => {
  const spans = [];
  const currentStyle = /* @__PURE__ */ new Map();
  let i = 0;
  for (; i < args2.length; i++) {
    let arg = args2[i];
    const style = _browserStyleMap[arg];
    if (style !== void 0) {
      currentStyle.set(style.left, style.right);
    } else {
      if (arg === void 0) {
        arg = "undefined ";
      }
      if (arg.constructor === String || arg.constructor === Number) {
        const span = element("span", [
          create6("style", mapToStyleString(currentStyle))
        ], [text(arg.toString())]);
        if (span.innerHTML === "") {
          span.innerHTML = "&nbsp;";
        }
        spans.push(span);
      } else {
        break;
      }
    }
  }
  for (; i < args2.length; i++) {
    let content = args2[i];
    if (!(content instanceof Symbol)) {
      if (content.constructor !== String && content.constructor !== Number) {
        content = " " + stringify(content) + " ";
      }
      spans.push(
        element("span", [], [text(
          /** @type {string} */
          content
        )])
      );
    }
  }
  return spans;
};
var lineStyle = "font-family:monospace;border-bottom:1px solid #e2e2e2;padding:2px;";
var VConsole = class {
  /**
   * @param {Element} dom
   */
  constructor(dom) {
    this.dom = dom;
    this.ccontainer = this.dom;
    this.depth = 0;
    vconsoles.add(this);
  }
  /**
   * @param {Array<string|Symbol|Object|number>} args
   * @param {boolean} collapsed
   */
  group(args2, collapsed = false) {
    enqueue(() => {
      const triangleDown = element("span", [
        create6("hidden", collapsed),
        create6("style", "color:grey;font-size:120%;")
      ], [text("\u25BC")]);
      const triangleRight = element("span", [
        create6("hidden", !collapsed),
        create6("style", "color:grey;font-size:125%;")
      ], [text("\u25B6")]);
      const content = element(
        "div",
        [create6(
          "style",
          `${lineStyle};padding-left:${this.depth * 10}px`
        )],
        [triangleDown, triangleRight, text(" ")].concat(
          _computeLineSpans(args2)
        )
      );
      const nextContainer = element("div", [
        create6("hidden", collapsed)
      ]);
      const nextLine = element("div", [], [content, nextContainer]);
      append(this.ccontainer, [nextLine]);
      this.ccontainer = nextContainer;
      this.depth++;
      addEventListener2(content, "click", (_event) => {
        nextContainer.toggleAttribute("hidden");
        triangleDown.toggleAttribute("hidden");
        triangleRight.toggleAttribute("hidden");
      });
    });
  }
  /**
   * @param {Array<string|Symbol|Object|number>} args
   */
  groupCollapsed(args2) {
    this.group(args2, true);
  }
  groupEnd() {
    enqueue(() => {
      if (this.depth > 0) {
        this.depth--;
        this.ccontainer = this.ccontainer.parentElement.parentElement;
      }
    });
  }
  /**
   * @param {Array<string|Symbol|Object|number>} args
   */
  print(args2) {
    enqueue(() => {
      append(this.ccontainer, [
        element("div", [
          create6(
            "style",
            `${lineStyle};padding-left:${this.depth * 10}px`
          )
        ], _computeLineSpans(args2))
      ]);
    });
  }
  /**
   * @param {Error} err
   */
  printError(err) {
    this.print([RED, BOLD, err.toString()]);
  }
  /**
   * @param {string} url
   * @param {number} height
   */
  printImg(url, height) {
    enqueue(() => {
      append(this.ccontainer, [
        element("img", [
          create6("src", url),
          create6("height", `${round(height * 1.5)}px`)
        ])
      ]);
    });
  }
  /**
   * @param {Node} node
   */
  printDom(node) {
    enqueue(() => {
      append(this.ccontainer, [node]);
    });
  }
  destroy() {
    enqueue(() => {
      vconsoles.delete(this);
    });
  }
};
var createVConsole = (dom) => new VConsole(dom);
var createModuleLogger2 = (moduleName) => createModuleLogger(print, moduleName);

// node_modules/lib0/mutex.js
var mutex_exports = {};
__export(mutex_exports, {
  createMutex: () => createMutex
});
var createMutex = () => {
  let token = true;
  return (f, g) => {
    if (token) {
      token = false;
      try {
        f();
      } finally {
        token = true;
      }
    } else if (g !== void 0) {
      g();
    }
  };
};

// node_modules/lib0/sort.js
var sort_exports = {};
__export(sort_exports, {
  _insertionSort: () => _insertionSort,
  insertionSort: () => insertionSort,
  quicksort: () => quicksort
});
var _insertionSort = (arr, lo, hi, compare) => {
  for (let i = lo + 1; i <= hi; i++) {
    for (let j = i; j > 0 && compare(arr[j - 1], arr[j]) > 0; j--) {
      const tmp = arr[j];
      arr[j] = arr[j - 1];
      arr[j - 1] = tmp;
    }
  }
};
var insertionSort = (arr, compare) => {
  _insertionSort(arr, 0, arr.length - 1, compare);
};
var _quickSort = (arr, lo, hi, compare) => {
  if (hi - lo < 42) {
    _insertionSort(arr, lo, hi, compare);
  } else {
    const pivot = arr[floor((lo + hi) / 2)];
    let i = lo;
    let j = hi;
    while (true) {
      while (compare(pivot, arr[i]) > 0) {
        i++;
      }
      while (compare(arr[j], pivot) > 0) {
        j--;
      }
      if (i >= j) {
        break;
      }
      const arri = arr[i];
      arr[i++] = arr[j];
      arr[j--] = arri;
    }
    _quickSort(arr, lo, j, compare);
    _quickSort(arr, j + 1, hi, compare);
  }
};
var quicksort = (arr, compare) => {
  _quickSort(arr, 0, arr.length - 1, compare);
};

// node_modules/lib0/statistics.js
var statistics_exports = {};
__export(statistics_exports, {
  average: () => average,
  median: () => median
});
var median = (arr) => arr.length === 0 ? NaN : arr.length % 2 === 1 ? arr[(arr.length - 1) / 2] : (arr[floor((arr.length - 1) / 2)] + arr[ceil((arr.length - 1) / 2)]) / 2;
var average = (arr) => arr.reduce(add, 0) / arr.length;

// node_modules/lib0/tree.js
var tree_exports = {};
__export(tree_exports, {
  Tree: () => Tree
});
var rotate = (tree, parent, newParent, n) => {
  if (parent === null) {
    tree.root = newParent;
    newParent._parent = null;
  } else if (parent.left === n) {
    parent.left = newParent;
  } else if (parent.right === n) {
    parent.right = newParent;
  } else {
    throw new Error("The elements are wrongly connected!");
  }
};
var N = class {
  /**
   * A created node is always red!
   *
   * @param {V} val
   */
  constructor(val) {
    this.val = val;
    this.color = true;
    this._left = null;
    this._right = null;
    this._parent = null;
  }
  isRed() {
    return this.color;
  }
  isBlack() {
    return !this.color;
  }
  redden() {
    this.color = true;
    return this;
  }
  blacken() {
    this.color = false;
    return this;
  }
  get grandparent() {
    return this.parent.parent;
  }
  get parent() {
    return this._parent;
  }
  get sibling() {
    return this === this.parent.left ? this.parent.right : this.parent.left;
  }
  get left() {
    return this._left;
  }
  get right() {
    return this._right;
  }
  set left(n) {
    if (n !== null) {
      n._parent = this;
    }
    this._left = n;
  }
  set right(n) {
    if (n !== null) {
      n._parent = this;
    }
    this._right = n;
  }
  rotateLeft(tree) {
    const parent = this.parent;
    const newParent = this.right;
    const newRight = this.right.left;
    newParent.left = this;
    this.right = newRight;
    rotate(tree, parent, newParent, this);
  }
  next() {
    if (this.right !== null) {
      let o = this.right;
      while (o.left !== null) {
        o = o.left;
      }
      return o;
    } else {
      let p = this;
      while (p.parent !== null && p !== p.parent.left) {
        p = p.parent;
      }
      return p.parent;
    }
  }
  prev() {
    if (this.left !== null) {
      let o = this.left;
      while (o.right !== null) {
        o = o.right;
      }
      return o;
    } else {
      let p = this;
      while (p.parent !== null && p !== p.parent.right) {
        p = p.parent;
      }
      return p.parent;
    }
  }
  rotateRight(tree) {
    const parent = this.parent;
    const newParent = this.left;
    const newLeft = this.left.right;
    newParent.right = this;
    this.left = newLeft;
    rotate(tree, parent, newParent, this);
  }
  getUncle() {
    if (this.parent === this.parent.parent.left) {
      return this.parent.parent.right;
    } else {
      return this.parent.parent.left;
    }
  }
};
var isBlack = (node) => node !== null ? node.isBlack() : true;
var isRed = (node) => node !== null ? node.isRed() : false;
var Tree = class {
  constructor() {
    this.root = null;
    this.length = 0;
  }
  /**
   * @param {K} id
   */
  findNext(id2) {
    const nextID = id2.clone();
    nextID.clock += 1;
    return this.findWithLowerBound(nextID);
  }
  /**
   * @param {K} id
   */
  findPrev(id2) {
    const prevID = id2.clone();
    prevID.clock -= 1;
    return this.findWithUpperBound(prevID);
  }
  /**
   * @param {K} from
   */
  findNodeWithLowerBound(from3) {
    let o = this.root;
    if (o === null) {
      return null;
    } else {
      while (true) {
        if (from3 === null || from3.lessThan(o.val._id) && o.left !== null) {
          o = o.left;
        } else if (from3 !== null && o.val._id.lessThan(from3)) {
          if (o.right !== null) {
            o = o.right;
          } else {
            return o.next();
          }
        } else {
          return o;
        }
      }
    }
  }
  /**
   * @param {K} to
   */
  findNodeWithUpperBound(to) {
    if (to === void 0) {
      throw new Error("You must define from!");
    }
    let o = this.root;
    if (o === null) {
      return null;
    } else {
      while (true) {
        if ((to === null || o.val._id.lessThan(to)) && o.right !== null) {
          o = o.right;
        } else if (to !== null && to.lessThan(o.val._id)) {
          if (o.left !== null) {
            o = o.left;
          } else {
            return o.prev();
          }
        } else {
          return o;
        }
      }
    }
  }
  /**
   * @return {V}
   */
  findSmallestNode() {
    let o = this.root;
    while (o != null && o.left != null) {
      o = o.left;
    }
    return o;
  }
  /**
   * @param {K} from
   * @return {V}
   */
  findWithLowerBound(from3) {
    const n = this.findNodeWithLowerBound(from3);
    return n == null ? null : n.val;
  }
  /**
   * @param {K} to
   * @return {V}
   */
  findWithUpperBound(to) {
    const n = this.findNodeWithUpperBound(to);
    return n == null ? null : n.val;
  }
  /**
   * @param {K} from
   * @param {V} from
   * @param {function(V):void} f
   */
  iterate(from3, to, f) {
    let o;
    if (from3 === null) {
      o = this.findSmallestNode();
    } else {
      o = this.findNodeWithLowerBound(from3);
    }
    while (o !== null && (to === null || // eslint-disable-line no-unmodified-loop-condition
    o.val._id.lessThan(to) || o.val._id.equals(to))) {
      f(o.val);
      o = o.next();
    }
  }
  /**
   * @param {K} id
   * @return {V|null}
   */
  find(id2) {
    const n = this.findNode(id2);
    if (n !== null) {
      return n.val;
    } else {
      return null;
    }
  }
  /**
   * @param {K} id
   * @return {N<V>|null}
   */
  findNode(id2) {
    let o = this.root;
    if (o === null) {
      return null;
    } else {
      while (true) {
        if (o === null) {
          return null;
        }
        if (id2.lessThan(o.val._id)) {
          o = o.left;
        } else if (o.val._id.lessThan(id2)) {
          o = o.right;
        } else {
          return o;
        }
      }
    }
  }
  /**
   * @param {K} id
   */
  delete(id2) {
    let d = this.findNode(id2);
    if (d == null) {
      return;
    }
    this.length--;
    if (d.left !== null && d.right !== null) {
      let o = d.left;
      while (o.right !== null) {
        o = o.right;
      }
      d.val = o.val;
      d = o;
    }
    let isFakeChild;
    let child = d.left || d.right;
    if (child === null) {
      isFakeChild = true;
      child = new N(null);
      child.blacken();
      d.right = child;
    } else {
      isFakeChild = false;
    }
    if (d.parent === null) {
      if (!isFakeChild) {
        this.root = child;
        child.blacken();
        child._parent = null;
      } else {
        this.root = null;
      }
      return;
    } else if (d.parent.left === d) {
      d.parent.left = child;
    } else if (d.parent.right === d) {
      d.parent.right = child;
    } else {
      throw new Error("Impossible!");
    }
    if (d.isBlack()) {
      if (child.isRed()) {
        child.blacken();
      } else {
        this._fixDelete(child);
      }
    }
    this.root.blacken();
    if (isFakeChild) {
      if (child.parent.left === child) {
        child.parent.left = null;
      } else if (child.parent.right === child) {
        child.parent.right = null;
      } else {
        throw new Error("Impossible #3");
      }
    }
  }
  _fixDelete(n) {
    if (n.parent === null) {
      return;
    }
    let sibling = n.sibling;
    if (isRed(sibling)) {
      n.parent.redden();
      sibling.blacken();
      if (n === n.parent.left) {
        n.parent.rotateLeft(this);
      } else if (n === n.parent.right) {
        n.parent.rotateRight(this);
      } else {
        throw new Error("Impossible #2");
      }
      sibling = n.sibling;
    }
    if (n.parent.isBlack() && sibling.isBlack() && isBlack(sibling.left) && isBlack(sibling.right)) {
      sibling.redden();
      this._fixDelete(n.parent);
    } else if (n.parent.isRed() && sibling.isBlack() && isBlack(sibling.left) && isBlack(sibling.right)) {
      sibling.redden();
      n.parent.blacken();
    } else {
      if (n === n.parent.left && sibling.isBlack() && isRed(sibling.left) && isBlack(sibling.right)) {
        sibling.redden();
        sibling.left.blacken();
        sibling.rotateRight(this);
        sibling = n.sibling;
      } else if (n === n.parent.right && sibling.isBlack() && isRed(sibling.right) && isBlack(sibling.left)) {
        sibling.redden();
        sibling.right.blacken();
        sibling.rotateLeft(this);
        sibling = n.sibling;
      }
      sibling.color = n.parent.color;
      n.parent.blacken();
      if (n === n.parent.left) {
        sibling.right.blacken();
        n.parent.rotateLeft(this);
      } else {
        sibling.left.blacken();
        n.parent.rotateRight(this);
      }
    }
  }
  put(v) {
    const node = new N(v);
    if (this.root !== null) {
      let p = this.root;
      while (true) {
        if (node.val._id.lessThan(p.val._id)) {
          if (p.left === null) {
            p.left = node;
            break;
          } else {
            p = p.left;
          }
        } else if (p.val._id.lessThan(node.val._id)) {
          if (p.right === null) {
            p.right = node;
            break;
          } else {
            p = p.right;
          }
        } else {
          p.val = node.val;
          return p;
        }
      }
      this._fixInsert(node);
    } else {
      this.root = node;
    }
    this.length++;
    this.root.blacken();
    return node;
  }
  _fixInsert(n) {
    if (n.parent === null) {
      n.blacken();
      return;
    } else if (n.parent.isBlack()) {
      return;
    }
    const uncle = n.getUncle();
    if (uncle !== null && uncle.isRed()) {
      n.parent.blacken();
      uncle.blacken();
      n.grandparent.redden();
      this._fixInsert(n.grandparent);
    } else {
      if (n === n.parent.right && n.parent === n.grandparent.left) {
        n.parent.rotateLeft(this);
        n = n.left;
      } else if (n === n.parent.left && n.parent === n.grandparent.right) {
        n.parent.rotateRight(this);
        n = n.right;
      }
      n.parent.blacken();
      n.grandparent.redden();
      if (n === n.parent.left) {
        n.grandparent.rotateRight(this);
      } else {
        n.grandparent.rotateLeft(this);
      }
    }
  }
};

// node_modules/lib0/websocket.js
var websocket_exports = {};
__export(websocket_exports, {
  WebsocketClient: () => WebsocketClient
});

// node_modules/lib0/observable.js
var Observable = class {
  constructor() {
    this._observers = create3();
  }
  /**
   * @param {N} name
   * @param {function} f
   */
  on(name, f) {
    setIfUndefined(this._observers, name, create).add(f);
  }
  /**
   * @param {N} name
   * @param {function} f
   */
  once(name, f) {
    const _f = (...args2) => {
      this.off(name, _f);
      f(...args2);
    };
    this.on(name, _f);
  }
  /**
   * @param {N} name
   * @param {function} f
   */
  off(name, f) {
    const observers = this._observers.get(name);
    if (observers !== void 0) {
      observers.delete(f);
      if (observers.size === 0) {
        this._observers.delete(name);
      }
    }
  }
  /**
   * Emit a named event. All registered event listeners that listen to the
   * specified name will receive the event.
   *
   * @todo This should catch exceptions
   *
   * @param {N} name The event name.
   * @param {Array<any>} args The arguments that are applied to the event listener.
   */
  emit(name, args2) {
    return from2((this._observers.get(name) || create3()).values()).forEach((f) => f(...args2));
  }
  destroy() {
    this._observers = create3();
  }
};

// node_modules/lib0/websocket.js
var reconnectTimeoutBase = 1200;
var maxReconnectTimeout = 2500;
var messageReconnectTimeout = 3e4;
var setupWS = (wsclient) => {
  if (wsclient.shouldConnect && wsclient.ws === null) {
    const websocket = new WebSocket(wsclient.url);
    const binaryType = wsclient.binaryType;
    let pingTimeout = null;
    if (binaryType) {
      websocket.binaryType = binaryType;
    }
    wsclient.ws = websocket;
    wsclient.connecting = true;
    wsclient.connected = false;
    websocket.onmessage = (event) => {
      wsclient.lastMessageReceived = getUnixTime();
      const data = event.data;
      const message = typeof data === "string" ? JSON.parse(data) : data;
      if (message && message.type === "pong") {
        clearTimeout(pingTimeout);
        pingTimeout = setTimeout(sendPing, messageReconnectTimeout / 2);
      }
      wsclient.emit("message", [message, wsclient]);
    };
    const onclose = (error) => {
      if (wsclient.ws !== null) {
        wsclient.ws = null;
        wsclient.connecting = false;
        if (wsclient.connected) {
          wsclient.connected = false;
          wsclient.emit("disconnect", [{ type: "disconnect", error }, wsclient]);
        } else {
          wsclient.unsuccessfulReconnects++;
        }
        setTimeout(setupWS, min(log10(wsclient.unsuccessfulReconnects + 1) * reconnectTimeoutBase, maxReconnectTimeout), wsclient);
      }
      clearTimeout(pingTimeout);
    };
    const sendPing = () => {
      if (wsclient.ws === websocket) {
        wsclient.send({
          type: "ping"
        });
      }
    };
    websocket.onclose = () => onclose(null);
    websocket.onerror = (error) => onclose(error);
    websocket.onopen = () => {
      wsclient.lastMessageReceived = getUnixTime();
      wsclient.connecting = false;
      wsclient.connected = true;
      wsclient.unsuccessfulReconnects = 0;
      wsclient.emit("connect", [{ type: "connect" }, wsclient]);
      pingTimeout = setTimeout(sendPing, messageReconnectTimeout / 2);
    };
  }
};
var WebsocketClient = class extends Observable {
  /**
   * @param {string} url
   * @param {object} opts
   * @param {'arraybuffer' | 'blob' | null} [opts.binaryType] Set `ws.binaryType`
   */
  constructor(url, { binaryType } = {}) {
    super();
    this.url = url;
    this.ws = null;
    this.binaryType = binaryType || null;
    this.connected = false;
    this.connecting = false;
    this.unsuccessfulReconnects = 0;
    this.lastMessageReceived = 0;
    this.shouldConnect = true;
    this._checkInterval = setInterval(() => {
      if (this.connected && messageReconnectTimeout < getUnixTime() - this.lastMessageReceived) {
        this.ws.close();
      }
    }, messageReconnectTimeout / 2);
    setupWS(this);
  }
  /**
   * @param {any} message
   */
  send(message) {
    if (this.ws) {
      this.ws.send(JSON.stringify(message));
    }
  }
  destroy() {
    clearInterval(this._checkInterval);
    this.disconnect();
    super.destroy();
  }
  disconnect() {
    this.shouldConnect = false;
    if (this.ws !== null) {
      this.ws.close();
    }
  }
  connect() {
    this.shouldConnect = true;
    if (!this.connected && this.ws === null) {
      setupWS(this);
    }
  }
};
export {
  array_exports as array,
  binary_exports as binary,
  broadcastchannel_exports as broadcastchannel,
  buffer_exports as buffer,
  conditions_exports as conditions,
  decoding_exports as decoding,
  diff_exports as diff,
  dom_exports as dom,
  encoding_exports as encoding,
  environment_exports as environment,
  error_exports as error,
  eventloop_exports as eventloop,
  function_exports as func,
  indexeddb_exports as indexeddb,
  iterator_exports as iterator,
  json_exports as json,
  logging_exports as logging,
  map_exports as map,
  math_exports as math,
  mutex_exports as mutex,
  number_exports as number,
  object_exports as object,
  pair_exports as pair,
  prng_exports as prng,
  promise_exports as promise,
  set_exports as set,
  sort_exports as sort,
  statistics_exports as statistics,
  string_exports as string,
  symbol_exports as symbol,
  time_exports as time,
  tree_exports as tree,
  websocket_exports as websocket
};
