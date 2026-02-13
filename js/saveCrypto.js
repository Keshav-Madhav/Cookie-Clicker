/**
 * SaveCrypto — AES-GCM encryption for localStorage saves.
 *
 * Uses the Web Crypto API (zero dependencies).
 * The key is derived from a passphrase via PBKDF2 with a fixed salt.
 * This prevents casual save editing; it is NOT a security boundary.
 *
 * Encrypted format:  "ENC:1:<base64(iv + ciphertext)>"
 * Unencrypted saves (plain JSON) are auto-migrated on load.
 */

const PASSPHRASE = "c00k1e-cl1ck3r-s4ve-k3y-2024";
const SALT = new Uint8Array([99,111,111,107,105,101,45,115,97,108,116]);  // "cookie-salt"
const PREFIX = "ENC:1:";

let _cachedKey = null;

async function _getKey() {
  if (_cachedKey) return _cachedKey;

  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(PASSPHRASE), "PBKDF2", false, ["deriveKey"]
  );
  _cachedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  return _cachedKey;
}

/**
 * Encrypt a plain JSON string into the ENC:1: format.
 * @param {string} jsonStr  — the raw JSON save string
 * @returns {Promise<string>}
 */
export async function encryptSave(jsonStr) {
  const key = await _getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(jsonStr);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  // Pack iv + ciphertext into one buffer, then base64
  const packed = new Uint8Array(iv.length + cipherBuf.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipherBuf), iv.length);

  return PREFIX + btoa(String.fromCharCode(...packed));
}

/**
 * Decrypt an ENC:1: string back to raw JSON.
 * @param {string} stored — the encrypted string from localStorage
 * @returns {Promise<string>}
 */
export async function decryptSave(stored) {
  if (!stored.startsWith(PREFIX)) {
    throw new Error("Not an encrypted save");
  }

  const key = await _getKey();
  const raw = atob(stored.slice(PREFIX.length));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plainBuf);
}

/**
 * Check whether a stored string is encrypted.
 * @param {string} stored
 * @returns {boolean}
 */
export function isEncrypted(stored) {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

/* ═══════════════════════════════════════════════════
   DEV TOOLS — call from browser console
   ═══════════════════════════════════════════════════ */

/**
 * Dev: decrypt and pretty-print the current save to the console.
 * Usage:  CookieDev.viewSave()
 */
async function viewSave() {
  const stored = localStorage.getItem("cookieClickerSave");
  if (!stored) { console.log("No save found."); return null; }

  let json;
  if (isEncrypted(stored)) {
    json = await decryptSave(stored);
  } else {
    json = stored;
  }
  const data = JSON.parse(json);
  console.log("%c[Cookie Clicker Save]", "color: #ffd700; font-weight: bold;", data);
  return data;
}

/**
 * Dev: export the decrypted save as a JSON string (for backup / debugging).
 * Usage:  CookieDev.exportSave()
 */
async function exportSave() {
  const stored = localStorage.getItem("cookieClickerSave");
  if (!stored) { console.log("No save found."); return null; }

  let json;
  if (isEncrypted(stored)) {
    json = await decryptSave(stored);
  } else {
    json = stored;
  }
  console.log("%cDecrypted save JSON (copy below):", "color: #ffd700;");
  console.log(json);
  return json;
}

/**
 * Dev: import a raw JSON string as an encrypted save.
 * Usage:  CookieDev.importSave('{"cookies":999,...}')
 */
async function importSave(jsonStr) {
  // Validate JSON
  JSON.parse(jsonStr);
  const encrypted = await encryptSave(jsonStr);
  localStorage.setItem("cookieClickerSave", encrypted);
  console.log("%cSave imported and encrypted. Reload the page to apply.", "color: #00ff88;");
}

// Expose dev tools on window
window.CookieDev = { viewSave, exportSave, importSave };
