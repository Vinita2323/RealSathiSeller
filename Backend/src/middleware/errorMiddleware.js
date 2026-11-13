export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Database connectivity problems (not a bug in the request): buffering timeouts, server selection / network errors
const isDatabaseUnavailable = (err) =>
  err?.name === 'MongoServerSelectionError' ||
  err?.name === 'MongooseServerSelectionError' ||
  err?.name === 'MongoNetworkError' ||
  err?.name === 'MongoNetworkTimeoutError' ||
  (err?.name === 'MongooseError' && /buffering timed out/i.test(err.message || ''));

export const errorHandler = (err, req, res, next) => {
  const dbDown = isDatabaseUnavailable(err);
  const statusCode = dbDown ? 503 : (err.statusCode || err.status || (res.statusCode === 200 ? 500 : res.statusCode));
  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} -`, err);
  }
  res.status(statusCode).json({
    success: false,
    message: dbDown
      ? 'The server cannot reach the database right now. Please try again in a moment.'
      : err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
