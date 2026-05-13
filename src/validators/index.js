const { body, param, query } = require('express-validator');

// ── Auth ──────────────────────────────────────────────────────
const registerInitRules = [
  body('first_name').trim().notEmpty().withMessage('First name is required').isLength({ max: 80 }),
  body('last_name').trim().notEmpty().withMessage('Last name is required').isLength({ max: 80 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('age').isInt({ min: 13, max: 120 }).withMessage('Age must be between 13 and 120'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Invalid gender value'),
  body('phone_number')
    .optional()
    .isMobilePhone()
    .withMessage('Invalid phone number'),
];

const verifyOTPRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits').isNumeric(),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotPasswordRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
];

const resetPasswordRules = [
  body('token').trim().notEmpty().withMessage('Reset token is required'),
  body('new_password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

const changePasswordRules = [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .custom((val, { req }) => {
      if (val === req.body.current_password) throw new Error('New password must differ from current');
      return true;
    }),
];

// ── Projects ──────────────────────────────────────────────────
const createProjectRules = [
  body('name').trim().notEmpty().withMessage('Project name is required').isLength({ max: 150 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('visibility').optional().isIn(['public', 'private']).withMessage('visibility must be public or private'),
];

const updateProjectRules = [
  body('name').optional().trim().notEmpty().isLength({ max: 150 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('visibility').optional().isIn(['public', 'private']),
];

// ── Tasks ─────────────────────────────────────────────────────
const createTaskRules = [
  body('title').trim().notEmpty().withMessage('Task title is required').isLength({ max: 200 }),
  body('description').optional().trim(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assigned_to').optional().isInt().withMessage('assigned_to must be a user ID'),
  body('due_date').optional().isDate().withMessage('due_date must be YYYY-MM-DD'),
];

const updateTaskRules = [
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().trim(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assigned_to').optional().isInt(),
  body('due_date').optional().isDate(),
  body('status').optional().isIn(['pending', 'in_progress', 'completed']),
];

// ── Join Requests ─────────────────────────────────────────────
const joinRequestRules = [
  body('message').optional().trim().isLength({ max: 500 }),
];

const inviteUserRules = [
  body('user_id').isInt().withMessage('user_id is required and must be an integer'),
  body('message').optional().trim().isLength({ max: 500 }),
];

// ── Params ────────────────────────────────────────────────────
const idParam = (name = 'id') => [
  param(name).isInt({ min: 1 }).withMessage(`${name} must be a positive integer`),
];

// ── Search ────────────────────────────────────────────────────
const searchQueryRules = [
  query('q').optional({ nullable: true }).trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

module.exports = {
  registerInitRules,
  verifyOTPRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
  createProjectRules,
  updateProjectRules,
  createTaskRules,
  updateTaskRules,
  joinRequestRules,
  inviteUserRules,
  idParam,
  searchQueryRules,
};
