import { CookieNum } from "./cookieNum.js";

// Global flag: when false, uses full comma-separated numbers instead of shorthand
let _useShortNumbers = true;
export function setShortNumbers(v) { _useShortNumbers = v; }

export const formatNumberInWords = (num) => {
  // CookieNum-aware path: use log10() directly for precision with large values
  if (num instanceof CookieNum) {
    if (num.isZero()) return "0";
    // Guard against Infinity/NaN mantissa
    if (!Number.isFinite(num.mantissa)) return "Infinity";
    const n = num.toNumber();
    if (!_useShortNumbers) {
      if (Number.isFinite(n) && Math.abs(n) < 1e15) {
        return parseFloat(n.toFixed(2)).toLocaleString('en-US');
      }
      // Beyond safe integer range: fall through to suffixed display
    } else if (Number.isFinite(n) && n < 10000) {
      return parseFloat(n.toFixed(2)).toString();
    }
    // Use CookieNum's precise log10 for tier calculation
    const log = num.log10();
    if (!Number.isFinite(log)) return "Infinity";
    let tier = Math.floor(log / 3);
    if (tier < 0) tier = 0;
    if (tier >= suffixes.length) tier = suffixes.length - 1;
    // Scale using CookieNum division to avoid overflow in Math.pow
    const divisor = CookieNum.from(10).pow(tier * 3);
    const scaled = num.div(divisor).toNumber();
    if (!Number.isFinite(scaled)) return `${num.mantissa.toFixed(2)}e${num.exponent}`;
    const formatted = scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(2);
    return `${formatted} ${suffixes[tier]}`.trim();
  }

  num = parseFloat(num);
  if (isNaN(num)) return "0";
  if (!Number.isFinite(num)) return "Infinity";

  // Full comma-separated mode
  if (!_useShortNumbers) {
    return parseFloat(num.toFixed(2)).toLocaleString('en-US');
  }

  if (num < 10000) return parseFloat(num.toFixed(2)).toString();

  let tier = Math.floor(Math.log10(num) / 3); // Determine the suffix tier
  if (tier >= suffixes.length) tier = suffixes.length - 1; // Cap at the highest suffix

  const scaled = num / Math.pow(10, tier * 3); // Scale number to fit the tier
  const formatted = scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(2); // Show decimals only if non-zero

  return `${formatted} ${suffixes[tier]}`; // Format properly with a space
};

const suffixes = [
  "", "K", "Million", "Billion", "Trillion", "Quadrillion", "Quintillion",
  "Sextillion", "Septillion", "Octillion", "Nonillion", "Decillion", "Undecillion",
  "Duodecillion", "Tredecillion", "Quattuordecillion", "Quindecillion", "Sexdecillion",
  "Septendecillion", "Octodecillion", "Novemdecillion", "Vigintillion", "Unvigintillion",
  "Duovigintillion", "Trevigintillion", "Quattuorvigintillion", "Quinvigintillion",
  "Sexvigintillion", "Septenvigintillion", "Octovigintillion", "Novemvigintillion", "Trigintillion"
];
