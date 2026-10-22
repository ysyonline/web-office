// node_modules/lib0/object.js
var map = (obj, f) => {
  const results = [];
  for (const key in obj) {
    results.push(f(obj[key], key));
  }
  return results;
};

// node_modules/lib0/url.js
var decodeQueryParams = (url) => {
  const query = {};
  const urlQuerySplit = url.split("?");
  const pairs = urlQuerySplit[urlQuerySplit.length - 1].split("&");
  for (let i = 0; i < pairs.length; i++) {
    const item = pairs[i];
    if (item.length > 0) {
      const pair = item.split("=");
      query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || "");
    }
  }
  return query;
};
var encodeQueryParams = (params) => map(params, (val, key) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`).join("&");
export {
  decodeQueryParams,
  encodeQueryParams
};
