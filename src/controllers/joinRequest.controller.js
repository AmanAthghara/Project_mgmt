const joinRequestService = require('../services/joinRequest.service');
const logger = require('../utils/logger');
const { sendSuccess, sendCreated, sendError } = require('../utils/response');

// POST /api/projects/:projectId/invite  [admin]
const adminInvite = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:JOIN', `adminInvite project=${projectId}`, { adminId: req.user.id, body: req.body });
  try {
    const request = await joinRequestService.adminInviteUser(projectId, req.user.id, req.body);
    return sendCreated(res, 'Invitation sent', { request });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// POST /api/projects/:projectId/join  [any authenticated user]
const requestJoin = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:JOIN', `requestJoin project=${projectId}`, { userId: req.user.id });
  try {
    const request = await joinRequestService.memberRequestJoin(projectId, req.user.id, req.body);
    return sendCreated(res, 'Join request sent', { request });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// GET /api/projects/:projectId/requests  [admin]
const getPendingRequests = async (req, res, next) => {
  const { projectId } = req.params;
  logger.info('CTRL:JOIN', `getPendingRequests project=${projectId}`);
  try {
    const requests = await joinRequestService.getPendingRequests(projectId);
    return sendSuccess(res, 'Pending requests fetched', { requests });
  } catch (err) {
    next(err);
  }
};

// PUT /api/projects/:projectId/requests/:requestId  [admin]
// body: { action: "accepted" | "rejected" }
const resolveRequest = async (req, res, next) => {
  const { requestId } = req.params;
  const { action } = req.body;
  logger.info('CTRL:JOIN', `resolveRequest ${requestId} → ${action}`, { adminId: req.user.id });
  try {
    if (!['accepted', 'rejected'].includes(action)) {
      return sendError(res, 'action must be "accepted" or "rejected"', 400);
    }
    const result = await joinRequestService.resolveRequest(requestId, req.user.id, action);
    return sendSuccess(res, result.message);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// GET /api/join-requests/me  [authenticated user]
const getMyRequests = async (req, res, next) => {
  logger.info('CTRL:JOIN', `getMyRequests user=${req.user.id}`);
  try {
    const requests = await joinRequestService.getMyRequests(req.user.id);
    return sendSuccess(res, 'Your join requests fetched', { requests });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/join-requests/:requestId  [authenticated user]
const cancelRequest = async (req, res, next) => {
  const { requestId } = req.params;
  logger.info('CTRL:JOIN', `cancelRequest ${requestId}`, { userId: req.user.id });
  try {
    await joinRequestService.cancelRequest(requestId, req.user.id);
    return sendSuccess(res, 'Request cancelled');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

module.exports = {
  adminInvite,
  requestJoin,
  getPendingRequests,
  resolveRequest,
  getMyRequests,
  cancelRequest,
};
