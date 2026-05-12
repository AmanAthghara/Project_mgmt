const projectService = require('../services/project.service');
const logger = require('../utils/logger');
const {
  sendSuccess, sendCreated, sendError, sendNotFound,
} = require('../utils/response');

// POST /api/projects
const createProject = async (req, res, next) => {
  logger.info('CTRL:PROJECT', 'createProject', { userId: req.user.id, body: req.body });
  try {
    const project = await projectService.createProject(req.user.id, req.body);
    return sendCreated(res, 'Project created successfully', { project });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// GET /api/projects  (public projects, searchable)
const getPublicProjects = async (req, res, next) => {
  logger.info('CTRL:PROJECT', 'getPublicProjects', { query: req.query });
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const result = await projectService.getPublicProjects({ search, page, limit });
    return sendSuccess(res, 'Public projects fetched', result.projects, 200, result.meta);
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/me  (projects I'm a member of)
const getMyProjects = async (req, res, next) => {
  logger.info('CTRL:PROJECT', 'getMyProjects', { userId: req.user.id });
  try {
    const projects = await projectService.getMyProjects(req.user.id);
    return sendSuccess(res, 'Your projects fetched', { projects });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/:projectId
const getProject = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:PROJECT', `getProject ${projectId}`, { userId: req.user.id });
  try {
    const project = await projectService.getProjectById(projectId, req.user.id);
    return sendSuccess(res, 'Project fetched', { project });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// PUT /api/projects/:projectId  [admin]
const updateProject = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:PROJECT', `updateProject ${projectId}`, { userId: req.user.id });
  try {
    const project = await projectService.updateProject(projectId, req.body);
    return sendSuccess(res, 'Project updated', { project });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// DELETE /api/projects/:projectId  [admin]
const deleteProject = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:PROJECT', `deleteProject ${projectId}`, { userId: req.user.id });
  try {
    await projectService.deleteProject(projectId);
    return sendSuccess(res, 'Project deleted');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// GET /api/projects/:projectId/members  [member+]
const getMembers = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:PROJECT', `getMembers project=${projectId}`);
  try {
    const members = await projectService.getProjectMembers(projectId);
    return sendSuccess(res, 'Members fetched', { members });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/projects/:projectId/members/:userId  [admin]
const removeMember = async (req, res, next) => {
  const { projectId, userId } = req.params;
  logger.info('CTRL:PROJECT', `removeMember user=${userId} from project=${projectId}`, { by: req.user.id });
  try {
    await projectService.removeMember(projectId, parseInt(userId), req.user.id);
    return sendSuccess(res, 'Member removed');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// PUT /api/projects/:projectId/members/:userId/promote  [admin]
const promoteMember = async (req, res, next) => {
  const { projectId, userId } = req.params;
  logger.info('CTRL:PROJECT', `promoteMember user=${userId} in project=${projectId}`);
  try {
    await projectService.promoteMember(projectId, parseInt(userId));
    return sendSuccess(res, 'Member promoted to admin');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// GET /api/projects/:projectId/search-users?q=  [admin]
const searchUsers = async (req, res, next) => {
  const { projectId } = req.params;
  const { q = '' } = req.query;
  logger.info('CTRL:PROJECT', `searchUsers q="${q}" project=${projectId}`);
  try {
    if (q.trim().length < 2) {
      return sendSuccess(res, 'Search query too short', { users: [] });
    }
    const users = await projectService.searchUsers(q, projectId);
    return sendSuccess(res, 'Users found', { users });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProject,
  getPublicProjects,
  getMyProjects,
  getProject,
  updateProject,
  deleteProject,
  getMembers,
  removeMember,
  promoteMember,
  searchUsers,
};
