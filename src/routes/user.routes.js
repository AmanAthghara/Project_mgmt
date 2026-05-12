const express = require('express');
const router  = express.Router();

const taskCtrl        = require('../controllers/task.controller');
const joinRequestCtrl = require('../controllers/joinRequest.controller');
const { authenticate, validate } = require('../middlewares');
const { idParam } = require('../validators');

router.use(authenticate);

// GET /api/tasks/me  — personal task list (all projects)
router.get('/me', taskCtrl.getMyTasks);

// GET /api/join-requests/me  — my outbound join requests
router.get('/join-requests/me', joinRequestCtrl.getMyRequests);

// DELETE /api/join-requests/:requestId  — cancel my request
router.delete('/join-requests/:requestId',
  idParam('requestId'), validate,
  joinRequestCtrl.cancelRequest
);

module.exports = router;
