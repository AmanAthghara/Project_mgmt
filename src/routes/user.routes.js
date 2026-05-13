const express = require('express');
const router  = express.Router();

const taskCtrl        = require('../controllers/task.controller');
const joinRequestCtrl = require('../controllers/joinRequest.controller');
const { authenticate, validate } = require('../middlewares');
const { idParam } = require('../validators');

router.use(authenticate);

// GET /api/tasks/me  — personal task list (all projects)
router.get('/me', taskCtrl.getMyTasks);

// GET /api/join-requests/me  — my requests + invites received
router.get('/join-requests/me', joinRequestCtrl.getMyRequests);

// PUT /api/join-requests/:requestId/respond  — accept or reject an admin invite
router.put('/join-requests/:requestId/respond',
  idParam('requestId'), validate,
  joinRequestCtrl.respondToInvite
);

// DELETE /api/join-requests/:requestId  — cancel my own member_request
router.delete('/join-requests/:requestId',
  idParam('requestId'), validate,
  joinRequestCtrl.cancelRequest
);

module.exports = router;
