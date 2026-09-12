// api/src/middleware/error.js
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function errorMiddleware(err, req, res, next) {
  console.error('[error]', err);
  if (err.code === 'P2002') {
    return res.status(409).json({ error: '记录已存在', detail: err.meta });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
}

module.exports = { asyncHandler, errorMiddleware };