const bcrypt = require('bcryptjs');
const transporter = require('../config/mailer');
const logger = require('./logger');

// Generate a 6-digit numeric OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Hash OTP before storing (same principle as passwords)
const hashOTP = async (otp) => {
  return bcrypt.hash(otp, 10);
};

const verifyOTPHash = async (otp, hash) => {
  return bcrypt.compare(otp, hash);
};

// ── Email templates ───────────────────────────────────────────
const sendOTPEmail = async (email, firstName, otp) => {
  const expiresMins = process.env.OTP_EXPIRES_MINUTES || 10;

  const mailOptions = {
    from:    process.env.EMAIL_FROM,
    to:      email,
    subject: 'Your Verification Code — Project Mgmt',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1d4ed8">Hi ${firstName},</h2>
        <p style="color:#374151;font-size:15px">
          Use the code below to complete your registration. 
          It expires in <strong>${expiresMins} minutes</strong>.
        </p>
        <div style="text-align:center;margin:32px 0">
          <span style="font-size:40px;font-weight:700;letter-spacing:10px;color:#111827">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.success('MAIL', `OTP email sent to ${email}`);
};

const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  const resetUrl = `${process.env.CORS_ORIGIN}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from:    process.env.EMAIL_FROM,
    to:      email,
    subject: 'Password Reset Request — Project Mgmt',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1d4ed8">Hi ${firstName},</h2>
        <p style="color:#374151;font-size:15px">
          You requested a password reset. Click the button below — the link expires in <strong>15 minutes</strong>.
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${resetUrl}" style="background:#1d4ed8;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">
            Reset Password
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">
          Or copy this link: <br/><a href="${resetUrl}" style="color:#1d4ed8">${resetUrl}</a>
        </p>
        <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  logger.success('MAIL', `Password reset email sent to ${email}`);
};

const sendPasswordChangedEmail = async (email, firstName) => {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      email,
    subject: 'Your Password Was Changed — Project Mgmt',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1d4ed8">Hi ${firstName},</h2>
        <p style="color:#374151;font-size:15px">
          Your password was just changed. If this was you, no action is needed.
          If not, please contact support immediately.
        </p>
      </div>
    `,
  });
  logger.success('MAIL', `Password-changed notification sent to ${email}`);
};

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTPHash,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
};
