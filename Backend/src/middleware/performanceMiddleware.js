/**
 * High-precision API Request Performance Monitoring Middleware
 * Attaches X-Response-Time header and logs slow requests for observability.
 */
export const performanceLogger = (req, res, next) => {
  const startHrTime = process.hrtime();

  res.on('finish', () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedMs = (elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2);

    const numMs = parseFloat(elapsedMs);
    const method = req.method;
    const url = req.originalUrl || req.url;
    const statusCode = res.statusCode;

    if (numMs > 300 || process.env.LOG_API_TIMINGS === 'true') {
      const tag = numMs > 1000 ? '🔴 SLOW' : numMs > 300 ? '🟡 WARN' : '🟢 FAST';
      console.log(`[PERF] ${tag} ${method} ${url} - ${statusCode} - ${elapsedMs}ms`);
    }
  });

  const originalSend = res.send;
  res.send = function (data) {
    if (!res.headersSent) {
      const elapsedHrTime = process.hrtime(startHrTime);
      const elapsedMs = (elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2);
      try {
        res.setHeader('X-Response-Time', `${elapsedMs}ms`);
      } catch (e) {}
    }
    return originalSend.call(this, data);
  };

  next();
};

export default performanceLogger;
