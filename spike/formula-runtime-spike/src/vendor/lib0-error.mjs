// node_modules/lib0/error.js
var create = (s) => new Error(s);
var methodUnimplemented = () => {
  throw create("Method unimplemented");
};
var unexpectedCase = () => {
  throw create("Unexpected case");
};
var assert = (property) => {
  if (!property) throw create("Assert failed");
};
export {
  assert,
  create,
  methodUnimplemented,
  unexpectedCase
};
