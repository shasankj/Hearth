const num = (value, fallback) => (value === undefined ? fallback : Number(value));
const DEV_SECRET = 'dev-only-secret-change-me';

function endpoints(env) {
  return {
    port: num(env.PORT, 3000),
    databaseUrl: env.DATABASE_URL ?? 'postgres://hearth:hearth@localhost:5432/hearth',
    listingAddr: env.LISTING_ADDR ?? 'localhost:50051',
    inspectionUrl: env.INSPECTION_URL ?? 'http://localhost:8081',
    temporalAddress: env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  };
}

function security(env) {
  return {
    jwtSecret: env.JWT_SECRET ?? DEV_SECRET,
    cookieSecure: env.COOKIE_SECURE === 'true',
    trustProxy: env.TRUST_PROXY === 'true',
    bcryptRounds: num(env.BCRYPT_ROUNDS, 10),
    production: env.NODE_ENV === 'production',
  };
}

// All configuration comes from environment variables (12-factor): the same image runs locally, in k8s and against RDS.
export const loadConfig = (env = process.env) => ({ ...endpoints(env), ...security(env) });

// Refuse to boot in production with the well-known development secret.
export function assertSafe(config) {
  if (config.production && config.jwtSecret === DEV_SECRET) throw new Error('JWT_SECRET must be set in production');
  return config;
}
