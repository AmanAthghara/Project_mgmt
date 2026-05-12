const taskService = require('../services/task.service');
const logger = require('../utils/logger');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');

// POST /api/projects/:projectId/tasks  [admin]
const createTask = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:TASK', `createTask project=${projectId}`, { adminId: req.user.id, body: req.body });
  try {
    const task = await taskService.createTask(projectId, req.user.id, req.body);
    return sendCreated(res, 'Task created', { task });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// GET /api/projects/:projectId/tasks  [member+]
// query params: status, priority, assigned_to, page, limit
const getProjectTasks = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:TASK', `getProjectTasks project=${projectId}`, { query: req.query });
  try {
    const tasks = await taskService.getProjectTasks(projectId, req.query);
    return sendSuccess(res, 'Project tasks fetched', { tasks });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/:projectId/tasks/stats  [member+]
const getTaskStats = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:TASK', `getTaskStats project=${projectId}`);
  try {
    const stats = await taskService.getProjectTaskStats(projectId);
    return sendSuccess(res, 'Task stats fetched', { stats });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/me  [authenticated user — personal task list]
const getMyTasks = async (req, res, next) => {
  logger.info('CTRL:TASK', `getMyTasks user=${req.user.id}`, { query: req.query });
  try {
    const { status, projectId } = req.query;
    const tasks = await taskService.getMyTasks(req.user.id, { status, projectId });
    return sendSuccess(res, 'Your tasks fetched', { tasks });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/:projectId/tasks/:taskId  [member+]
const getTask = async (req, res, next) => {
  const { projectId, taskId } = req.params;
  logger.info('CTRL:TASK', `getTask ${taskId} project=${projectId}`);
  try {
    const task = await taskService.getTaskById(taskId, projectId);
    return sendSuccess(res, 'Task fetched', { task });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// PUT /api/projects/:projectId/tasks/:taskId  [admin]
const updateTask = async (req, res, next) => {
  const { projectId, taskId } = req.params;
  logger.info('CTRL:TASK', `updateTask ${taskId} project=${projectId}`, { body: req.body });
  try {
    const task = await taskService.updateTask(taskId, projectId, req.body);
    return sendSuccess(res, 'Task updated', { task });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// PUT /api/projects/:projectId/tasks/:taskId/assign  [admin]
const assignTask = async (req, res, next) => {
  const { projectId, taskId } = req.params;
  const { assigned_to } = req.body;
  logger.info('CTRL:TASK', `assignTask ${taskId} to user=${assigned_to} project=${projectId}`);
  try {
    if (!assigned_to) return sendError(res, 'assigned_to (user ID) is required', 400);
    const task = await taskService.assignTask(taskId, projectId, assigned_to);
    return sendSuccess(res, 'Task assigned', { task });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// PUT /api/projects/:projectId/tasks/:taskId/complete  [member — own tasks only]
const markComplete = async (req, res, next) => {
  const { taskId } = req.params;
  logger.info('CTRL:TASK', `markComplete task=${taskId} by user=${req.user.id}`);
  try {
    const task = await taskService.markTaskComplete(taskId, req.user.id);
    return sendSuccess(res, 'Task marked as complete', { task });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// DELETE /api/projects/:projectId/tasks/:taskId  [admin]
const deleteTask = async (req, res, next) => {
  const { projectId, taskId } = req.params;
  logger.info('CTRL:TASK', `deleteTask ${taskId} project=${projectId}`, { adminId: req.user.id });
  try {
    await taskService.deleteTask(taskId, projectId);
    return sendSuccess(res, 'Task deleted');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

module.exports = {
  createTask,
  getProjectTasks,
  getTaskStats,
  getMyTasks,
  getTask,
  updateTask,
  assignTask,
  markComplete,
  deleteTask,
};
