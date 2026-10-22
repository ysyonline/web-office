// node_modules/lib0/array.js
var from = Array.from;
var unfold = (len, f) => {
  const array = new Array(len);
  for (let i = 0; i < len; i++) {
    array[i] = f(i, array);
  }
  return array;
};
var isArray = Array.isArray;

// node_modules/lib0/string.js
var fromCharCode = String.fromCharCode;
var fromCodePoint = String.fromCodePoint;
var MAX_UTF16_CHARACTER = fromCharCode(65535);
var toLowerCase = (s) => s.toLowerCase();
var trimLeftRegex = /^\s*/g;
var trimLeft = (s) => s.replace(trimLeftRegex, "");
var fromCamelCaseRegex = /([A-Z])/g;
var fromCamelCase = (s, separator) => trimLeft(s.replace(fromCamelCaseRegex, (match) => `${separator}${toLowerCase(match)}`));
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
var splice = (str, index, remove, insert = "") => str.slice(0, index) + insert + str.slice(index + remove);
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
export {
  MAX_UTF16_CHARACTER,
  _decodeUtf8Native,
  _decodeUtf8Polyfill,
  _encodeUtf8Native,
  _encodeUtf8Polyfill,
  decodeUtf8,
  encodeUtf8,
  escapeHTML,
  fromCamelCase,
  fromCharCode,
  fromCodePoint,
  repeat,
  splice,
  trimLeft,
  unescapeHTML,
  utf8ByteLength,
  utf8TextDecoder,
  utf8TextEncoder
};
