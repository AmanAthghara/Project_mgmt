require('dotenv').config();

const app              = require('./app');
const { testConnection } = require('./config/db');
const logger           = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const start = async () => {
  // 1. Verify DB connectivity before accepting traffic
  await testConnection();

  // 2. Start HTTP server
  const server = app.listen(PORT, () => {
    logger.success('SERVER', `🚀 API running on http://localhost:${PORT}/api`);
    logger.info   ('SERVER', `Environment : ${process.env.NODE_ENV || 'development'}`);
    logger.info   ('SERVER', `CORS origin : ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    console.log('');
    console.log('  Available routes:');
    console.log('  POST   /api/auth/register');
    console.log('  POST   /api/auth/verify-otp');
    console.log('  POST   /api/auth/login');
    console.log('  POST   /api/auth/forgot-password');
    console.log('  POST   /api/auth/reset-password');
    console.log('  GET    /api/auth/me                 [protected]');
    console.log('  PUT    /api/auth/me                 [protected]');
    console.log('  PUT    /api/auth/change-password    [protected]');
    console.log('  GET    /api/projects                [protected]');
    console.log('  POST   /api/projects                [protected]');
    console.log('  GET    /api/projects/me             [protected]');
    console.log('  GET    /api/projects/:id            [protected]');
    console.log('  PUT    /api/projects/:id            [admin]');
    console.log('  DELETE /api/projects/:id            [admin]');
    console.log('  GET    /api/projects/:id/members    [member]');
    console.log('  DELETE /api/projects/:id/members/:uid [admin]');
    console.log('  PUT    /api/projects/:id/members/:uid/promote [admin]');
    console.log('  GET    /api/projects/:id/search-users [admin]');
    console.log('  POST   /api/projects/:id/invite     [admin]');
    console.log('  POST   /api/projects/:id/join       [protected]');
    console.log('  GET    /api/projects/:id/requests   [admin]');
    console.log('  PUT    /api/projects/:id/requests/:rid [admin]');
    console.log('  GET    /api/projects/:id/tasks      [member]');
    console.log('  POST   /api/projects/:id/tasks      [admin]');
    console.log('  GET    /api/projects/:id/tasks/stats [member]');
    console.log('  GET    /api/projects/:id/tasks/:tid [member]');
    console.log('  PUT    /api/projects/:id/tasks/:tid [admin]');
    console.log('  PUT    /api/projects/:id/tasks/:tid/assign   [admin]');
    console.log('  PUT    /api/projects/:id/tasks/:tid/complete [member]');
    console.log('  DELETE /api/projects/:id/tasks/:tid [admin]');
    console.log('  GET    /api/tasks/me                [protected]');
    console.log('  GET    /api/join-requests/me        [protected]');
    console.log('  DELETE /api/join-requests/:id       [protected]');
    console.log('  GET    /api/health');
    console.log('');
  });

  // ── Graceful shutdown ────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.warn('SERVER', `${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info('SERVER', 'HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10s if connections hang
    setTimeout(() => {
      logger.error('SERVER', 'Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('SERVER', 'Unhandled promise rejection', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('SERVER', 'Uncaught exception', err.message);
    console.error(err.stack);
    process.exit(1);
  });
};

start();
