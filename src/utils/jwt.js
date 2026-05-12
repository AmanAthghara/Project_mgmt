const jwt = require('jsonwebtoken');
const logger = require('./logger');

const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    logger.warn('JWT', `Access token verification failed: ${err.message}`);
    return null;
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    logger.warn('JWT', `Refresh token verification failed: ${err.message}`);
    return null;
  }
};

// Strips sensitive fields before embedding in token
const buildTokenPayload = (user) => ({
  id:    user.id,
  email: user.email,
  role:  'user',  // global role; project-level roles are checked separately
});

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  buildTokenPayload,
};
