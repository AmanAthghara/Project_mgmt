const authService = require('../services/auth.service');
const logger      = require('../utils/logger');
const {
  sendSuccess, sendCreated, sendError,
  sendBadRequest, sendNotFound,
} = require('../utils/response');

// POST /api/auth/register
const registerInit = async (req, res, next) => {
  logger.info('CTRL:AUTH', 'registerInit called', { email: req.body.email });
  try {
    const result = await authService.initiateRegistration(req.body);
    return sendSuccess(res, result.message);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// POST /api/auth/verify-otp
const verifyOTP = async (req, res, next) => {
  logger.info('CTRL:AUTH', 'verifyOTP called', { email: req.body.email });
  try {
    const result = await authService.verifyOTPAndRegister(req.body);
    return sendCreated(res, 'Account created successfully', result);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  logger.info('CTRL:AUTH', 'login called', { email: req.body.email });
  try {
    const result = await authService.login(req.body);
    return sendSuccess(res, 'Login successful', result);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  logger.info('CTRL:AUTH', 'forgotPassword called', { email: req.body.email });
  try {
    const result = await authService.forgotPassword(req.body);
    return sendSuccess(res, result.message);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  logger.info('CTRL:AUTH', 'resetPassword called');
  try {
    const result = await authService.resetPassword(req.body);
    return sendSuccess(res, result.message);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// PUT /api/auth/change-password  [protected]
const changePassword = async (req, res, next) => {
  logger.info('CTRL:AUTH', 'changePassword called', { userId: req.user.id });
  try {
    const result = await authService.changePassword(req.user.id, req.body);
    return sendSuccess(res, result.message);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// GET /api/auth/me  [protected]
const getMe = async (req, res, next) => {
  logger.info('CTRL:AUTH', 'getMe called', { userId: req.user.id });
  try {
    const user = await authService.getProfile(req.user.id);
    return sendSuccess(res, 'Profile fetched', { user });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// PUT /api/auth/me  [protected]
const updateMe = async (req, res, next) => {
  logger.info('CTRL:AUTH', 'updateMe called', { userId: req.user.id });
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    return sendSuccess(res, 'Profile updated', { user });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

module.exports = {
  registerInit,
  verifyOTP,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateMe,
};
