// node_modules/lib0/math.js
var floor = Math.floor;
var round = Math.round;
var log10 = Math.log10;
var isNaN = Number.isNaN;
var exp10 = (exp) => Math.pow(10, exp);

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
export {
  getDate,
  getUnixTime,
  humanizeDuration
};
