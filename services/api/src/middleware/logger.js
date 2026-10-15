// Koa's "onion": code before `await next()` runs on the way in, code after runs on the way out.
export function logger(log = console.log) {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    log(`${ctx.method} ${ctx.path} ${ctx.status} ${Date.now() - start}ms id=${ctx.state.id}`);
  };
}
