/**
 * CookieNum — arbitrary-precision number class for large cookie values.
 *
 * Stores values as mantissa * 10^exponent, with mantissa normalized to [1, 10).
 * All operations return new immutable instances.
 * Values below 1e15 use fast Number paths internally.
 */
export class CookieNum {
  constructor(mantissa, exponent) {
    if (mantissa === 0 || (mantissa === undefined && exponent === undefined)) {
      this.mantissa = 0;
      this.exponent = 0;
      return;
    }
    this.mantissa = mantissa;
    this.exponent = exponent || 0;
    this._normalize();
  }

  _normalize() {
    if (this.mantissa === 0) {
      this.exponent = 0;
      return;
    }
    // Preserve Infinity/NaN as-is — don't try to log10 them
    if (!Number.isFinite(this.mantissa)) return;
    // Handle negative mantissa
    const sign = this.mantissa < 0 ? -1 : 1;
    let m = Math.abs(this.mantissa);
    let e = this.exponent;

    if (m >= 10) {
      const shift = Math.floor(Math.log10(m));
      m /= Math.pow(10, shift);
      e += shift;
    } else if (m < 1 && m > 0) {
      const shift = -Math.floor(Math.log10(m));
      m *= Math.pow(10, shift);
      e -= shift;
    }
    // Fix floating-point drift: if m rounds to 10, bump
    if (m >= 9.999999999999) {
      m /= 10;
      e += 1;
    }
    this.mantissa = sign * m;
    this.exponent = e;
  }

  /** Create a CookieNum from a Number, string, or CookieNum */
  static from(v) {
    if (v instanceof CookieNum) return v.clone();
    if (typeof v === 'string') v = parseFloat(v);
    if (typeof v !== 'number' || isNaN(v)) return CookieNum.ZERO.clone();
    if (v === 0) return new CookieNum(0, 0);
    return new CookieNum(v, 0);
  }

  clone() {
    const c = Object.create(CookieNum.prototype);
    c.mantissa = this.mantissa;
    c.exponent = this.exponent;
    return c;
  }

  /** Convert to JS Number (may lose precision for very large values) */
  toNumber() {
    if (this.mantissa === 0) return 0;
    if (this.exponent > 300) return Infinity;
    if (this.exponent < -300) return 0;
    return this.mantissa * Math.pow(10, this.exponent);
  }

  valueOf() {
    return this.toNumber();
  }

  toString() {
    if (this.mantissa === 0) return '0';
    const n = this.toNumber();
    // Avoid scientific notation for display — show readable numbers
    if (Number.isFinite(n) && Math.abs(n) < 1e21) {
      return String(n);
    }
    // For very large values, format as mantissa x10^exp
    return `${this.mantissa.toFixed(2)}e${this.exponent}`;
  }

  isZero() {
    return this.mantissa === 0;
  }

  isNegative() {
    return this.mantissa < 0;
  }

  abs() {
    return new CookieNum(Math.abs(this.mantissa), this.exponent);
  }

  neg() {
    return new CookieNum(-this.mantissa, this.exponent);
  }

  // ─── Comparison ───

  /** Returns -1, 0, or 1 */
  cmp(other) {
    other = CookieNum._ensure(other);
    // Handle zeros
    if (this.mantissa === 0 && other.mantissa === 0) return 0;
    if (this.mantissa === 0) return other.mantissa > 0 ? -1 : 1;
    if (other.mantissa === 0) return this.mantissa > 0 ? 1 : -1;
    // Different signs
    if (this.mantissa > 0 && other.mantissa < 0) return 1;
    if (this.mantissa < 0 && other.mantissa > 0) return -1;
    // Same sign — compare exponents first
    const sign = this.mantissa > 0 ? 1 : -1;
    if (this.exponent !== other.exponent) {
      return ((this.exponent > other.exponent) ? 1 : -1) * sign;
    }
    // Same exponent — compare mantissas
    if (this.mantissa === other.mantissa) return 0;
    return ((this.mantissa > other.mantissa) ? 1 : -1);
  }

  gte(other) { return this.cmp(other) >= 0; }
  gt(other)  { return this.cmp(other) > 0; }
  lte(other) { return this.cmp(other) <= 0; }
  lt(other)  { return this.cmp(other) < 0; }
  eq(other)  { return this.cmp(other) === 0; }

  // ─── Arithmetic ───

  add(other) {
    other = CookieNum._ensure(other);
    if (this.mantissa === 0) return other.clone();
    if (other.mantissa === 0) return this.clone();

    // Align exponents
    const diff = this.exponent - other.exponent;
    if (diff > 15) return this.clone();  // other is negligible
    if (diff < -15) return other.clone();

    let m, e;
    if (diff >= 0) {
      m = this.mantissa * Math.pow(10, diff) + other.mantissa;
      e = other.exponent;
    } else {
      m = this.mantissa + other.mantissa * Math.pow(10, -diff);
      e = this.exponent;
    }
    return new CookieNum(m, e);
  }

  sub(other) {
    other = CookieNum._ensure(other);
    return this.add(other.neg());
  }

  mul(other) {
    // Allow plain number multiplication for multipliers
    if (typeof other === 'number') {
      if (other === 0 || this.mantissa === 0) return new CookieNum(0, 0);
      return new CookieNum(this.mantissa * other, this.exponent);
    }
    other = CookieNum._ensure(other);
    if (this.mantissa === 0 || other.mantissa === 0) return new CookieNum(0, 0);
    return new CookieNum(
      this.mantissa * other.mantissa,
      this.exponent + other.exponent
    );
  }

  div(other) {
    if (typeof other === 'number') {
      if (other === 0) return new CookieNum(Infinity, 0);
      return new CookieNum(this.mantissa / other, this.exponent);
    }
    other = CookieNum._ensure(other);
    if (other.mantissa === 0) return new CookieNum(Infinity, 0);
    if (this.mantissa === 0) return new CookieNum(0, 0);
    return new CookieNum(
      this.mantissa / other.mantissa,
      this.exponent - other.exponent
    );
  }

  floor() {
    if (this.mantissa === 0) return CookieNum.ZERO.clone();
    // For large exponents (>= 15), the value is already effectively integer-scale
    if (this.exponent >= 15) return this.clone();
    const n = this.toNumber();
    if (Number.isFinite(n)) {
      return CookieNum.from(Math.floor(n));
    }
    return this.clone();
  }

  // ─── Math ───

  log10() {
    if (this.mantissa <= 0) return -Infinity;
    return Math.log10(this.mantissa) + this.exponent;
  }

  /** Raise to a plain-number power */
  pow(n) {
    if (n === 0) return CookieNum.from(1);
    if (this.mantissa === 0) return new CookieNum(0, 0);
    // mantissa^n * 10^(exponent*n)
    return new CookieNum(
      Math.pow(this.mantissa, n),
      this.exponent * n
    );
  }

  // ─── Static helpers ───

  static max(a, b) {
    a = CookieNum._ensure(a);
    b = CookieNum._ensure(b);
    return a.gte(b) ? a : b;
  }

  static min(a, b) {
    a = CookieNum._ensure(a);
    b = CookieNum._ensure(b);
    return a.lte(b) ? a : b;
  }

  static _ensure(v) {
    if (v instanceof CookieNum) return v;
    return CookieNum.from(v);
  }

  // ─── Serialization ───

  /** Returns plain number if safe (<1e15), else [mantissa, exponent] */
  toJSON() {
    const n = this.toNumber();
    if (Number.isFinite(n) && Math.abs(n) < 1e15) {
      return n;
    }
    // Round mantissa to avoid floating-point noise in JSON
    return [parseFloat(this.mantissa.toPrecision(15)), this.exponent];
  }

  /** Accepts number, [m, e] array, null/undefined */
  static fromJSON(v) {
    if (v === null || v === undefined) return CookieNum.ZERO.clone();
    if (Array.isArray(v)) {
      return new CookieNum(v[0], v[1]);
    }
    return CookieNum.from(v);
  }
}

// Constants (frozen instances — never mutate these)
CookieNum.ZERO = Object.freeze(new CookieNum(0, 0));
CookieNum.ONE = Object.freeze(new CookieNum(1, 0));
