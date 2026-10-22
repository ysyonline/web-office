var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/ot-json1/dist/deepEqual.js
var require_deepEqual = __commonJS({
  "node_modules/ot-json1/dist/deepEqual.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function eqObj(a, b) {
      if (Array.isArray(b))
        return false;
      for (let k in a) {
        if (!deepEqual(a[k], b[k]))
          return false;
      }
      for (let k in b) {
        if (a[k] === void 0)
          return false;
      }
      return true;
    }
    function eqArr(a, b) {
      if (!Array.isArray(b))
        return false;
      if (a.length !== b.length)
        return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i]))
          return false;
      }
      return true;
    }
    function deepEqual(a, b) {
      if (a === b)
        return true;
      if (a === null || b === null)
        return false;
      if (typeof a !== "object" || typeof b !== "object")
        return false;
      return Array.isArray(a) ? eqArr(a, b) : eqObj(a, b);
    }
    exports.default = deepEqual;
  }
});

// node_modules/ot-json1/dist/deepClone.js
var require_deepClone = __commonJS({
  "node_modules/ot-json1/dist/deepClone.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function deepClone(old) {
      if (old === null)
        return null;
      if (Array.isArray(old)) {
        return old.map(deepClone);
      } else if (typeof old === "object") {
        const o = {};
        for (let k in old)
          o[k] = deepClone(old[k]);
        return o;
      } else {
        return old;
      }
    }
    exports.default = deepClone;
  }
});

// node_modules/ot-json1/dist/cursor.js
var require_cursor = __commonJS({
  "node_modules/ot-json1/dist/cursor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.eachChildOf = exports.advancer = exports.readCursor = exports.writeCursor = exports.WriteCursor = exports.ReadCursor = exports.isValidPathItem = void 0;
    function assert(pred, msg) {
      if (!pred)
        throw new Error(msg);
    }
    var isObject = (o) => o != null && typeof o === "object" && !Array.isArray(o);
    var isGreaterKey = (a, b) => (
      // All the numbers, then all the letters. Just as the gods of ascii intended.
      typeof a === typeof b ? a > b : typeof a === "string" && typeof b === "number"
    );
    function copyAll(c, w) {
      for (let _k in c) {
        const k = _k;
        w.write(k, c[k]);
      }
    }
    exports.isValidPathItem = (k) => typeof k === "number" || typeof k === "string" && k !== "__proto__";
    var Cursor = class {
      constructor(op = null) {
        this.parents = [];
        this.indexes = [];
        this.lcIdx = -1;
        this.idx = -1;
        this.container = op;
      }
      ascend() {
        assert(this.parents.length === this.indexes.length / 2);
        if (this.idx === 0) {
          if (this.parents.length) {
            this.lcIdx = this.indexes.pop();
            this.container = this.parents.pop();
            this.idx = this.indexes.pop();
          } else {
            this.lcIdx = 0;
            this.idx = -1;
          }
        } else {
          assert(this.idx > 0);
          this.idx--;
          if (isObject(this.container[this.idx]))
            this.idx--;
        }
      }
      getPath() {
        const path = [];
        let c = this.container;
        let p = this.parents.length - 1;
        let i = this.idx;
        while (i >= 0) {
          path.unshift(c[i]);
          if (i === 0) {
            i = this.indexes[p * 2];
            c = this.parents[p--];
          } else {
            i -= isObject(c[i - 1]) ? 2 : 1;
          }
        }
        return path;
      }
    };
    var ReadCursor = class _ReadCursor extends Cursor {
      get() {
        return this.container ? this.container.slice(this.idx + 1) : null;
      }
      // Its only valid to call this after descending into a child.
      getKey() {
        assert(this.container != null, "Invalid call to getKey before cursor descended");
        return this.container[this.idx];
      }
      getComponent() {
        let c;
        if (this.container && this.container.length > this.idx + 1 && isObject(c = this.container[this.idx + 1])) {
          return c;
        } else {
          return null;
        }
      }
      descendFirst() {
        let i = this.idx + 1;
        if (!this.container || i >= this.container.length || isObject(this.container[i]) && i + 1 >= this.container.length) {
          return false;
        }
        if (isObject(this.container[i]))
          i++;
        const firstChild = this.container[i];
        if (Array.isArray(firstChild)) {
          this.indexes.push(this.idx);
          this.parents.push(this.container);
          this.indexes.push(i);
          this.idx = 0;
          this.container = firstChild;
        } else {
          this.idx = i;
        }
        return true;
      }
      nextSibling() {
        assert(this.parents.length === this.indexes.length / 2);
        if (this.idx > 0 || this.parents.length === 0)
          return false;
        const i = this.indexes[this.indexes.length - 1] + 1;
        const c = this.parents[this.parents.length - 1];
        if (i >= c.length)
          return false;
        assert(!isNaN(i));
        this.indexes[this.indexes.length - 1] = i;
        this.container = c[i];
        return true;
      }
      _init(_container, _idx, _parents, _indexes) {
        this.container = _container;
        this.idx = _idx;
        this.parents = _parents.slice();
        this.indexes = _indexes.slice();
      }
      clone() {
        const c = new _ReadCursor();
        c._init(this.container, this.idx, this.parents, this.indexes);
        return c;
      }
      *[Symbol.iterator]() {
        if (!this.descendFirst())
          return;
        do
          yield this.getKey();
        while (this.nextSibling());
        this.ascend();
      }
      // TODO(cleanup): Consider moving these functions out of cursor, since
      // they're really just helper methods.
      // It'd be really nice to do this using generators.
      traverse(w, fn) {
        const c = this.getComponent();
        if (c)
          fn(c, w);
        for (const key of this) {
          if (w)
            w.descend(key);
          this.traverse(w, fn);
          if (w)
            w.ascend();
        }
      }
      eachPick(w, fn) {
        this.traverse(w, (c, w2) => {
          if (c.p != null)
            fn(c.p, w2);
        });
      }
      eachDrop(w, fn) {
        this.traverse(w, (c, w2) => {
          if (c.d != null)
            fn(c.d, w2);
        });
      }
    };
    exports.ReadCursor = ReadCursor;
    var WriteCursor = class extends Cursor {
      constructor(op = null) {
        super(op);
        this.pendingDescent = [];
        this._op = op;
      }
      flushDescent() {
        assert(this.parents.length === this.indexes.length / 2);
        if (this.container === null)
          this._op = this.container = [];
        for (let j = 0; j < this.pendingDescent.length; j++) {
          const k = this.pendingDescent[j];
          let i = this.idx + 1;
          if (i < this.container.length && isObject(this.container[i]))
            i++;
          assert(i === this.container.length || !isObject(this.container[i]));
          if (i === this.container.length) {
            this.container.push(k);
            this.idx = i;
          } else if (this.container[i] === k) {
            this.idx = i;
          } else {
            if (!Array.isArray(this.container[i])) {
              const oldChild = this.container.splice(i, this.container.length - i);
              this.container.push(oldChild);
              if (this.lcIdx > -1)
                this.lcIdx = i;
            }
            this.indexes.push(this.idx);
            this.parents.push(this.container);
            if (this.lcIdx !== -1) {
              assert(isGreaterKey(k, this.container[this.lcIdx][0]));
              i = this.lcIdx + 1;
              this.lcIdx = -1;
            }
            while (i < this.container.length && isGreaterKey(k, this.container[i][0]))
              i++;
            this.indexes.push(i);
            this.idx = 0;
            if (i < this.container.length && this.container[i][0] === k) {
              this.container = this.container[i];
            } else {
              const child = [k];
              this.container.splice(i, 0, child);
              this.container = child;
            }
          }
        }
        this.pendingDescent.length = 0;
      }
      reset() {
        this.lcIdx = -1;
      }
      // Creates and returns a component, creating one if need be. You should
      // probably write to it immediately - ops are not valid with empty
      // components.
      getComponent() {
        this.flushDescent();
        const i = this.idx + 1;
        if (i < this.container.length && isObject(this.container[i])) {
          return this.container[i];
        } else {
          const component = {};
          this.container.splice(i, 0, component);
          return component;
        }
      }
      write(key, value) {
        const component = this.getComponent();
        assert(component[key] == null || component[key] === value, "Internal consistency error: Overwritten component. File a bug");
        component[key] = value;
      }
      get() {
        return this._op;
      }
      descend(key) {
        if (!exports.isValidPathItem(key))
          throw Error("Invalid JSON key");
        this.pendingDescent.push(key);
      }
      descendPath(path) {
        this.pendingDescent.push(...path);
        return this;
      }
      ascend() {
        if (this.pendingDescent.length)
          this.pendingDescent.pop();
        else
          super.ascend();
      }
      mergeTree(data, mergeFn = copyAll) {
        if (data === null)
          return;
        assert(Array.isArray(data));
        if (data === this._op)
          throw Error("Cannot merge into my own tree");
        const _lcIdx = this.lcIdx;
        const oldDepth = this.parents.length;
        let depth = 0;
        for (let i = 0; i < data.length; i++) {
          const c = data[i];
          if (typeof c === "string" || typeof c === "number") {
            depth++;
            this.descend(c);
          } else if (Array.isArray(c)) {
            this.mergeTree(c, mergeFn);
          } else if (typeof c === "object") {
            mergeFn(c, this);
          }
        }
        while (depth--)
          this.ascend();
        this.lcIdx = this.parents.length === oldDepth ? _lcIdx : -1;
      }
      at(path, fn) {
        this.descendPath(path);
        fn(this);
        for (let i = 0; i < path.length; i++)
          this.ascend();
        return this;
      }
      // This is used by helpers, so the strict ordering guarantees are
      // relaxed.
      writeAtPath(path, key, value) {
        this.at(path, () => this.write(key, value));
        this.reset();
        return this;
      }
      writeMove(path1, path2, slot = 0) {
        return this.writeAtPath(path1, "p", slot).writeAtPath(path2, "d", slot);
      }
      getPath() {
        const path = super.getPath();
        path.push(...this.pendingDescent);
        return path;
      }
    };
    exports.WriteCursor = WriteCursor;
    exports.writeCursor = () => new WriteCursor();
    exports.readCursor = (op) => new ReadCursor(op);
    function advancer(r, listMap, listAdv) {
      let didDescend, valid;
      valid = didDescend = r ? r.descendFirst() : false;
      function adv(ktarget) {
        let k2_;
        while (valid) {
          const k2 = k2_ = r.getKey();
          if (ktarget != null) {
            let skip = false;
            if (listMap && typeof k2 === "number") {
              k2_ = listMap(k2, r.getComponent());
              if (k2_ < 0) {
                k2_ = ~k2_;
                skip = true;
              }
            }
            if (isGreaterKey(k2_, ktarget))
              return null;
            else if (k2_ === ktarget && !skip)
              return r;
          }
          if (listAdv && typeof k2_ === "number")
            listAdv(k2_, r.getComponent());
          valid = r.nextSibling();
        }
        return null;
      }
      adv.end = () => {
        if (didDescend)
          r.ascend();
      };
      return adv;
    }
    exports.advancer = advancer;
    function eachChildOf(r1, r2, fn) {
      let hasChild1, descended1, hasChild2, descended2;
      hasChild1 = descended1 = r1 && r1.descendFirst();
      hasChild2 = descended2 = r2 && r2.descendFirst();
      while (hasChild1 || hasChild2) {
        let k1 = hasChild1 ? r1.getKey() : null;
        let k2 = hasChild2 ? r2.getKey() : null;
        if (k1 !== null && k2 !== null) {
          if (isGreaterKey(k2, k1))
            k2 = null;
          else if (k1 !== k2)
            k1 = null;
        }
        fn(k1 == null ? k2 : k1, k1 != null ? r1 : null, k2 != null ? r2 : null);
        if (k1 != null && hasChild1) {
          hasChild1 = r1.nextSibling();
        }
        if (k2 != null && hasChild2) {
          hasChild2 = r2.nextSibling();
        }
      }
      if (descended1)
        r1.ascend();
      if (descended2)
        r2.ascend();
    }
    exports.eachChildOf = eachChildOf;
  }
});

// node_modules/ot-json1/dist/types.js
var require_types = __commonJS({
  "node_modules/ot-json1/dist/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ConflictType = void 0;
    var ConflictType;
    (function(ConflictType2) {
      ConflictType2[ConflictType2["RM_UNEXPECTED_CONTENT"] = 1] = "RM_UNEXPECTED_CONTENT";
      ConflictType2[ConflictType2["DROP_COLLISION"] = 2] = "DROP_COLLISION";
      ConflictType2[ConflictType2["BLACKHOLE"] = 3] = "BLACKHOLE";
    })(ConflictType = exports.ConflictType || (exports.ConflictType = {}));
  }
});

// node_modules/unicount/index.js
var require_unicount = __commonJS({
  "node_modules/unicount/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.uniToStrPos = exports.strPosToUni = void 0;
    exports.strPosToUni = (s, strOffset = s.length) => {
      let pairs = 0;
      let i = 0;
      for (; i < strOffset; i++) {
        const code = s.charCodeAt(i);
        if (code >= 55296 && code <= 57343) {
          pairs++;
          i++;
        }
      }
      if (i !== strOffset)
        throw Error("Invalid offset - splits unicode bytes");
      return i - pairs;
    };
    exports.uniToStrPos = (s, uniOffset) => {
      let pos = 0;
      for (; uniOffset > 0; uniOffset--) {
        const code = s.charCodeAt(pos);
        pos += code >= 55296 && code <= 57343 ? 2 : 1;
      }
      return pos;
    };
  }
});

// node_modules/ot-text-unicode/dist/type.js
var require_type = __commonJS({
  "node_modules/ot-text-unicode/dist/type.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.uniSlice = exports.dlen = exports.eachOp = void 0;
    var unicount_1 = require_unicount();
    var debugMode = false;
    var checkOp = (op) => {
      if (!Array.isArray(op))
        throw Error("Op must be an array of components");
      let last = null;
      for (let i = 0; i < op.length; i++) {
        const c = op[i];
        switch (typeof c) {
          case "object":
            if (typeof c.d !== "number" && typeof c.d !== "string")
              throw Error("Delete must be number or string");
            if (exports.dlen(c.d) <= 0)
              throw Error("Deletes must not be empty");
            break;
          case "string":
            if (!(c.length > 0))
              throw Error("Inserts cannot be empty");
            break;
          case "number":
            if (!(c > 0))
              throw Error("Skip components must be >0");
            if (typeof last === "number")
              throw Error("Adjacent skip components should be combined");
            break;
        }
        last = c;
      }
      if (typeof last === "number")
        throw Error("Op has a trailing skip");
    };
    function eachOp(op, fn) {
      let prePos = 0, postPos = 0;
      for (let i = 0; i < op.length; i++) {
        const c = op[i];
        fn(c, prePos, postPos);
        switch (typeof c) {
          case "object":
            prePos += exports.dlen(c.d);
            break;
          case "string":
            postPos += unicount_1.strPosToUni(c);
            break;
          case "number":
            prePos += c;
            postPos += c;
            break;
        }
      }
    }
    exports.eachOp = eachOp;
    function mapOp(op, fn) {
      const newOp = [];
      const append = makeAppend(newOp);
      eachOp(op, (c, prePos, postPos) => {
        append(fn(c, prePos, postPos));
      });
      return trim(newOp);
    }
    var id = (x) => x;
    var normalize = (op) => {
      return mapOp(op, id);
    };
    exports.dlen = (d) => typeof d === "number" ? d : unicount_1.strPosToUni(d);
    var makeAppend = (op) => (component) => {
      if (!component || component.d === 0 || component.d === "") {
      } else if (op.length === 0) {
        op.push(component);
      } else if (typeof component === typeof op[op.length - 1]) {
        if (typeof component === "object") {
          const last = op[op.length - 1];
          last.d = typeof last.d === "string" && typeof component.d === "string" ? last.d + component.d : exports.dlen(last.d) + exports.dlen(component.d);
        } else {
          op[op.length - 1] += component;
        }
      } else {
        op.push(component);
      }
    };
    var componentLength = (c) => typeof c === "number" ? c : typeof c === "string" ? unicount_1.strPosToUni(c) : typeof c.d === "number" ? c.d : unicount_1.strPosToUni(c.d);
    exports.uniSlice = (s, startUni, endUni) => {
      const start = unicount_1.uniToStrPos(s, startUni);
      const end = endUni == null ? Infinity : unicount_1.uniToStrPos(s, endUni);
      return s.slice(start, end);
    };
    var dslice = (d, start, end) => typeof d === "number" ? end == null ? d - start : Math.min(d, end) - start : exports.uniSlice(d, start, end);
    var makeTake = (op) => {
      let idx = 0;
      let offset = 0;
      const take = (n, indivisableField) => {
        if (idx === op.length)
          return n === -1 ? null : n;
        const c = op[idx];
        let part;
        if (typeof c === "number") {
          if (n === -1 || c - offset <= n) {
            part = c - offset;
            ++idx;
            offset = 0;
            return part;
          } else {
            offset += n;
            return n;
          }
        } else if (typeof c === "string") {
          if (n === -1 || indivisableField === "i" || unicount_1.strPosToUni(c.slice(offset)) <= n) {
            part = c.slice(offset);
            ++idx;
            offset = 0;
            return part;
          } else {
            const offset2 = offset + unicount_1.uniToStrPos(c.slice(offset), n);
            part = c.slice(offset, offset2);
            offset = offset2;
            return part;
          }
        } else {
          if (n === -1 || indivisableField === "d" || exports.dlen(c.d) - offset <= n) {
            part = { d: dslice(c.d, offset) };
            ++idx;
            offset = 0;
            return part;
          } else {
            let result = dslice(c.d, offset, offset + n);
            offset += n;
            return { d: result };
          }
        }
      };
      const peek = () => op[idx];
      return { take, peek };
    };
    var trim = (op) => {
      if (op.length > 0 && typeof op[op.length - 1] === "number") {
        op.pop();
      }
      return op;
    };
    function transform(op1, op2, side) {
      if (side !== "left" && side !== "right") {
        throw Error("side (" + side + ") must be 'left' or 'right'");
      }
      checkOp(op1);
      checkOp(op2);
      const newOp = [];
      const append = makeAppend(newOp);
      const { take, peek } = makeTake(op1);
      for (let i = 0; i < op2.length; i++) {
        const c2 = op2[i];
        let length, c1;
        switch (typeof c2) {
          case "number":
            length = c2;
            while (length > 0) {
              c1 = take(length, "i");
              append(c1);
              if (typeof c1 !== "string") {
                length -= componentLength(c1);
              }
            }
            break;
          case "string":
            if (side === "left") {
              if (typeof peek() === "string") {
                append(take(-1));
              }
            }
            append(unicount_1.strPosToUni(c2));
            break;
          case "object":
            length = exports.dlen(c2.d);
            while (length > 0) {
              c1 = take(length, "i");
              switch (typeof c1) {
                case "number":
                  length -= c1;
                  break;
                case "string":
                  append(c1);
                  break;
                case "object":
                  length -= exports.dlen(c1.d);
              }
            }
            break;
        }
      }
      let c;
      while (c = take(-1))
        append(c);
      if (debugMode && isInvertible(op1) && isInvertible(op2) && !isInvertible(newOp)) {
        throw Error("Internal error - composed operation should also be invertible");
      }
      return trim(newOp);
    }
    function compose(op1, op2) {
      checkOp(op1);
      checkOp(op2);
      const result = [];
      const append = makeAppend(result);
      const { take } = makeTake(op1);
      for (let i = 0; i < op2.length; i++) {
        const component = op2[i];
        let length, chunk;
        switch (typeof component) {
          case "number":
            length = component;
            while (length > 0) {
              chunk = take(length, "d");
              append(chunk);
              if (typeof chunk !== "object") {
                length -= componentLength(chunk);
              }
            }
            break;
          case "string":
            append(component);
            break;
          case "object":
            length = exports.dlen(component.d);
            let offset = 0;
            while (offset < length) {
              chunk = take(length - offset, "d");
              switch (typeof chunk) {
                case "number":
                  append({ d: dslice(component.d, offset, offset + chunk) });
                  offset += chunk;
                  break;
                case "string":
                  offset += unicount_1.strPosToUni(chunk);
                  break;
                case "object":
                  append(chunk);
              }
            }
            break;
        }
      }
      let c;
      while (c = take(-1))
        append(c);
      if (debugMode && isInvertible(op1) && isInvertible(op2) && !isInvertible(result)) {
        throw Error("Internal error - composed operation should also be invertible");
      }
      return trim(result);
    }
    var transformPosition = (cursor, op) => {
      let pos = 0;
      for (let i = 0; i < op.length && cursor > pos; i++) {
        const c = op[i];
        switch (typeof c) {
          case "number": {
            pos += c;
            break;
          }
          case "string":
            const offset = unicount_1.strPosToUni(c);
            pos += offset;
            cursor += offset;
            break;
          case "object":
            cursor -= Math.min(exports.dlen(c.d), cursor - pos);
            break;
        }
      }
      return cursor;
    };
    var transformSelection = (selection, op) => typeof selection === "number" ? transformPosition(selection, op) : selection.map((s) => transformPosition(s, op));
    function makeInvertible(op, doc, ropeImpl) {
      return mapOp(op, (c, prePos) => typeof c === "object" && typeof c.d === "number" ? { d: ropeImpl.slice(doc, prePos, prePos + c.d) } : c);
    }
    function invert(op) {
      return mapOp(op, (c) => {
        switch (typeof c) {
          case "object":
            if (typeof c.d === "number") {
              throw Error("Cannot invert text op: Deleted characters missing from operation. makeInvertible must be called first.");
            } else
              return c.d;
          // delete -> insert
          case "string":
            return { d: c };
          // Insert -> delete
          case "number":
            return c;
        }
      });
    }
    function stripInvertible(op) {
      return mapOp(op, (c) => typeof c === "object" && typeof c.d === "string" ? { d: unicount_1.strPosToUni(c.d) } : c);
    }
    function isInvertible(op) {
      let invertible = true;
      eachOp(op, (c) => {
        if (typeof c === "object" && typeof c.d === "number")
          invertible = false;
      });
      return invertible;
    }
    function makeType(ropeImpl) {
      return {
        name: "text-unicode",
        uri: "http://sharejs.org/types/text-unicode",
        trim,
        normalize,
        checkOp,
        /** Create a new text snapshot.
         *
         * @param {string} initial - initial snapshot data. Optional. Defaults to ''.
         * @returns {Snap} Initial document snapshot object
         */
        create(initial = "") {
          if (typeof initial !== "string") {
            throw Error("Initial data must be a string");
          }
          return ropeImpl.create(initial);
        },
        /** Apply an operation to a document snapshot
         */
        apply(str, op) {
          checkOp(op);
          const builder = ropeImpl.builder(str);
          for (let i = 0; i < op.length; i++) {
            const component = op[i];
            switch (typeof component) {
              case "number":
                builder.skip(component);
                break;
              case "string":
                builder.append(component);
                break;
              case "object":
                builder.del(exports.dlen(component.d));
                break;
            }
          }
          return builder.build();
        },
        transform,
        compose,
        transformPosition,
        transformSelection,
        isInvertible,
        makeInvertible(op, doc) {
          return makeInvertible(op, doc, ropeImpl);
        },
        stripInvertible,
        invert,
        invertWithDoc(op, doc) {
          return invert(makeInvertible(op, doc, ropeImpl));
        },
        isNoop: (op) => op.length === 0
      };
    }
    exports.default = makeType;
  }
});

// node_modules/ot-text-unicode/dist/api.js
var require_api = __commonJS({
  "node_modules/ot-text-unicode/dist/api.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var type_1 = require_type();
    var unicount_1 = require_unicount();
    function api(getSnapshot, submitOp) {
      return {
        // Returns the text content of the document
        get: getSnapshot,
        // Returns the number of characters in the string
        getLength() {
          return getSnapshot().length;
        },
        // Insert the specified text at the given position in the document
        insert(pos, text, callback) {
          const uniPos = unicount_1.strPosToUni(getSnapshot(), pos);
          return submitOp([uniPos, text], callback);
        },
        remove(pos, lengthOrContent, callback) {
          const uniPos = unicount_1.strPosToUni(getSnapshot(), pos);
          return submitOp([uniPos, { d: lengthOrContent }], callback);
        },
        // When you use this API, you should implement these two methods
        // in your editing context.
        //onInsert: function(pos, text) {},
        //onRemove: function(pos, removedLength) {},
        _onOp(op) {
          type_1.eachOp(op, (component, prePos, postPos) => {
            switch (typeof component) {
              case "string":
                if (this.onInsert)
                  this.onInsert(postPos, component);
                break;
              case "object":
                const dl = type_1.dlen(component.d);
                if (this.onRemove)
                  this.onRemove(postPos, dl);
            }
          });
        },
        onInsert: null,
        onRemove: null
      };
    }
    exports.default = api;
    api.provides = { text: true };
  }
});

// node_modules/ot-text-unicode/dist/index.js
var require_dist = __commonJS({
  "node_modules/ot-text-unicode/dist/index.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.type = exports.remove = exports.insert = void 0;
    var unicount_1 = require_unicount();
    var type_1 = __importStar(require_type());
    var api_1 = __importDefault(require_api());
    var ropeImplUnicodeString = {
      create(s) {
        return s;
      },
      toString(s) {
        return s;
      },
      builder(oldDoc) {
        if (typeof oldDoc !== "string")
          throw Error("Invalid document snapshot: " + oldDoc);
        const newDoc = [];
        return {
          skip(n) {
            let offset = unicount_1.uniToStrPos(oldDoc, n);
            if (offset > oldDoc.length)
              throw Error("The op is too long for this document");
            newDoc.push(oldDoc.slice(0, offset));
            oldDoc = oldDoc.slice(offset);
          },
          append(s) {
            newDoc.push(s);
          },
          del(n) {
            oldDoc = oldDoc.slice(unicount_1.uniToStrPos(oldDoc, n));
          },
          build() {
            return newDoc.join("") + oldDoc;
          }
        };
      },
      slice: type_1.uniSlice
    };
    var textString = type_1.default(ropeImplUnicodeString);
    var type = Object.assign(Object.assign({}, textString), { api: api_1.default });
    exports.type = type;
    exports.insert = (pos, text) => text.length === 0 ? [] : pos === 0 ? [text] : [pos, text];
    exports.remove = (pos, textOrLen) => type_1.dlen(textOrLen) === 0 ? [] : pos === 0 ? [{ d: textOrLen }] : [pos, { d: textOrLen }];
    var type_2 = require_type();
    Object.defineProperty(exports, "makeType", { enumerable: true, get: function() {
      return type_2.default;
    } });
  }
});

// node_modules/ot-json1/dist/json1.release.js
var require_json1_release = __commonJS({
  "node_modules/ot-json1/dist/json1.release.js"(exports) {
    "use strict";
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : {
        default: mod
      };
    };
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), exports.editOp = exports.replaceOp = exports.insertOp = exports.moveOp = exports.removeOp = exports.type = void 0;
    var deepEqual_js_1 = __importDefault(require_deepEqual());
    var deepClone_js_1 = __importDefault(require_deepClone());
    var cursor_js_1 = require_cursor();
    var types_js_1 = require_types();
    var log = () => {
    };
    function assert(pred, msg) {
      if (!pred) throw new Error(msg);
    }
    var debugMode = false;
    exports.type = {
      name: "json1",
      uri: "http://sharejs.org/types/JSONv1",
      readCursor: cursor_js_1.readCursor,
      writeCursor: cursor_js_1.writeCursor,
      create: (data) => data,
      isNoop: (op) => null == op,
      setDebug(val) {
        debugMode = val, log.quiet = !val;
      },
      registerSubtype,
      checkValidOp,
      normalize,
      apply,
      transformPosition,
      compose,
      tryTransform,
      transform,
      makeInvertible,
      invert,
      invertWithDoc,
      RM_UNEXPECTED_CONTENT: types_js_1.ConflictType.RM_UNEXPECTED_CONTENT,
      DROP_COLLISION: types_js_1.ConflictType.DROP_COLLISION,
      BLACKHOLE: types_js_1.ConflictType.BLACKHOLE,
      transformNoConflict: (op1, op2, side) => transformWithConflictsPred(() => true, op1, op2, side),
      typeAllowingConflictsPred: (allowConflict) => Object.assign(Object.assign({}, exports.type), {
        transform: (op1, op2, side) => transformWithConflictsPred(allowConflict, op1, op2, side)
      })
    };
    var getComponent = (r) => r ? r.getComponent() : null;
    function isObject(o) {
      return o && "object" == typeof o && !Array.isArray(o);
    }
    var shallowClone = (obj) => Array.isArray(obj) ? obj.slice() : null !== obj && "object" == typeof obj ? Object.assign({}, obj) : obj;
    var hasPick = (c) => c && (null != c.p || void 0 !== c.r);
    var hasDrop = (c) => c && (null != c.d || void 0 !== c.i);
    function removeChild(container, key) {
      return assert(null != container), "number" == typeof key ? (assert(Array.isArray(container), "Invalid key - child is not an array"), (container = container.slice()).splice(key, 1)) : (assert(isObject(container), "Invalid key - child is not an object"), delete (container = Object.assign({}, container))[key]), container;
    }
    function insertChildMut(container, key, value) {
      return "number" == typeof key ? (assert(null != container, "Container is missing for key"), assert(Array.isArray(container), "Cannot use numerical key for object container"), assert(container.length >= key, "Cannot insert into out of bounds index"), container.splice(key, 0, value)) : (assert(isObject(container), "Cannot insert into missing item"), assert(void 0 === container[key], "Trying to overwrite value at key. Your op needs to remove it first"), container[key] = value), value;
    }
    exports.removeOp = (path, value = true) => cursor_js_1.writeCursor().writeAtPath(path, "r", value).get(), exports.moveOp = (from, to) => cursor_js_1.writeCursor().writeMove(from, to).get(), exports.insertOp = (path, value) => cursor_js_1.writeCursor().writeAtPath(path, "i", value).get(), exports.replaceOp = (path, oldVal, newVal) => cursor_js_1.writeCursor().at(path, (w) => {
      w.write("r", oldVal), w.write("i", newVal);
    }).get(), exports.editOp = (path, type, subOp, preserveNoop = false) => cursor_js_1.writeCursor().at(path, (w) => writeEdit(w, type, subOp, preserveNoop)).get();
    var isValidKey = (container, key) => null != container && ("number" == typeof key ? Array.isArray(container) : "object" == typeof container);
    var maybeGetChild = (container, key) => isValidKey(container, key) ? container[key] : void 0;
    var subtypes = {};
    function registerSubtype(subtype) {
      let _subtype = subtype.type ? subtype.type : subtype;
      _subtype.name && (subtypes[_subtype.name] = _subtype), _subtype.uri && (subtypes[_subtype.uri] = _subtype);
    }
    var typeOrThrow = (name) => {
      const type = subtypes[name];
      if (type) return type;
      throw Error("Missing type: " + name);
    };
    registerSubtype(require_dist());
    var add = (a, b) => a + b;
    registerSubtype({
      name: "number",
      apply: add,
      compose: add,
      invert: (n) => -n,
      transform: (a) => a
    });
    var getEditType = (c) => null == c ? null : c.et ? typeOrThrow(c.et) : c.es ? subtypes["text-unicode"] : null != c.ena ? subtypes.number : null;
    var getEdit = (c) => c.es ? c.es : null != c.ena ? c.ena : c.e;
    var writeEdit = (w, typeOrName, edit, preserveNoop = false) => {
      const [type, name] = "string" == typeof typeOrName ? [typeOrThrow(typeOrName), typeOrName] : [typeOrName, typeOrName.name];
      !preserveNoop && type.isNoop && type.isNoop(edit) || ("number" === name ? w.write("ena", edit) : "text-unicode" === name ? w.write("es", edit) : (w.write("et", name), w.write("e", edit)));
    };
    function checkNonNegInteger(n) {
      assert("number" == typeof n), assert(n >= 0), assert(n === (0 | n));
    }
    function checkScalar(s) {
      "number" == typeof s ? checkNonNegInteger(s) : assert("string" == typeof s);
    }
    function checkValidOp(op) {
      if (null === op) return;
      const pickedSlots = /* @__PURE__ */ new Set(), droppedSlots = /* @__PURE__ */ new Set(), checkComponent = (e) => {
        let empty = true, hasEdit = false;
        for (let k in e) {
          const v = e[k];
          if (empty = false, assert("p" === k || "r" === k || "d" === k || "i" === k || "e" === k || "es" === k || "ena" === k || "et" === k, "Invalid component item '" + k + "'"), "p" === k) checkNonNegInteger(v), assert(!pickedSlots.has(v)), pickedSlots.add(v), assert(void 0 === e.r);
          else if ("d" === k) checkNonNegInteger(v), assert(!droppedSlots.has(v)), droppedSlots.add(v), assert(void 0 === e.i);
          else if ("e" === k || "es" === k || "ena" === k) {
            assert(!hasEdit), hasEdit = true;
            const t = getEditType(e);
            assert(t, "Missing type in edit"), t.checkValidOp && t.checkValidOp(getEdit(e));
          }
        }
        assert(!empty);
      }, checkDescent = (descent, isRoot, removed) => {
        if (!Array.isArray(descent)) throw Error("Op must be null or a list");
        if (0 === descent.length) throw Error("Empty descent");
        isRoot || checkScalar(descent[0]);
        let last = 1, numDescents = 0, lastKey = 0;
        for (let i = 0; i < descent.length; i++) {
          const d = descent[i];
          if (assert(null != d), Array.isArray(d)) {
            const key = checkDescent(d, false, removed);
            if (numDescents) {
              const t1 = typeof lastKey, t2 = typeof key;
              t1 === t2 ? assert(lastKey < key, "descent keys are not in order") : assert("number" === t1 && "string" === t2);
            }
            lastKey = key, numDescents++, last = 3;
          } else "object" == typeof d ? (assert(1 === last, `Prev not scalar - instead ${last}`), checkComponent(d), last = 2) : (assert(3 !== last), checkScalar(d), assert(cursor_js_1.isValidPathItem(d), "Invalid path key"), last = 1);
        }
        return assert(1 !== numDescents, "Operation makes multiple descents. Remove some []"), assert(2 === last || 3 === last), descent[0];
      };
      checkDescent(op, true, false), assert(pickedSlots.size === droppedSlots.size, "Mismatched picks and drops in op");
      for (let i = 0; i < pickedSlots.size; i++) assert(pickedSlots.has(i)), assert(droppedSlots.has(i));
    }
    function normalize(op) {
      let nextSlot = 0, slotMap = [];
      const w = cursor_js_1.writeCursor();
      return w.mergeTree(op, (c, w2) => {
        const t = getEditType(c);
        if (t) {
          const op2 = getEdit(c);
          writeEdit(w2, t, t.normalize ? t.normalize(op2) : op2);
        }
        for (const k of ["r", "p", "i", "d"]) if (void 0 !== c[k]) {
          const r = "p" === k || "d" === k ? (inSlot = c[k], null == slotMap[inSlot] && (slotMap[inSlot] = nextSlot++), slotMap[inSlot]) : c[k];
          w2.write(k, r);
        }
        var inSlot;
      }), w.get();
    }
    function apply(snapshot, op) {
      if (log.quiet = !debugMode, checkValidOp(op), null === op) return snapshot;
      const held = [];
      return function drop(root, descent) {
        let subDoc = root, i = 0, rootContainer = {
          root
        }, m = 0, container = rootContainer, key = "root";
        function mut() {
          for (; m < i; m++) {
            let d = descent[m];
            "object" != typeof d && (assert(isValidKey(container, key)), container = container[key] = shallowClone(container[key]), key = d);
          }
        }
        for (; i < descent.length; i++) {
          const d = descent[i];
          if (Array.isArray(d)) {
            const child = drop(subDoc, d);
            child !== subDoc && void 0 !== child && (mut(), subDoc = container[key] = child);
          } else if ("object" == typeof d) {
            null != d.d ? (mut(), subDoc = insertChildMut(container, key, held[d.d])) : void 0 !== d.i && (mut(), subDoc = insertChildMut(container, key, d.i));
            const t = getEditType(d);
            if (t) mut(), subDoc = container[key] = t.apply(subDoc, getEdit(d));
            else if (void 0 !== d.e) throw Error("Subtype " + d.et + " undefined");
          } else subDoc = maybeGetChild(subDoc, d);
        }
        return rootContainer.root;
      }(snapshot = function pick(subDoc, descent) {
        const stack = [];
        let i = 0;
        for (; i < descent.length; i++) {
          const d = descent[i];
          if (Array.isArray(d)) break;
          "object" != typeof d && (stack.push(subDoc), subDoc = maybeGetChild(subDoc, d));
        }
        for (let j = descent.length - 1; j >= i; j--) subDoc = pick(subDoc, descent[j]);
        for (--i; i >= 0; i--) {
          const d = descent[i];
          if ("object" != typeof d) {
            const container = stack.pop();
            subDoc = subDoc === maybeGetChild(container, d) ? container : void 0 === subDoc ? removeChild(container, d) : (k = d, v = subDoc, (obj = shallowClone(obj = container))[k] = v, obj);
          } else hasPick(d) && (assert(void 0 !== subDoc, "Cannot pick up or remove undefined"), null != d.p && (held[d.p] = subDoc), subDoc = void 0);
        }
        var obj, k, v;
        return subDoc;
      }(snapshot, op), op);
    }
    function transformPosition(path, op) {
      path = path.slice(), checkValidOp(op);
      const r = cursor_js_1.readCursor(op);
      let pickedAtSlot, pickIndex, removed = false;
      const advStack = [];
      for (let i = 0; ; i++) {
        const k = path[i], c = r.getComponent();
        if (c && (void 0 !== c.r ? removed = true : null != c.p && (removed = false, pickedAtSlot = c.p, pickIndex = i)), i >= path.length) break;
        let pickOffset = 0;
        const pickAdv = cursor_js_1.advancer(r, void 0, (k2, c2) => {
          hasPick(c2) && pickOffset++;
        });
        advStack.unshift(pickAdv);
        const hasNext = pickAdv(k);
        if ("number" == typeof k && (path[i] -= pickOffset), !hasNext) break;
      }
      if (advStack.forEach((pickAdv) => pickAdv.end()), removed) return null;
      const handleDrop = () => {
        let i = 0;
        if (null != pickedAtSlot) {
          const rPath = r.getPath();
          i = rPath.length, path = rPath.concat(path.slice(pickIndex));
        }
        for (; i < path.length; i++) {
          const k = path[i], c = getComponent(r), et = getEditType(c);
          if (et) {
            const e = getEdit(c);
            et.transformPosition && (path[i] = et.transformPosition(path[i], e));
            break;
          }
          let dropOffset = 0;
          const hasNext = cursor_js_1.advancer(r, (k2, c2) => hasDrop(c2) ? ~(k2 - dropOffset) : k2 - dropOffset, (k2, c2) => {
            hasDrop(c2) && dropOffset++;
          })(k);
          if ("number" == typeof k && (path[i] += dropOffset), !hasNext) break;
        }
      };
      return null != pickedAtSlot ? r.eachDrop(null, (slot) => {
        slot === pickedAtSlot && handleDrop();
      }) : handleDrop(), path;
    }
    function compose(op1, op2) {
      if (checkValidOp(op1), checkValidOp(op2), null == op1) return op2;
      if (null == op2) return op1;
      let nextSlot = 0;
      const r1 = cursor_js_1.readCursor(op1), r2 = cursor_js_1.readCursor(op2), w = cursor_js_1.writeCursor(), heldPickWrites = [], heldDropWrites = [], held1Pick = [], held2Drop = [], p1SlotMap = [], p2SlotMap = [], visitedOp2EditCs = /* @__PURE__ */ new Set();
      r1.traverse(null, (c) => {
        null != c.p && (held1Pick[c.p] = r1.clone());
      }), r2.traverse(null, (c) => {
        null != c.d && (held2Drop[c.d] = r2.clone());
      });
      const w2 = cursor_js_1.writeCursor();
      return function xfBoundary(r1Pick, r1Drop, r2Pick, r2Drop, litIn, rmParent, wd, wp) {
        assert(r1Drop || r2Pick);
        const c1d = getComponent(r1Drop), c2p = getComponent(r2Pick), rmHere = !!c2p && void 0 !== c2p.r, insHere = !!c1d && void 0 !== c1d.i, drop1Slot = c1d ? c1d.d : null, pick2Slot = c2p ? c2p.p : null, rmChildren = (rmParent || rmHere) && null == pick2Slot;
        if (null != pick2Slot) r2Drop = held2Drop[pick2Slot], wd = heldDropWrites[pick2Slot] = new cursor_js_1.WriteCursor();
        else if (c2p && void 0 !== c2p.r) r2Drop = null;
        else {
          const c2d2 = getComponent(r2Drop);
          c2d2 && null != c2d2.d && (r2Drop = null);
        }
        const c2d = getComponent(r2Drop);
        if (null != drop1Slot) if (r1Pick = held1Pick[drop1Slot], wp = heldPickWrites[drop1Slot] = new cursor_js_1.WriteCursor(), rmChildren) rmParent && !rmHere && wp.write("r", true);
        else {
          const slot = p1SlotMap[drop1Slot] = nextSlot++;
          wd.write("d", slot);
        }
        else if (c1d && void 0 !== c1d.i) r1Pick = null;
        else {
          const c1p = getComponent(r1Pick);
          c1p && null != c1p.p && (r1Pick = null);
        }
        let litOut;
        insHere ? (assert(void 0 === litIn), litOut = c1d.i) : litOut = litIn;
        const insComponent = (null == pick2Slot ? !insHere || rmParent || rmHere : void 0 === litOut) ? null : wd.getComponent();
        if (null != pick2Slot) if (void 0 !== litIn || insHere) ;
        else {
          const slot = null != drop1Slot ? p1SlotMap[drop1Slot] : nextSlot++;
          p2SlotMap[pick2Slot] = slot, wp.write("p", slot);
        }
        else rmHere && (insHere || void 0 !== litIn || (c2p.r, wp.write("r", c2p.r)));
        const type1 = rmChildren ? null : getEditType(c1d), type2 = getEditType(c2d);
        if ((type1 || type2) && (type1 && type1.name, type2 && type2.name), type1 && type2) {
          assert(type1 === type2);
          const e1 = getEdit(c1d), e2 = getEdit(c2d), r = type1.compose(e1, e2);
          writeEdit(wd, type1, r), visitedOp2EditCs.add(c2d);
        } else type1 ? writeEdit(wd, type1, getEdit(c1d)) : type2 && (writeEdit(wd, type2, getEdit(c2d)), visitedOp2EditCs.add(c2d));
        const hasContainerLiteral = "object" == typeof litOut && null != litOut;
        let isCloned = false, p1PickOff = 0, p1DropOff = 0, p2PickOff = 0, p2DropOff = 0, litOff = 0;
        const p2DropAdv = cursor_js_1.advancer(r2Drop, (k, c) => hasDrop(c) ? p2DropOff - k - 1 : k - p2DropOff, (k, c) => {
          hasDrop(c) && p2DropOff++;
        }), p1PickAdv = cursor_js_1.advancer(r1Pick, (k, c) => hasPick(c) ? p1PickOff - k - 1 : k - p1PickOff, (k, c) => {
          hasPick(c) && p1PickOff++;
        });
        if (cursor_js_1.eachChildOf(r1Drop, r2Pick, (inKey, _p1Drop, _p2Pick) => {
          let _p1Pick, _p2Drop, p1PickKey = inKey, p2DropKey = inKey, litKey = inKey;
          if ("number" == typeof inKey) {
            let p2Mid = inKey + p2PickOff;
            _p2Drop = p2DropAdv(p2Mid), p2DropKey = p2Mid + p2DropOff;
            let p1Mid = inKey + p1DropOff;
            _p1Pick = p1PickAdv(p1Mid), hasDrop(getComponent(_p2Drop)) && (_p1Pick = null), p1PickKey = p1Mid + p1PickOff, litKey = inKey + litOff, assert(p1PickKey >= 0, "p1PickKey is negative"), assert(p2DropKey >= 0, "p2DropKey is negative");
            const hd1 = hasDrop(getComponent(_p1Drop)), hp2 = hasPick(getComponent(_p2Pick));
            (hd1 || hp2 && !rmChildren) && litOff--, hd1 && p1DropOff--, hp2 && p2PickOff--;
          } else _p1Pick = p1PickAdv(inKey), _p2Drop = p2DropAdv(inKey);
          wp.descend(p1PickKey), wd.descend(p2DropKey);
          const _lit = hasContainerLiteral && !hasDrop(getComponent(_p1Drop)) ? litOut[litKey] : void 0, _litResult = xfBoundary(_p1Pick, _p1Drop, _p2Pick, _p2Drop, _lit, rmChildren, wd, wp);
          var container, key, child;
          hasContainerLiteral && !rmChildren ? _lit !== _litResult && (isCloned || (litOut = Array.isArray(litOut) ? litOut.slice() : Object.assign({}, litOut), isCloned = true), container = litOut, child = _litResult, "number" == typeof (key = litKey) ? (assert(Array.isArray(container)), assert(key < container.length)) : (assert(!Array.isArray(container)), assert(void 0 !== container[key])), void 0 === child ? "number" == typeof key ? container.splice(key, 1) : delete container[key] : container[key] = child) : assert(void 0 === _litResult), wd.ascend(), wp.ascend();
        }), p1PickAdv.end(), p2DropAdv.end(), null != insComponent) insComponent.i = litOut;
        else if (!rmParent && !rmHere && null == pick2Slot) return litOut;
      }(r1, r1.clone(), r2, r2.clone(), void 0, false, w, w2), w.reset(), w.mergeTree(w2.get()), w.reset(), w.get(), heldPickWrites.map((w3) => w3.get()), heldDropWrites.map((w3) => w3.get()), r1.traverse(w, (c, w3) => {
        const slot1 = c.p;
        if (null != slot1) {
          const slot = p1SlotMap[slot1];
          null != slot && w3.write("p", slot);
          const _w = heldPickWrites[slot1];
          _w && _w.get(), _w && w3.mergeTree(_w.get());
        } else void 0 !== c.r && w3.write("r", c.r);
      }), w.reset(), w.get(), r2.traverse(w, (c, w3) => {
        const slot2 = c.d;
        if (null != slot2) {
          const slot = p2SlotMap[slot2];
          null != slot && w3.write("d", slot);
          const _w = heldDropWrites[slot2];
          _w && w3.mergeTree(_w.get());
        } else void 0 !== c.i && w3.write("i", c.i);
        const t = getEditType(c);
        t && !visitedOp2EditCs.has(c) && writeEdit(w3, t, getEdit(c));
      }), w.get();
    }
    function invert(op) {
      if (null == op) return null;
      const r = new cursor_js_1.ReadCursor(op), w = new cursor_js_1.WriteCursor();
      let editsToTransform;
      const heldPick = [], heldWrites = [];
      return function invertSimple(r2, w2, subDoc) {
        const c = r2.getComponent();
        let insertHere, subdocModified = false;
        if (c) {
          null != c.p && (w2.write("d", c.p), heldPick[c.p] = r2.clone()), void 0 !== c.r && w2.write("i", c.r), null != c.d && (w2.write("p", c.d), subDoc = void 0), void 0 !== c.i && (subDoc = insertHere = c.i);
          const t = getEditType(c);
          t && (void 0 === subDoc ? (editsToTransform || (editsToTransform = /* @__PURE__ */ new Set()), editsToTransform.add(c)) : (getEdit(c), subDoc = t.apply(subDoc, getEdit(c)), subdocModified = true));
        }
        let dropOff = 0;
        for (const key of r2) {
          w2.descend(key);
          const raw = "number" == typeof key ? key - dropOff : key, childIn = maybeGetChild(subDoc, raw);
          hasDrop(r2.getComponent()) && dropOff++;
          const childOut = invertSimple(r2, w2, childIn);
          if (void 0 !== subDoc && void 0 !== childOut) {
            if (subdocModified || (subdocModified = true, subDoc = shallowClone(subDoc)), !isValidKey(subDoc, raw)) throw Error("Cannot modify child - invalid operation");
            subDoc[raw] = childOut;
          }
          w2.ascend();
        }
        if (void 0 === insertHere) return subdocModified ? subDoc : void 0;
        w2.write("r", subDoc);
      }(r, w, void 0), editsToTransform && (w.reset(), function transformEdits(rPick, rDrop, w2) {
        const cd = rDrop.getComponent();
        if (cd) {
          const dropSlot = cd.d;
          if (null != dropSlot && (rPick = heldPick[dropSlot], w2 = heldWrites[dropSlot] = cursor_js_1.writeCursor()), editsToTransform.has(cd)) {
            const t = getEditType(cd);
            if (!t.invert) throw Error(`Cannot invert subtype ${t.name}`);
            writeEdit(w2, t, t.invert(getEdit(cd)));
          }
        }
        let pickOff = 0, dropOff = 0;
        const ap = cursor_js_1.advancer(rPick, (k, c) => hasPick(c) ? pickOff - k - 1 : k - pickOff, (k, c) => {
          hasPick(c) && pickOff++;
        });
        for (const key of rDrop) if ("number" == typeof key) {
          const mid = key - dropOff, _rPick = ap(mid), raw = mid + pickOff;
          w2.descend(raw), transformEdits(_rPick, rDrop, w2), hasDrop(rDrop.getComponent()) && dropOff++, w2.ascend();
        } else w2.descend(key), transformEdits(ap(key), rDrop, w2), w2.ascend();
        ap.end();
      }(r.clone(), r, w), heldWrites.length && (w.reset(), r.traverse(w, (c, w2) => {
        const slot = c.p;
        if (null != slot) {
          const _w = heldWrites[slot];
          _w && _w.get(), _w && w2.mergeTree(_w.get());
        }
      }))), w.get();
    }
    var anyComponent = (op, fn) => op.some((c) => "object" == typeof c && (Array.isArray(c) ? anyComponent(c, fn) : fn(c)));
    function makeInvertible(op, doc) {
      if (null == op || !anyComponent(op, (c) => {
        var _a;
        return void 0 !== c.r || null != (null === (_a = getEditType(c)) || void 0 === _a ? void 0 : _a.makeInvertible);
      })) return op;
      const r = new cursor_js_1.ReadCursor(op), w = new cursor_js_1.WriteCursor();
      let hasEdits = false;
      const heldPick = [], heldDoc = [], traversePick = (r2, w2, subDoc) => {
        const c = r2.getComponent();
        let modified = false;
        if (c) {
          null != c.d && w2.write("d", c.d), void 0 !== c.i && w2.write("i", c.i);
          const pickSlot = c.p;
          if (null != pickSlot && (heldPick[pickSlot] = r2.clone(), assert(void 0 !== subDoc, "Operation picks up at an invalid key"), heldDoc[pickSlot] = subDoc, w2.write("p", c.p)), void 0 !== c.r && void 0 === subDoc) throw Error("Invalid doc / op in makeInvertible: removed item missing from doc");
          const t = getEditType(c);
          t && (t.makeInvertible ? hasEdits = true : writeEdit(w2, t, getEdit(c), true));
        }
        let listOff = 0;
        for (const key of r2) {
          w2.descend(key);
          const keyRaw = "number" == typeof key ? key - listOff : key, childIn = maybeGetChild(subDoc, keyRaw), childOut = traversePick(r2, w2, childIn);
          childIn !== childOut && (modified || (modified = true, subDoc = shallowClone(subDoc)), void 0 === childOut ? (subDoc = removeChild(subDoc, keyRaw), "number" == typeof key && listOff++) : subDoc[keyRaw] = childOut), w2.ascend();
        }
        return c && (void 0 !== c.r ? (w2.write("r", deepClone_js_1.default(subDoc)), subDoc = void 0) : null != c.p && (subDoc = void 0)), subDoc;
      };
      return traversePick(r, w, doc), w.get(), hasEdits && (w.reset(), function traverseDrop(rPick, rDrop, w2, subDoc, isLiteral) {
        const c = rDrop.getComponent();
        if (c) {
          void 0 !== c.i ? (subDoc = c.i, isLiteral = true) : null != c.d && (subDoc = heldDoc[c.d], rPick = heldPick[c.d], isLiteral = false, c.d);
          let t = getEditType(c);
          if (t && t.makeInvertible) {
            const edit = getEdit(c);
            writeEdit(w2, t, t.makeInvertible(edit, subDoc), true);
          }
        }
        let pickOff = 0, dropOff = 0;
        const ap = cursor_js_1.advancer(rPick, (k, c2) => hasPick(c2) ? pickOff - k - 1 : k - pickOff, (k, c2) => {
          hasPick(c2) && pickOff++;
        });
        for (const key of rDrop) if ("number" == typeof key) {
          const mid = key - dropOff, _rPick = ap(mid), raw = mid + pickOff, child = maybeGetChild(subDoc, isLiteral ? mid : raw);
          w2.descend(key), traverseDrop(_rPick, rDrop, w2, child, isLiteral), hasDrop(rDrop.getComponent()) && dropOff++, w2.ascend();
        } else {
          const child = maybeGetChild(subDoc, key);
          w2.descend(key), traverseDrop(ap(key), rDrop, w2, child, isLiteral), w2.ascend();
        }
        ap.end();
      }(r.clone(), r, w, doc, false)), w.get();
    }
    function invertWithDoc(op, doc) {
      return invert(makeInvertible(op, doc));
    }
    var shallowCloneOp = (op) => {
      if (null == op) return null;
      const result = op.slice();
      for (let i = 0; i < op.length; i++) {
        const c = result[i];
        Array.isArray(c) && (result[i] = shallowCloneOp(c));
      }
      return result;
    };
    function tryTransform(op1, op2, direction) {
      assert("left" === direction || "right" === direction, "Direction must be left or right");
      const side = "left" === direction ? 0 : 1;
      if (log.quiet = !debugMode, log.prefix = 0, null == op2) return {
        ok: true,
        result: op1
      };
      checkValidOp(op1), checkValidOp(op2);
      let conflict = null;
      const heldOp1PickByOp1 = [], heldOp1DropByOp1 = [], heldOp2PickByOp2 = [], heldOp2DropByOp2 = [], heldOp1PickByOp2 = [], heldOp2PickByOp1 = [], heldOp2DropByOp1 = [], heldOp2RmForOp1 = [], heldOp1RmForOp2 = [], cancelledOp2 = [], discardedOp2Drop = [], heldPickWrites = [], heldDropWrites = [], op1PickAtOp2Pick = [], op1PicksOp2DropSlots = [];
      let nextSlot = 0;
      const r1 = cursor_js_1.readCursor(op1), r2 = cursor_js_1.readCursor(op2), w = cursor_js_1.writeCursor();
      if (function scanOp2Pick(r2Pick, r1Pick = null, removed1) {
        const c1 = getComponent(r1Pick);
        c1 && (void 0 !== c1.r ? removed1 = r1Pick.clone() : null != c1.p && (removed1 = null, heldOp2PickByOp1[c1.p] = r2Pick.clone()));
        const c2 = r2Pick.getComponent();
        let slot2;
        c2 && null != (slot2 = c2.p) && (heldOp1PickByOp2[slot2] = r1Pick ? r1Pick.clone() : null, heldOp2PickByOp2[slot2] = r2Pick.clone(), removed1 && (cancelledOp2[slot2] = true, heldOp1RmForOp2[slot2] = removed1), c1 && null != c1.p && (op1PickAtOp2Pick[slot2] = c1.p));
        const ap1 = cursor_js_1.advancer(r1Pick);
        for (const key of r2Pick) scanOp2Pick(r2Pick, ap1(key), removed1);
        ap1.end();
      }(r2, r1, null), function scanOp2Drop(r1Pick, r2Pick, r2Drop, pickSlot1, removed1) {
        const c2d = r2Drop.getComponent();
        let slot2, droppedHere = false;
        c2d && (null != (slot2 = c2d.d) ? (heldOp2DropByOp2[slot2] = r2Drop.clone(), null != pickSlot1 && (null == op1PicksOp2DropSlots[pickSlot1] && (op1PicksOp2DropSlots[pickSlot1] = []), op1PicksOp2DropSlots[pickSlot1].push(slot2)), cancelledOp2[slot2], r1Pick = heldOp1PickByOp2[slot2] || null, r2Pick = heldOp2PickByOp2[slot2] || null, cancelledOp2[slot2] ? (removed1 && (discardedOp2Drop[slot2] = true), removed1 = heldOp1RmForOp2[slot2] || null) : !removed1 || 1 !== side && null != op1PickAtOp2Pick[slot2] || null == conflict && (conflict = {
          type: types_js_1.ConflictType.RM_UNEXPECTED_CONTENT,
          op1: exports.removeOp(removed1.getPath()),
          op2: exports.moveOp(r2Pick.getPath(), r2Drop.getPath())
        }), droppedHere = true) : void 0 !== c2d.i && (r1Pick = r2Pick = null, droppedHere = true, removed1 && null == conflict && (conflict = {
          type: types_js_1.ConflictType.RM_UNEXPECTED_CONTENT,
          op1: exports.removeOp(removed1.getPath()),
          op2: exports.insertOp(r2Drop.getPath(), c2d.i)
        })));
        const c1p = getComponent(r1Pick);
        c1p && (void 0 !== c1p.r ? removed1 = r1Pick.clone() : null != c1p.p && (c1p.p, pickSlot1 = c1p.p, removed1 = null));
        const t2 = getEditType(c2d);
        t2 && removed1 && null == conflict && (conflict = {
          type: types_js_1.ConflictType.RM_UNEXPECTED_CONTENT,
          op1: exports.removeOp(removed1.getPath()),
          op2: exports.editOp(r2Drop.getPath(), t2, getEdit(c2d), true)
        });
        let p2PickOff = 0, p2DropOff = 0;
        const ap2 = cursor_js_1.advancer(r2Pick, (k, c) => hasPick(c) ? p2PickOff - k - 1 : k - p2PickOff, (k, c) => {
          hasPick(c) && p2PickOff++;
        }), ap1 = cursor_js_1.advancer(r1Pick);
        for (const key of r2Drop) if ("number" == typeof key) {
          const p2Mid = key - p2DropOff, _p2Pick = ap2(p2Mid);
          p2DropOff += +scanOp2Drop(ap1(p2Mid + p2PickOff), _p2Pick, r2Drop, pickSlot1, removed1);
        } else {
          const _p2Pick = ap2(key);
          scanOp2Drop(ap1(key), _p2Pick, r2Drop, pickSlot1, removed1);
        }
        return ap2.end(), ap1.end(), droppedHere;
      }(r1, r2, r2.clone(), null, null), heldOp2DropByOp2.map((x) => x && x.get()), conflict) return {
        ok: false,
        conflict
      };
      discardedOp2Drop.map((x) => !!x);
      const pickComponents = [];
      let cancelledRemoves = null;
      !function writeOp1Pick(r1Pick, r2Pick, r2Drop, w2, removed2) {
        let iAmMoved = false;
        const c2p = getComponent(r2Pick);
        if (hasPick(c2p)) {
          const slot2 = c2p.p;
          null != slot2 ? (r2Drop = heldOp2DropByOp2[slot2], w2 = heldPickWrites[slot2] = cursor_js_1.writeCursor(), iAmMoved = true, removed2 = null) : (r2Drop = null, removed2 = r2Pick.clone());
        } else hasDrop(getComponent(r2Drop)) && (r2Drop = null);
        const c1 = r1Pick.getComponent();
        if (c1) {
          const slot1 = c1.p;
          null != slot1 ? (removed2 && (heldOp2RmForOp1[slot1] = removed2), pickComponents[slot1] = removed2 || 1 === side && iAmMoved ? null : w2.getComponent(), heldOp1PickByOp1[slot1] = r1Pick.clone(), r2Drop && (heldOp2DropByOp1[slot1] = r2Drop.clone())) : void 0 !== c1.r && (removed2 || w2.write("r", true), (removed2 || iAmMoved) && (null == cancelledRemoves && (cancelledRemoves = /* @__PURE__ */ new Set()), cancelledRemoves.add(c1)));
        }
        let p2PickOff = 0, p2DropOff = 0;
        const ap2Pick = cursor_js_1.advancer(r2Pick, void 0, (k, c) => {
          hasPick(c) && p2PickOff++;
        }), ap2Drop = cursor_js_1.advancer(r2Drop, (k, c) => hasDrop(c) ? ~(k - p2DropOff) : k - p2DropOff, (k, c) => {
          hasDrop(c) && p2DropOff++;
        });
        if (r1Pick) for (const key of r1Pick) if ("string" == typeof key) {
          const p2Pick_ = ap2Pick(key), p2Drop_ = ap2Drop(key);
          w2.descend(key), writeOp1Pick(r1Pick, p2Pick_, p2Drop_, w2, removed2), w2.ascend();
        } else {
          const p2Pick_ = ap2Pick(key), p2Mid = key - p2PickOff, p2Drop_ = hasPick(getComponent(p2Pick_)) ? null : ap2Drop(p2Mid), finalKey = p2Mid + p2DropOff;
          assert(finalKey >= 0), w2.descend(finalKey), writeOp1Pick(r1Pick, p2Pick_, p2Drop_, w2, removed2), w2.ascend();
        }
        ap2Pick.end(), ap2Drop.end();
      }(r1, r2, r2.clone(), w, null), w.reset();
      let outputSlotMap = [];
      if (function writeOp1Drop(p1Pick, p1Drop, p2Pick, p2Drop, w2, removed2) {
        assert(p1Drop);
        const c1d = p1Drop.getComponent();
        let c2d = getComponent(p2Drop), droppedHere = false;
        const insOrMv = (r12, r22, c) => r12 ? exports.moveOp(r12.getPath(), r22.getPath()) : exports.insertOp(r22.getPath(), c.i);
        if (hasDrop(c1d)) {
          const slot1 = c1d.d;
          null != slot1 && (heldOp1DropByOp1[slot1] = p1Drop.clone());
          const pc = null != slot1 ? pickComponents[slot1] : null;
          let identical = false;
          if (void 0 !== c1d.i || null != slot1 && pc) {
            let slot2;
            c2d && (void 0 !== c2d.i || null != (slot2 = c2d.d) && !cancelledOp2[slot2]) && (identical = null != slot2 ? null != slot1 && slot1 === op1PickAtOp2Pick[slot2] : deepEqual_js_1.default(c2d.i, c1d.i), identical || null != slot2 && 1 !== side && null != op1PickAtOp2Pick[slot2] || null == conflict && (conflict = {
              type: types_js_1.ConflictType.DROP_COLLISION,
              op1: insOrMv(null != slot1 ? heldOp1PickByOp1[slot1] : null, p1Drop, c1d),
              op2: insOrMv(null != slot2 ? heldOp2PickByOp2[slot2] : null, p2Drop, c2d)
            })), identical || (removed2 ? null == conflict && (conflict = {
              type: types_js_1.ConflictType.RM_UNEXPECTED_CONTENT,
              op1: insOrMv(null != slot1 ? heldOp1PickByOp1[slot1] : null, p1Drop, c1d),
              op2: exports.removeOp(removed2.getPath())
            }) : (null != slot1 ? (outputSlotMap[nextSlot] = slot1, w2.write("d", pc.p = nextSlot++)) : w2.write("i", deepClone_js_1.default(c1d.i)), droppedHere = true));
          } else if (null != slot1 && !pc) {
            const h = heldOp2RmForOp1[slot1];
            h && (removed2 = h.clone());
          }
          null != slot1 ? (p1Pick = heldOp1PickByOp1[slot1], p2Pick = heldOp2PickByOp1[slot1], p2Drop = heldOp2DropByOp1[slot1]) : void 0 !== c1d.i && (p1Pick = p2Pick = null, identical || (p2Drop = null));
        } else hasPick(getComponent(p1Pick)) && (p1Pick = p2Pick = p2Drop = null);
        const c1p = getComponent(p1Pick), c2p = getComponent(p2Pick);
        if (hasPick(c2p)) {
          const slot2 = c2p.p;
          void 0 !== c2p.r && (!c1p || void 0 === c1p.r) || cancelledOp2[slot2] ? (p2Drop = null, removed2 = p2Pick.clone()) : null != slot2 && (p2Drop = heldOp2DropByOp2[slot2], 1 !== side && null != op1PickAtOp2Pick[slot2] || ((w2 = heldDropWrites[slot2]) || (w2 = heldDropWrites[slot2] = cursor_js_1.writeCursor()), w2.reset(), removed2 = null));
        } else !hasDrop(c1d) && hasDrop(c2d) && (p2Drop = null);
        c2d = null != p2Drop ? p2Drop.getComponent() : null;
        const t1 = getEditType(c1d);
        if (t1) {
          const e1 = getEdit(c1d);
          if (removed2) null == conflict && (conflict = {
            type: types_js_1.ConflictType.RM_UNEXPECTED_CONTENT,
            op1: exports.editOp(p1Drop.getPath(), t1, e1, true),
            op2: exports.removeOp(removed2.getPath())
          });
          else {
            const t2 = getEditType(c2d);
            let e;
            if (t2) {
              if (t1 !== t2) throw Error("Transforming incompatible types");
              const e2 = getEdit(c2d);
              e = t1.transform(e1, e2, direction);
            } else e = deepClone_js_1.default(e1);
            writeEdit(w2, t1, e);
          }
        }
        let p1PickOff = 0, p1DropOff = 0, p2PickOff = 0, p2DropOff = 0, outPickOff = 0, outDropOff = 0, p1pValid = null != p1Pick && p1Pick.descendFirst(), p1pDidDescend = p1pValid;
        const ap2p = cursor_js_1.advancer(p2Pick, void 0, (k, c) => {
          hasPick(c) && p2PickOff++;
        });
        let p2dValid = null != p2Drop && p2Drop.descendFirst(), p2dDidDescend = p2dValid;
        for (const key of p1Drop) if ("number" == typeof key) {
          let _p1Pick;
          const hd1 = hasDrop(p1Drop.getComponent()), k1Mid = key - p1DropOff;
          {
            let p1k;
            for (; p1pValid && "number" == typeof (p1k = p1Pick.getKey()); ) {
              p1k += p1PickOff;
              const c = p1Pick.getComponent(), hp = hasPick(c);
              if (p1k > k1Mid || p1k === k1Mid && (!hp || 0 === side && hd1)) break;
              if (hp) {
                p1PickOff--;
                const slot1 = c.p;
                pickComponents[slot1], op1PickAtOp2Pick.includes(slot1), c.d, getComponent(heldDropWrites[c.d]), hasPick(getComponent(heldDropWrites[c.d])), (void 0 === c.r || cancelledRemoves && cancelledRemoves.has(c)) && (null == slot1 || !pickComponents[slot1] || 1 !== side && op1PickAtOp2Pick.includes(slot1)) || outPickOff--;
              }
              p1pValid = p1Pick.nextSibling();
            }
            _p1Pick = p1pValid && p1k === k1Mid ? p1Pick : null;
          }
          const raw = k1Mid - p1PickOff;
          let _p2Pick = ap2p(raw);
          const k2Mid = raw - p2PickOff;
          let _p2Drop = null;
          {
            let p2dk, op2Mid;
            for (; p2dValid && "number" == typeof (p2dk = p2Drop.getKey()); ) {
              op2Mid = p2dk - p2DropOff;
              const c = p2Drop.getComponent(), hd2 = hasDrop(c);
              if (op2Mid > k2Mid) break;
              if (op2Mid === k2Mid) {
                if (!hd2) {
                  _p2Drop = p2Drop;
                  break;
                }
                {
                  if (0 === side && hd1) {
                    _p2Drop = p2Drop;
                    break;
                  }
                  const hp2 = _p2Pick && hasPick(_p2Pick.getComponent());
                  if (0 === side && hp2) break;
                }
              }
              if (hd2) {
                const slot2 = c.d;
                cancelledOp2[slot2], op1PickAtOp2Pick[slot2], void 0 === c.i && (cancelledOp2[slot2] || null != op1PickAtOp2Pick[slot2] && 1 !== side) ? (cancelledOp2[slot2] || null != op1PickAtOp2Pick[slot2] && 0 === side) && (p2DropOff++, outDropOff--) : p2DropOff++;
              }
              p2dValid = p2Drop.nextSibling();
            }
          }
          const descend = k2Mid + p2DropOff + outPickOff + outDropOff;
          assert(descend >= 0, "trying to descend to a negative index"), w2.descend(descend), hd1 && (_p1Pick = _p2Pick = _p2Drop = null, p1DropOff++), writeOp1Drop(_p1Pick, p1Drop, _p2Pick, _p2Drop, w2, removed2) && outDropOff++, w2.ascend();
        } else {
          let p1k;
          for (; p1pValid && (p1k = p1Pick.getKey(), "string" != typeof p1k || !(p1k > key || p1k === key)); ) p1pValid = p1Pick.nextSibling();
          const _p1Pick = p1pValid && p1k === key ? p1Pick : null, _p2Pick = ap2p(key);
          let p2dk;
          for (; p2dValid && (p2dk = p2Drop.getKey(), "string" != typeof p2dk || !(p2dk > key || p2dk === key)); ) p2dValid = p2Drop.nextSibling();
          const _p2Drop = p2dValid && p2dk === key ? p2Drop : null;
          w2.descend(key), writeOp1Drop(_p1Pick, p1Drop, _p2Pick, _p2Drop, w2, removed2), w2.ascend();
        }
        return ap2p.end(), p1pDidDescend && p1Pick.ascend(), p2dDidDescend && p2Drop.ascend(), droppedHere;
      }(r1, r1.clone(), r2, r2.clone(), w, null), conflict) return {
        ok: false,
        conflict
      };
      w.reset();
      const eachDrop = (r, w2, fn) => r.traverse(w2, (c, w3) => {
        null != c.d && fn(c.d, r, w3);
      });
      (cancelledOp2.length || heldPickWrites.length) && (eachDrop(r2, w, (slot2, r, w2) => {
        cancelledOp2[slot2] && !discardedOp2Drop[slot2] && w2.write("r", true), heldPickWrites[slot2] && w2.mergeTree(heldPickWrites[slot2].get());
      }), w.reset());
      const heldOutDropRead = [], heldOutDropWrites = [];
      if ((heldDropWrites.length || cancelledOp2.length) && !conflict) {
        const rOut = cursor_js_1.readCursor(shallowCloneOp(w.get()));
        if (eachDrop(rOut, null, (slotOut, r) => {
          heldOutDropRead[slotOut] = r.clone();
        }), heldDropWrites.forEach((hdw) => {
          hdw && eachDrop(cursor_js_1.readCursor(hdw.get()), null, (slotOut, r) => {
            heldOutDropRead[slotOut] = r.clone();
          });
        }), function writeHeldOp2Drop(p2Drop, outPick, outDrop, w2, parentC, removedOut) {
          log.prefix++;
          const coutp = getComponent(outPick);
          if (coutp && hasPick(coutp)) if (null != coutp.p) {
            parentC = coutp;
            const slot = coutp.p;
            heldOutDropRead[slot].getPath(), outDrop = heldOutDropRead[slot], w2 = heldOutDropWrites[slot] = cursor_js_1.writeCursor();
          } else void 0 !== coutp.r && (outDrop = null, removedOut = true);
          else hasDrop(getComponent(outDrop)) && (outDrop = null);
          const c2 = p2Drop.getComponent();
          if (c2) {
            let slot2;
            if (null != (slot2 = c2.d)) {
              const _w = heldDropWrites[slot2];
              _w && (_w.get(), w2.mergeTree(_w.get()), outDrop = cursor_js_1.readCursor(_w.get()));
            }
          }
          let outPickOff = 0, outDropOff = 0;
          const oPickAdv = cursor_js_1.advancer(outPick, void 0, (k, c) => {
            hasPick(c) && outPickOff--;
          }), oDropAdv = cursor_js_1.advancer(outDrop, (k, c) => hasDrop(c) ? -(k - outDropOff) - 1 : k - outDropOff, (k, c) => {
            hasDrop(c) && outDropOff++;
          });
          for (const o2dk of p2Drop) if ("number" == typeof o2dk) {
            const _outPick = oPickAdv(o2dk), rmid = o2dk + outPickOff, _outDrop = oDropAdv(rmid), rfinal = rmid + outDropOff;
            w2.descend(rfinal), writeHeldOp2Drop(p2Drop, _outPick, _outDrop, w2, parentC, removedOut), w2.ascend();
          } else w2.descend(o2dk), writeHeldOp2Drop(p2Drop, oPickAdv(o2dk), oDropAdv(o2dk), w2, parentC, removedOut), w2.ascend();
          oPickAdv.end(), oDropAdv.end();
        }(r2, rOut, rOut.clone(), w, null, false), w.reset(), conflict) return {
          ok: false,
          conflict
        };
        if (w.get(), heldOutDropWrites.length) {
          const heldOutDropContent = heldOutDropWrites.map((w2) => w2 ? w2.get() : null), rOut2 = cursor_js_1.readCursor(shallowCloneOp(w.get()));
          if (eachDrop(rOut2, w, (slotOut, r, w2) => {
            const data = heldOutDropContent[slotOut];
            data && (w2.mergeTree(data), heldOutDropContent[slotOut] = null);
          }), heldOutDropContent.find((x) => x)) {
            const w1 = cursor_js_1.writeCursor(), w2 = cursor_js_1.writeCursor();
            let nextSlot1 = 0, nextSlot2 = 0;
            heldOutDropContent.forEach((data) => {
              null != data && eachDrop(cursor_js_1.readCursor(data), null, (c) => {
                const slot1 = outputSlotMap[c];
                w1.writeMove(heldOp1PickByOp1[slot1].getPath(), heldOp1DropByOp1[slot1].getPath(), nextSlot1++);
                const slot2s = op1PicksOp2DropSlots[slot1];
                slot2s && slot2s.forEach((slot2) => {
                  cancelledOp2[slot2] || 1 !== side && null != op1PickAtOp2Pick[slot2] || w2.writeMove(heldOp2PickByOp2[slot2].getPath(), heldOp2DropByOp2[slot2].getPath(), nextSlot2++);
                });
              });
            }), conflict = {
              type: types_js_1.ConflictType.BLACKHOLE,
              op1: w1.get(),
              op2: w2.get()
            };
          }
        }
      }
      if (conflict) return {
        ok: false,
        conflict
      };
      return {
        ok: true,
        result: w.get()
      };
    }
    var throwConflictErr = (conflict) => {
      const err = new Error("Transform detected write conflict");
      throw err.conflict = conflict, err.type = err.name = "writeConflict", err;
    };
    function transform(op1, op2, side) {
      const res = tryTransform(op1, op2, side);
      if (res.ok) return res.result;
      throwConflictErr(res.conflict);
    }
    var opThatRemovesDE = (op) => {
      const w = cursor_js_1.writeCursor();
      return cursor_js_1.readCursor(op).traverse(w, (c, w2) => {
        (hasDrop(c) || getEditType(c)) && w2.write("r", true);
      }), w.get();
    };
    var resolveConflict = (conflict, side) => {
      const { type, op1, op2 } = conflict;
      switch (type) {
        case types_js_1.ConflictType.DROP_COLLISION:
          return "left" === side ? [null, opThatRemovesDE(op2)] : [opThatRemovesDE(op1), null];
        case types_js_1.ConflictType.RM_UNEXPECTED_CONTENT:
          let op1HasRemove = false;
          return cursor_js_1.readCursor(op1).traverse(null, (c) => {
            void 0 !== c.r && (op1HasRemove = true);
          }), op1HasRemove ? [null, opThatRemovesDE(op2)] : [opThatRemovesDE(op1), null];
        case types_js_1.ConflictType.BLACKHOLE:
          return [opThatRemovesDE(op1), opThatRemovesDE(op2)];
        default:
          throw Error("Unrecognised conflict: " + type);
      }
    };
    function transformWithConflictsPred(allowConflict, op1, op2, side) {
      let r2Aggregate = null;
      for (; ; ) {
        const res = tryTransform(op1, op2, side);
        if (res.ok) return compose(r2Aggregate, res.result);
        {
          const { conflict } = res;
          allowConflict(conflict) || throwConflictErr(conflict);
          const [r1, r2] = resolveConflict(conflict, side);
          op1 = compose(normalize(op1), r1), op2 = compose(normalize(op2), r2), r2Aggregate = compose(r2Aggregate, r2);
        }
      }
    }
  }
});

// node_modules/ot-json1/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/ot-json1/dist/index.js"(exports) {
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m) if (p !== "default" && !exports2.hasOwnProperty(p)) __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_json1_release(), exports);
    var cursor_js_1 = require_cursor();
    Object.defineProperty(exports, "ReadCursor", { enumerable: true, get: function() {
      return cursor_js_1.ReadCursor;
    } });
    Object.defineProperty(exports, "WriteCursor", { enumerable: true, get: function() {
      return cursor_js_1.WriteCursor;
    } });
    var types_1 = require_types();
    Object.defineProperty(exports, "ConflictType", { enumerable: true, get: function() {
      return types_1.ConflictType;
    } });
  }
});
export default require_dist2();
