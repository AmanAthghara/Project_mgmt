const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../config/db');
const {
  generateOTP, hashOTP, verifyOTPHash,
  sendOTPEmail, sendPasswordResetEmail, sendPasswordChangedEmail,
} = require('../utils/otp');
const { signAccessToken, signRefreshToken, buildTokenPayload } = require('../utils/jwt');
const logger = require('../utils/logger');

const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES) || 10;

// ── Safe user shape (never expose password_hash) ─────────────
const safeUser = (u) => ({
  id:           u.id,
  first_name:   u.first_name,
  last_name:    u.last_name,
  email:        u.email,
  age:          u.age,
  gender:       u.gender,
  phone_number: u.phone_number,
  is_active:    u.is_active,
  created_at:   u.created_at,
});

// ══════════════════════════════════════════════════════════════
//  STEP 1 — Initiate Registration
//  Stores payload + OTP in otp_store; sends OTP email
// ══════════════════════════════════════════════════════════════
const initiateRegistration = async ({ first_name, last_name, email, password, age, gender, phone_number }) => {
  logger.auth('REGISTER_INIT', email);

  // Reject if email already registered
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    logger.warn('AUTH_SVC', `Registration attempt on existing email: ${email}`);
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
  }

  // Invalidate any previous unused OTPs for this email
  await query(
    "UPDATE otp_store SET verified = TRUE WHERE email = $1 AND verified = FALSE",
    [email]
  );

  const password_hash = await bcrypt.hash(password, 12);
  const otp = generateOTP();
  const otp_hash = await hashOTP(otp);
  const expires_at = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  const payload = JSON.stringify({ first_name, last_name, email, age, gender, phone_number, password_hash });

  await query(
    `INSERT INTO otp_store (email, otp_hash, payload, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [email, otp_hash, payload, expires_at]
  );

  await sendOTPEmail(email, first_name, otp);
  logger.success('AUTH_SVC', `OTP sent for ${email} — expires at ${expires_at.toISOString()}`);

  return { message: 'OTP sent to your email. Please verify within 10 minutes.' };
};

// ══════════════════════════════════════════════════════════════
//  STEP 2 — Verify OTP & Create User
// ══════════════════════════════════════════════════════════════
const verifyOTPAndRegister = async ({ email, otp }) => {
  logger.auth('VERIFY_OTP', email);

  const { rows } = await query(
    `SELECT * FROM otp_store
     WHERE email = $1 AND verified = FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [email]
  );

  if (!rows.length) {
    logger.warn('AUTH_SVC', `No pending OTP for ${email}`);
    throw Object.assign(new Error('No pending OTP found. Please register again.'), { statusCode: 400 });
  }

  const record = rows[0];

  if (new Date() > new Date(record.expires_at)) {
    await query('UPDATE otp_store SET verified = TRUE WHERE id = $1', [record.id]);
    logger.warn('AUTH_SVC', `OTP expired for ${email}`);
    throw Object.assign(new Error('OTP has expired. Please register again.'), { statusCode: 400 });
  }

  const valid = await verifyOTPHash(otp, record.otp_hash);
  if (!valid) {
    logger.warn('AUTH_SVC', `Wrong OTP submitted for ${email}`);
    throw Object.assign(new Error('Invalid OTP'), { statusCode: 400 });
  }

  // Mark OTP as used
  await query('UPDATE otp_store SET verified = TRUE WHERE id = $1', [record.id]);

  const { first_name, last_name, age, gender, phone_number, password_hash } = record.payload;

  // Create user
  const insert = await query(
    `INSERT INTO users (first_name, last_name, email, age, gender, phone_number, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [first_name, last_name, email, age, gender || null, phone_number || null, password_hash]
  );

  const user = insert.rows[0];
  const tokenPayload = buildTokenPayload(user);
  const access_token  = signAccessToken(tokenPayload);
  const refresh_token = signRefreshToken(tokenPayload);

  logger.success('AUTH_SVC', `User created: id=${user.id} email=${email}`);

  return {
    user:          safeUser(user),
    access_token,
    refresh_token,
    token_type:    'Bearer',
    expires_in:    process.env.JWT_EXPIRES_IN || '7d',
  };
};

// ══════════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════════
const login = async ({ email, password }) => {
  logger.auth('LOGIN', email);

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);

  if (!rows.length) {
    logger.warn('AUTH_SVC', `Login failed — email not found: ${email}`);
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  const user = rows[0];

  if (!user.is_active) {
    logger.warn('AUTH_SVC', `Login attempt on deactivated account: ${email}`);
    throw Object.assign(new Error('Account is deactivated. Contact support.'), { statusCode: 403 });
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    logger.warn('AUTH_SVC', `Wrong password for ${email}`);
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
  }

  const tokenPayload  = buildTokenPayload(user);
  const access_token  = signAccessToken(tokenPayload);
  const refresh_token = signRefreshToken(tokenPayload);

  logger.success('AUTH_SVC', `Login successful: id=${user.id} email=${email}`);

  return {
    user:          safeUser(user),
    access_token,
    refresh_token,
    token_type:    'Bearer',
    expires_in:    process.env.JWT_EXPIRES_IN || '7d',
  };
};

// ══════════════════════════════════════════════════════════════
//  FORGOT PASSWORD
//  Generates a reset token, stores its hash, emails a link
// ══════════════════════════════════════════════════════════════
const forgotPassword = async ({ email }) => {
  logger.auth('FORGOT_PASSWORD', email);

  const { rows } = await query(
    'SELECT id, first_name FROM users WHERE email = $1 AND is_active = TRUE',
    [email]
  );

  // Always respond success (don't reveal if email exists)
  if (!rows.length) {
    logger.warn('AUTH_SVC', `Forgot password — email not found: ${email}`);
    return { message: 'If that email is registered you will receive a reset link.' };
  }

  const user = rows[0];

  // Invalidate previous tokens
  await query(
    "UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE",
    [user.id]
  );

  const rawToken   = uuidv4();
  const tokenHash  = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expires_at]
  );

  await sendPasswordResetEmail(email, user.first_name, rawToken);

  logger.success('AUTH_SVC', `Password reset token sent to ${email}`);
  return { message: 'If that email is registered you will receive a reset link.' };
};

// ══════════════════════════════════════════════════════════════
//  RESET PASSWORD (via email link token)
// ══════════════════════════════════════════════════════════════
const resetPassword = async ({ token, new_password }) => {
  logger.auth('RESET_PASSWORD', '—');

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { rows } = await query(
    `SELECT prt.*, u.email, u.first_name
     FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1 AND prt.used = FALSE`,
    [tokenHash]
  );

  if (!rows.length) {
    logger.warn('AUTH_SVC', 'Reset attempt with invalid token');
    throw Object.assign(new Error('Invalid or expired reset token'), { statusCode: 400 });
  }

  const record = rows[0];
  if (new Date() > new Date(record.expires_at)) {
    await query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [record.id]);
    logger.warn('AUTH_SVC', `Reset token expired for user ${record.user_id}`);
    throw Object.assign(new Error('Reset link has expired. Please request a new one.'), { statusCode: 400 });
  }

  const password_hash = await bcrypt.hash(new_password, 12);

  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, record.user_id]);
  await query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [record.id]);

  await sendPasswordChangedEmail(record.email, record.first_name);
  logger.success('AUTH_SVC', `Password reset for user ${record.user_id}`);

  return { message: 'Password has been reset successfully. You can now log in.' };
};

// ══════════════════════════════════════════════════════════════
//  CHANGE PASSWORD (logged-in user)
// ══════════════════════════════════════════════════════════════
const changePassword = async (userId, { current_password, new_password }) => {
  logger.auth('CHANGE_PASSWORD', `userId=${userId}`);

  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows.length) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const user = rows[0];
  const match = await bcrypt.compare(current_password, user.password_hash);
  if (!match) {
    logger.warn('AUTH_SVC', `Wrong current password for user ${userId}`);
    throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
  }

  const password_hash = await bcrypt.hash(new_password, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, userId]);
  await sendPasswordChangedEmail(user.email, user.first_name);

  logger.success('AUTH_SVC', `Password changed for user ${userId}`);
  return { message: 'Password changed successfully.' };
};

// ══════════════════════════════════════════════════════════════
//  GET PROFILE
// ══════════════════════════════════════════════════════════════
const getProfile = async (userId) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return safeUser(rows[0]);
};

// ══════════════════════════════════════════════════════════════
//  UPDATE PROFILE
// ══════════════════════════════════════════════════════════════
const updateProfile = async (userId, updates) => {
  const allowed = ['first_name', 'last_name', 'age', 'gender', 'phone_number'];
  const fields  = [];
  const values  = [];
  let idx = 1;

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(updates[key]);
    }
  }

  if (!fields.length) throw Object.assign(new Error('No updatable fields provided'), { statusCode: 400 });

  values.push(userId);
  const { rows } = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  logger.success('AUTH_SVC', `Profile updated for user ${userId}`);
  return safeUser(rows[0]);
};

module.exports = {
  initiateRegistration,
  verifyOTPAndRegister,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile,
  updateProfile,
};
