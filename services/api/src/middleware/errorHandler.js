// gRPC status code -> HTTP status. (5=NOT_FOUND, 3=INVALID_ARGUMENT, 4=DEADLINE_EXCEEDED, 14=UNAVAILABLE)
const HTTP_FOR_GRPC = { 5: 404, 3: 400, 4: 504, 14: 503 };
const GENERIC = {
  400: 'Invalid request',
  404: 'Not found',
  503: 'Service temporarily unavailable',
  504: 'The service took too long to respond',
};

export function toHttpStatus(err) {
  return err.status ?? HTTP_FOR_GRPC[err.code] ?? 500;
}

// Our own HttpError messages are written for users; everything else gets a generic message (no internals leak).
function publicMessage(err, status) {
  return err.status ? err.message : (GENERIC[status] ?? 'Internal error');
}

export async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (err) {
    ctx.status = toHttpStatus(err);
    if (ctx.status === 500) console.error(err);
    // `details` is only for our own validation errors; never forward raw upstream (gRPC) details.
    ctx.body = { error: publicMessage(err, ctx.status), details: err.status ? err.details : undefined, id: ctx.state.id };
  }
}
