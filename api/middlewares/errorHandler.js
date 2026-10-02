import ApiError from '../utils/ApiError.js';

export default function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    req.app.locals.log({ event: 'request_error', requestId: req.requestId, code: 'RESPONSE_ABORTED', status: 500 });
    // Express's final handler may log the forwarded error: never forward private text.
    return next(new ApiError(500, 'INTERNAL_ERROR', 'Internal server error'));
  }
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  if (error instanceof ApiError) {
    ({ status, code, message } = error);
  } else if (error.type === 'entity.parse.failed' || error instanceof URIError) {
    status = 400; code = 'INVALID_REQUEST'; message = 'Invalid request';
  } else if (['entity.too.large', 'parameters.too.many'].includes(error.type)) {
    status = 413; code = 'BODY_TOO_LARGE'; message = 'Request body too large';
  } else if (['charset.unsupported', 'encoding.unsupported'].includes(error.type)) {
    status = 415; code = 'UNSUPPORTED_ENCODING'; message = 'Unsupported request encoding';
  }
  req.app.locals.log({ event: 'request_error', requestId: req.requestId, code, status });
  res.status(status);
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return res.json({ error: message, code, requestId: req.requestId });
  }
  return res.render('error.ejs', { status, message });
}
