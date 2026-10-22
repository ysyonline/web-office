// node_modules/lib0/function.js
var equalityStrict = (a, b) => a === b;

// node_modules/lib0/diff.js
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
export {
  simpleDiff,
  simpleDiffArray,
  simpleDiffString,
  simpleDiffStringWithCursor
};
