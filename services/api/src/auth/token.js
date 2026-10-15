import jwt from 'jsonwebtoken';

export const COOKIE = 'hearth_session';
const DAYS = 7;

export function makeTokens(secret) {
  return {
    sign: (user) => jwt.sign({ name: user.name, email: user.email }, secret, { subject: user.id, expiresIn: `${DAYS}d` }),
    verify: (token) => verify(token, secret),
    maxAgeMs: DAYS * 86_400_000,
  };
}

// A bad/expired token is just "not signed in", never an error page.
function verify(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}
