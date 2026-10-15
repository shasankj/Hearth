import { PG_UNIQUE_VIOLATION } from '../db.js';
import { DUMMY_HASH, checkPassword, hashPassword } from '../auth/password.js';
import { conflict, unauthorized } from '../errors.js';

const publicUser = ({ id, email, name }) => ({ id, email, name });

async function register({ users, rounds }, { name, email, password }) {
  const passwordHash = await hashPassword(password, rounds);
  try {
    return await users.create({ name, email, passwordHash });
  } catch (err) {
    throw err.code === PG_UNIQUE_VIOLATION ? conflict('That email is already registered') : err;
  }
}

async function login(users, { email, password }) {
  const row = await users.byEmail(email);
  const ok = await checkPassword(password, row?.passwordHash ?? DUMMY_HASH);
  if (!row || !ok) throw unauthorized('Wrong email or password'); // one message: no account enumeration
  return publicUser(row);
}

export function makeAuthService({ users, rounds }) {
  return { register: (input) => register({ users, rounds }, input), login: (input) => login(users, input) };
}
