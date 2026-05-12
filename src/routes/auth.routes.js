const express = require('express');
const router  = express.Router();

const authCtrl = require('../controllers/auth.controller');
const { authenticate, validate } = require('../middlewares');
const {
  registerInitRules,
  verifyOTPRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
} = require('../validators');

// ── Public ────────────────────────────────────────────────────

// Step 1: send OTP
router.post('/register',        registerInitRules,    validate, authCtrl.registerInit);

// Step 2: verify OTP → create account + issue tokens
router.post('/verify-otp',      verifyOTPRules,       validate, authCtrl.verifyOTP);

router.post('/login',           loginRules,           validate, authCtrl.login);
router.post('/forgot-password', forgotPasswordRules,  validate, authCtrl.forgotPassword);
router.post('/reset-password',  resetPasswordRules,   validate, authCtrl.resetPassword);

// ── Protected ─────────────────────────────────────────────────

router.get ('/me',              authenticate, authCtrl.getMe);
router.put ('/me',              authenticate, authCtrl.updateMe);
router.put ('/change-password', authenticate, changePasswordRules, validate, authCtrl.changePassword);

module.exports = router;
