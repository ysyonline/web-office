// node_modules/lib0/iterator.js
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
export {
  createIterator,
  iteratorFilter,
  iteratorMap,
  mapIterator
};
