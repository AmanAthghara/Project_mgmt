// ── Standardised API response shape ─────────────────────────
// { success, message, data?, errors?, meta? }

const sendSuccess = (res, message, data = null, statusCode = 200, meta = null) => {
  const body = { success: true, message };
  if (data  !== null) body.data = data;
  if (meta  !== null) body.meta = meta;
  return res.status(statusCode).json(body);
};

const sendCreated = (res, message, data = null) =>
  sendSuccess(res, message, data, 201);

const sendError = (res, message, statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors !== null) body.errors = errors;
  return res.status(statusCode).json(body);
};

const sendUnauthorized = (res, message = 'Unauthorized') =>
  sendError(res, message, 401);

const sendForbidden = (res, message = 'Forbidden') =>
  sendError(res, message, 403);

const sendNotFound = (res, message = 'Not found') =>
  sendError(res, message, 404);

const sendBadRequest = (res, message, errors = null) =>
  sendError(res, message, 400, errors);

const sendConflict = (res, message) =>
  sendError(res, message, 409);

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendBadRequest,
  sendConflict,
};
