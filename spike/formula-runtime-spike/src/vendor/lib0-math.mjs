// node_modules/lib0/math.js
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
export {
  abs,
  add,
  ceil,
  exp10,
  floor,
  imul,
  isNaN,
  isNegativeZero,
  log,
  log10,
  log2,
  max,
  min,
  pow,
  round,
  sign,
  sqrt
};
