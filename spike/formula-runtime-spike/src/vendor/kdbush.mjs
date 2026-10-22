// node_modules/kdbush/index.js
var ARRAY_TYPES = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array
];
var VERSION = 1;
var HEADER_SIZE = 8;
var STACK = new Uint32Array(96);
var KDBush = class _KDBush {
  /**
   * Creates an index from raw `ArrayBuffer` data.
   * @param {ArrayBufferLike} data
   */
  static from(data) {
    if (!data || data.byteLength === void 0 || data.buffer) {
      throw new Error("Data must be an instance of ArrayBuffer or SharedArrayBuffer.");
    }
    const [magic, versionAndType] = new Uint8Array(data, 0, 2);
    if (magic !== 219) {
      throw new Error("Data does not appear to be in a KDBush format.");
    }
    const version = versionAndType >> 4;
    if (version !== VERSION) {
      throw new Error(`Got v${version} data when expected v${VERSION}.`);
    }
    const ArrayType = ARRAY_TYPES[versionAndType & 15];
    if (!ArrayType) {
      throw new Error("Unrecognized array type.");
    }
    const [nodeSize] = new Uint16Array(data, 2, 1);
    const [numItems] = new Uint32Array(data, 4, 1);
    return new _KDBush(numItems, nodeSize, ArrayType, void 0, data);
  }
  /**
   * Creates an index that will hold a given number of items.
   * @param {number} numItems
   * @param {number} [nodeSize=64] Size of the KD-tree node (64 by default).
   * @param {TypedArrayConstructor} [ArrayType=Float64Array] The array type used for coordinates storage (`Float64Array` by default).
   * @param {ArrayBufferConstructor | SharedArrayBufferConstructor} [ArrayBufferType=ArrayBuffer] The array buffer type used for storage (`ArrayBuffer` by default).
   * @param {ArrayBufferLike} [data] (For internal use only)
   */
  constructor(numItems, nodeSize = 64, ArrayType = Float64Array, ArrayBufferType = ArrayBuffer, data) {
    if (isNaN(numItems) || numItems < 0) throw new Error(`Unexpected numItems value: ${numItems}.`);
    this.numItems = +numItems;
    this.nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);
    this.ArrayType = ArrayType;
    this.IndexArrayType = numItems < 65536 ? Uint16Array : Uint32Array;
    const arrayTypeIndex = ARRAY_TYPES.indexOf(this.ArrayType);
    const coordsByteSize = numItems * 2 * this.ArrayType.BYTES_PER_ELEMENT;
    const idsByteSize = numItems * this.IndexArrayType.BYTES_PER_ELEMENT;
    const padCoords = (8 - idsByteSize % 8) % 8;
    if (arrayTypeIndex < 0) {
      throw new Error(`Unexpected typed array class: ${ArrayType}.`);
    }
    if (data) {
      this.data = data;
      this.ids = new this.IndexArrayType(data, HEADER_SIZE, numItems);
      this.coords = new ArrayType(data, HEADER_SIZE + idsByteSize + padCoords, numItems * 2);
      this._pos = numItems * 2;
      this._finished = true;
    } else {
      const data2 = this.data = new ArrayBufferType(HEADER_SIZE + coordsByteSize + idsByteSize + padCoords);
      this.ids = new this.IndexArrayType(data2, HEADER_SIZE, numItems);
      this.coords = new ArrayType(data2, HEADER_SIZE + idsByteSize + padCoords, numItems * 2);
      this._pos = 0;
      this._finished = false;
      new Uint8Array(data2, 0, 2).set([219, (VERSION << 4) + arrayTypeIndex]);
      new Uint16Array(data2, 2, 1)[0] = nodeSize;
      new Uint32Array(data2, 4, 1)[0] = numItems;
    }
  }
  /**
   * Add a point to the index.
   * @param {number} x
   * @param {number} y
   * @returns {number} An incremental index associated with the added item (starting from `0`).
   */
  add(x, y) {
    const index = this._pos >> 1;
    this.ids[index] = index;
    this.coords[this._pos++] = x;
    this.coords[this._pos++] = y;
    return index;
  }
  /**
   * Perform indexing of the added points.
   */
  finish() {
    const numAdded = this._pos >> 1;
    if (numAdded !== this.numItems) {
      throw new Error(`Added ${numAdded} items when expected ${this.numItems}.`);
    }
    sort(this.ids, this.coords, this.nodeSize, 0, this.numItems - 1, 0);
    this._finished = true;
    return this;
  }
  /**
   * Search the index for items within a given bounding box.
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @returns {number[]} An array of indices correponding to the found items.
   */
  range(minX, minY, maxX, maxY) {
    if (!this._finished) throw new Error("Data not yet indexed - call index.finish().");
    const { ids, coords, nodeSize } = this;
    STACK[0] = 0;
    STACK[1] = ids.length - 1;
    STACK[2] = 0;
    let sp = 3;
    const result = [];
    while (sp > 0) {
      const axis = STACK[--sp];
      const right = STACK[--sp];
      const left = STACK[--sp];
      if (right - left <= nodeSize) {
        for (let i = left; i <= right; i++) {
          const x2 = coords[2 * i];
          const y2 = coords[2 * i + 1];
          if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) result.push(ids[i]);
        }
        continue;
      }
      const m = left + right >> 1;
      const x = coords[2 * m];
      const y = coords[2 * m + 1];
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[m]);
      if (axis === 0 ? minX <= x : minY <= y) {
        STACK[sp++] = left;
        STACK[sp++] = m - 1;
        STACK[sp++] = 1 - axis;
      }
      if (axis === 0 ? maxX >= x : maxY >= y) {
        STACK[sp++] = m + 1;
        STACK[sp++] = right;
        STACK[sp++] = 1 - axis;
      }
    }
    return result;
  }
  /**
   * Search the index for items within a given radius.
   * @param {number} qx
   * @param {number} qy
   * @param {number} r Query radius.
   * @returns {number[]} An array of indices correponding to the found items.
   */
  within(qx, qy, r) {
    const result = (
      /** @type {number[]} */
      []
    );
    this.withinInto(qx, qy, r, result);
    return result;
  }
  /**
   * Search the index for items within a given radius, writing matching ids into `out`
   * via indexed assignment (`out[i] = id`). Accepts any indexed-writable container —
   * a typed array sized to the expected upper bound (allocation-free, fast) or a plain
   * `Array` (which will grow as needed). Returns the number of matches written.
   * @param {number} qx
   * @param {number} qy
   * @param {number} r Query radius.
   * @param {number[] | TypedArray} out Container to write matching ids into.
   * @returns {number} The number of matches written to `out`.
   */
  withinInto(qx, qy, r, out) {
    if (!this._finished) throw new Error("Data not yet indexed - call index.finish().");
    const { ids, coords, nodeSize } = this;
    STACK[0] = 0;
    STACK[1] = ids.length - 1;
    STACK[2] = 0;
    let sp = 3;
    let count = 0;
    const r2 = r * r;
    while (sp > 0) {
      const axis = STACK[--sp];
      const right = STACK[--sp];
      const left = STACK[--sp];
      if (right - left <= nodeSize) {
        for (let i = left; i <= right; i++) {
          if (sqDist(coords[2 * i], coords[2 * i + 1], qx, qy) <= r2) out[count++] = ids[i];
        }
        continue;
      }
      const m = left + right >> 1;
      const x = coords[2 * m];
      const y = coords[2 * m + 1];
      if (sqDist(x, y, qx, qy) <= r2) out[count++] = ids[m];
      if (axis === 0 ? qx - r <= x : qy - r <= y) {
        STACK[sp++] = left;
        STACK[sp++] = m - 1;
        STACK[sp++] = 1 - axis;
      }
      if (axis === 0 ? qx + r >= x : qy + r >= y) {
        STACK[sp++] = m + 1;
        STACK[sp++] = right;
        STACK[sp++] = 1 - axis;
      }
    }
    return count;
  }
};
function sort(ids, coords, nodeSize, left, right, axis) {
  if (right - left <= nodeSize) return;
  const m = left + right >> 1;
  select(ids, coords, m, left, right, axis);
  sort(ids, coords, nodeSize, left, m - 1, 1 - axis);
  sort(ids, coords, nodeSize, m + 1, right, 1 - axis);
}
function select(ids, coords, k, left, right, axis) {
  while (right > left) {
    if (right - left > 600) {
      const n = right - left + 1;
      const m = k - left + 1;
      const z = Math.log(n);
      const s = 0.5 * Math.exp(2 * z / 3);
      const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
      const newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
      const newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
      select(ids, coords, k, newLeft, newRight, axis);
    }
    const t = coords[2 * k + axis];
    let i = left;
    let j = right;
    swapItem(ids, coords, left, k);
    if (coords[2 * right + axis] > t) swapItem(ids, coords, left, right);
    while (i < j) {
      swapItem(ids, coords, i, j);
      i++;
      j--;
      while (coords[2 * i + axis] < t) i++;
      while (coords[2 * j + axis] > t) j--;
    }
    if (coords[2 * left + axis] === t) swapItem(ids, coords, left, j);
    else {
      j++;
      swapItem(ids, coords, j, right);
    }
    if (j <= k) left = j + 1;
    if (k <= j) right = j - 1;
  }
}
function swapItem(ids, coords, i, j) {
  swap(ids, i, j);
  swap(coords, 2 * i, 2 * j);
  swap(coords, 2 * i + 1, 2 * j + 1);
}
function swap(arr, i, j) {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}
function sqDist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
export {
  KDBush as default
};
