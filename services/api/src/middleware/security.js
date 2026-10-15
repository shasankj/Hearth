const HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'geolocation=(), camera=(), microphone=()',
};

export async function securityHeaders(ctx, next) {
  await next();
  for (const [name, value] of Object.entries(HEADERS)) ctx.set(name, value);
}
