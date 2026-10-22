// node_modules/lib0/binary.js
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
var BITS8 = 255;
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
var BITS32 = 4294967295;

// node_modules/lib0/string.js
var fromCharCode = String.fromCharCode;
var fromCodePoint = String.fromCodePoint;
var MAX_UTF16_CHARACTER = fromCharCode(65535);
var utf8TextEncoder = (
  /** @type {TextEncoder} */
  typeof TextEncoder !== "undefined" ? new TextEncoder() : null
);
var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
if (utf8TextDecoder && utf8TextDecoder.decode(new Uint8Array()).length === 1) {
  utf8TextDecoder = null;
}

// node_modules/lib0/math.js
var floor = Math.floor;
var abs = Math.abs;
var isNaN = Number.isNaN;

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

// node_modules/lib0/buffer.js
var createUint8ArrayFromLen = (len) => new Uint8Array(len);

// node_modules/lib0/prng.js
var DefaultPRNG = Xoroshiro128plus;
var create = (seed) => new DefaultPRNG(seed);
var bool = (gen) => gen.next() >= 0.5;
var int53 = (gen, min, max) => floor(gen.next() * (max + 1 - min) + min);
var uint53 = (gen, min, max) => abs(int53(gen, min, max));
var int32 = (gen, min, max) => floor(gen.next() * (max + 1 - min) + min);
var uint32 = (gen, min, max) => int32(gen, min, max) >>> 0;
var int31 = (gen, min, max) => int32(gen, min, max);
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
export {
  DefaultPRNG,
  bool,
  char,
  create,
  int31,
  int32,
  int53,
  letter,
  oneOf,
  real53,
  uint16Array,
  uint32,
  uint32Array,
  uint53,
  uint8Array,
  utf16Rune,
  utf16String,
  word
};
