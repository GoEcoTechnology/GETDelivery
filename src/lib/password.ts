import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1
  });
}

export async function verifyPassword(password: string, hashString: string): Promise<boolean> {
  try {
    return await verify(hashString, password);
  } catch (error) {
    // If the hashString is in an old format (like bcrypt), Argon2 will throw an error.
    // We should safely catch it and return false instead of crashing the server.
    return false;
  }
}
