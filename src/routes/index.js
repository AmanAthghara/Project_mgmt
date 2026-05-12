const express      = require('express');
const router       = express.Router();

const authRoutes    = require('./auth.routes');
const projectRoutes = require('./project.routes');
const userRoutes    = require('./user.routes');

// ── Health check ──────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ── Mount routers ─────────────────────────────────────────────
router.use('/auth',     authRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks',    userRoutes);       // /api/tasks/me
router.use('/',         userRoutes);       // /api/join-requests/me, etc.

module.exports = router;
