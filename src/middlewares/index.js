const { validationResult } = require('express-validator');
const { verifyAccessToken }  = require('../utils/jwt');
const { query: dbQuery }     = require('../config/db');
const logger                 = require('../utils/logger');
const { sendUnauthorized, sendForbidden, sendBadRequest } = require('../utils/response');

// ══════════════════════════════════════════════════════════════
//  REQUEST LOGGER MIDDLEWARE
//  Logs method, path, status code, duration, and user on finish
// ══════════════════════════════════════════════════════════════
const requestLogger = (req, res, next) => {
  const start = Date.now();

  logger.info('REQUEST', `→ ${req.method} ${req.originalUrl}`, {
    ip:      req.ip,
    body:    req.method !== 'GET' ? sanitiseBody(req.body) : undefined,
    query:   Object.keys(req.query).length ? req.query : undefined,
  });

  res.on('finish', () => {
    const userId = req.user ? req.user.id : 'guest';
    logger.request(req.method, req.originalUrl, res.statusCode, Date.now() - start, userId);
  });

  next();
};

// Strip password fields from logged body
const sanitiseBody = (body = {}) => {
  const safe = { ...body };
  ['password', 'current_password', 'new_password', 'otp', 'token'].forEach((k) => {
    if (safe[k]) safe[k] = '***';
  });
  return safe;
};

// ══════════════════════════════════════════════════════════════
//  VALIDATE MIDDLEWARE
//  Runs after express-validator rules; collects and returns errors
// ══════════════════════════════════════════════════════════════
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field:   e.path,
      message: e.msg,
    }));
    logger.warn('VALIDATE', `Validation failed on ${req.method} ${req.originalUrl}`, formatted);
    return sendBadRequest(res, 'Validation failed', formatted);
  }
  next();
};

// ══════════════════════════════════════════════════════════════
//  AUTHENTICATE MIDDLEWARE
//  Verifies the JWT in Authorization: Bearer <token>
//  Attaches req.user = { id, email, role }
// ══════════════════════════════════════════════════════════════
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('AUTH', `No bearer token on ${req.method} ${req.originalUrl}`);
    return sendUnauthorized(res, 'Access token is required');
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyAccessToken(token);

  if (!decoded) {
    logger.warn('AUTH', 'Invalid or expired access token');
    return sendUnauthorized(res, 'Invalid or expired token');
  }

  // Confirm user still exists and is active
  try {
    const { rows } = await dbQuery(
      'SELECT id, email, first_name, last_name, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      logger.warn('AUTH', `User ${decoded.id} not found or deactivated`);
      return sendUnauthorized(res, 'Account not found or deactivated');
    }

    req.user = rows[0];
    logger.info('AUTH', `Authenticated user ${req.user.id} (${req.user.email})`);
    next();
  } catch (err) {
    logger.error('AUTH', 'DB error during token validation', err.message);
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════
//  PROJECT ROLE MIDDLEWARE FACTORY
//  Usage: requireProjectRole('admin') or requireProjectRole('member')
//  Expects :projectId param. Attaches req.projectRole
// ══════════════════════════════════════════════════════════════
const requireProjectRole = (...allowedRoles) => async (req, res, next) => {
  const projectId = parseInt(req.params.projectId || req.params.id, 10);

  if (!projectId) {
    return sendBadRequest(res, 'Project ID is required');
  }

  try {
    const { rows } = await dbQuery(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (!rows.length) {
      logger.warn(
        'AUTHZ',
        `User ${req.user.id} is not a member of project ${projectId}`
      );
      return sendForbidden(res, 'You are not a member of this project');
    }

    const { role } = rows[0];
    if (!allowedRoles.includes(role)) {
      logger.warn(
        'AUTHZ',
        `User ${req.user.id} has role '${role}' but needs one of [${allowedRoles}] on project ${projectId}`
      );
      return sendForbidden(res, `This action requires role: ${allowedRoles.join(' or ')}`);
    }

    req.projectRole = role;
    logger.info('AUTHZ', `User ${req.user.id} authorised as '${role}' on project ${projectId}`);
    next();
  } catch (err) {
    logger.error('AUTHZ', 'DB error during role check', err.message);
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLER
// ══════════════════════════════════════════════════════════════
const errorHandler = (err, req, res, _next) => {
  logger.error('SERVER', `Unhandled error on ${req.method} ${req.originalUrl}`, err.message);
  console.error(err.stack);

  // Postgres unique-violation
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Duplicate entry — resource already exists.' });
  }
  // Postgres foreign-key violation
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced resource does not exist.' });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};

// ══════════════════════════════════════════════════════════════
//  404 HANDLER
// ══════════════════════════════════════════════════════════════
const notFound = (req, res) => {
  logger.warn('SERVER', `404 — ${req.method} ${req.originalUrl}`);
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
};

module.exports = {
  requestLogger,
  validate,
  authenticate,
  requireProjectRole,
  errorHandler,
  notFound,
};
