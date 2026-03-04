import { randomBytes, toHex, fromHex } from "./crypto";

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;

export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(32);
  const hash = await deriveKey(password, salt);
  return { hash: toHex(new Uint8Array(hash)), salt: toHex(salt) };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const salt = fromHex(storedSalt);
  const derived = await deriveKey(password, salt);
  const derivedHex = toHex(new Uint8Array(derived));

  if (derivedHex.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < derivedHex.length; i++) {
    result |= derivedHex.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
}
