// ── Coloured console logger ──────────────────────────────────
// Keeps all console.log calls consistent across the codebase.

const COLORS = {
  reset:   '\x1b[0m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  blue:    '\x1b[34m',
  gray:    '\x1b[90m',
  bold:    '\x1b[1m',
};

const stamp = () => new Date().toISOString();

const logger = {
  info: (tag, msg, meta = '') => {
    console.log(
      `${COLORS.gray}${stamp()}${COLORS.reset} ${COLORS.cyan}[${tag}]${COLORS.reset} ${msg}`,
      meta || ''
    );
  },

  success: (tag, msg, meta = '') => {
    console.log(
      `${COLORS.gray}${stamp()}${COLORS.reset} ${COLORS.green}[${tag}]${COLORS.reset} ✅ ${msg}`,
      meta || ''
    );
  },

  warn: (tag, msg, meta = '') => {
    console.warn(
      `${COLORS.gray}${stamp()}${COLORS.reset} ${COLORS.yellow}[${tag}]${COLORS.reset} ⚠️  ${msg}`,
      meta || ''
    );
  },

  error: (tag, msg, meta = '') => {
    console.error(
      `${COLORS.gray}${stamp()}${COLORS.reset} ${COLORS.red}[${tag}]${COLORS.reset} ❌ ${msg}`,
      meta || ''
    );
  },

  request: (method, url, statusCode, durationMs, userId = 'guest') => {
    const color =
      statusCode >= 500 ? COLORS.red :
      statusCode >= 400 ? COLORS.yellow :
      statusCode >= 300 ? COLORS.cyan :
      COLORS.green;

    console.log(
      `${COLORS.gray}${stamp()}${COLORS.reset} ` +
      `${COLORS.bold}${COLORS.blue}[REQUEST]${COLORS.reset} ` +
      `${color}${statusCode}${COLORS.reset} ` +
      `${COLORS.bold}${method}${COLORS.reset} ${url} ` +
      `${COLORS.gray}(${durationMs}ms | user: ${userId})${COLORS.reset}`
    );
  },

  auth: (action, email, extra = '') => {
    console.log(
      `${COLORS.gray}${stamp()}${COLORS.reset} ${COLORS.magenta}[AUTH]${COLORS.reset} ` +
      `${action} → ${email} ${extra}`
    );
  },
};

module.exports = logger;
