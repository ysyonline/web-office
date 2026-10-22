// node_modules/lib0/time.js
var getUnixTime = Date.now;

// node_modules/lib0/promise.js
var create = (f) => (
  /** @type {Promise<T>} */
  new Promise(f)
);
var createEmpty = (f) => new Promise(f);
var all = Promise.all.bind(Promise);
var reject = (reason) => Promise.reject(reason);
var resolve = (res) => Promise.resolve(res);
var resolveWith = (res) => Promise.resolve(res);
var until = (timeout, check, intervalResolution = 10) => create((resolve2, reject2) => {
  const startTime = getUnixTime();
  const hasTimeout = timeout > 0;
  const untilInterval = () => {
    if (check()) {
      clearInterval(intervalHandle);
      resolve2();
    } else if (hasTimeout) {
      if (getUnixTime() - startTime > timeout) {
        clearInterval(intervalHandle);
        reject2(new Error("Timeout"));
      }
    }
  };
  const intervalHandle = setInterval(untilInterval, intervalResolution);
});
var untilAsync = async (check, timeout = 0, intervalResolution = 10) => {
  const startTime = getUnixTime();
  const noTimeout = timeout <= 0;
  while (noTimeout || getUnixTime() - startTime <= timeout) {
    if (await check()) return;
    await wait(intervalResolution);
  }
  throw new Error("Timeout");
};
var wait = (timeout) => create((resolve2, _reject) => setTimeout(resolve2, timeout));
var isPromise = (p) => p instanceof Promise || p && p.then && p.catch && p.finally;
export {
  all,
  create,
  createEmpty,
  isPromise,
  reject,
  resolve,
  resolveWith,
  until,
  untilAsync,
  wait
};
