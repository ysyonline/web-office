// node_modules/lib0/set.js
var create = () => /* @__PURE__ */ new Set();
var toArray = (set) => Array.from(set);
var first = (set) => set.values().next().value;
var from = (entries) => new Set(entries);
export {
  create,
  first,
  from,
  toArray
};
