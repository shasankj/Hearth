import bcrypt from 'bcryptjs';

// bcrypt = slow, salted hash: a stolen database can't be brute-forced quickly. Never store plain passwords.
export const hashPassword = (plain, rounds) => bcrypt.hash(plain, rounds);
export const checkPassword = (plain, hash) => bcrypt.compare(plain, hash);

// A real hash used when the email is unknown, so "no such user" takes as long as "wrong password".
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
