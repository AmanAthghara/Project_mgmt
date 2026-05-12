const express = require('express');
const router  = express.Router();

const projectCtrl     = require('../controllers/project.controller');
const joinRequestCtrl = require('../controllers/joinRequest.controller');
const taskCtrl        = require('../controllers/task.controller');
const { authenticate, requireProjectRole, validate } = require('../middlewares');
const {
  createProjectRules,
  updateProjectRules,
  createTaskRules,
  updateTaskRules,
  joinRequestRules,
  inviteUserRules,
  idParam,
  searchQueryRules,
} = require('../validators');

// ── All project routes require authentication ─────────────────
router.use(authenticate);

// ── Project CRUD ──────────────────────────────────────────────

router.get ('/',    searchQueryRules, validate, projectCtrl.getPublicProjects);
router.post('/',    createProjectRules, validate, projectCtrl.createProject);
router.get ('/me',  projectCtrl.getMyProjects);

router.get   ('/:projectId', idParam('projectId'), validate, projectCtrl.getProject);
router.put   ('/:projectId', idParam('projectId'), validate, updateProjectRules, validate,
              requireProjectRole('admin'), projectCtrl.updateProject);
router.delete('/:projectId', idParam('projectId'), validate,
              requireProjectRole('admin'), projectCtrl.deleteProject);

// ── Members ───────────────────────────────────────────────────

router.get('/:projectId/members',
  idParam('projectId'), validate,
  requireProjectRole('admin', 'member'),
  projectCtrl.getMembers
);

router.delete('/:projectId/members/:userId',
  idParam('projectId'), validate,
  requireProjectRole('admin'),
  projectCtrl.removeMember
);

router.put('/:projectId/members/:userId/promote',
  idParam('projectId'), validate,
  requireProjectRole('admin'),
  projectCtrl.promoteMember
);

// ── Search users to invite  (admin) ──────────────────────────

router.get('/:projectId/search-users',
  idParam('projectId'), validate,
  requireProjectRole('admin'),
  projectCtrl.searchUsers
);

// ── Join Requests ─────────────────────────────────────────────

// Admin invites a user
router.post('/:projectId/invite',
  idParam('projectId'), validate,
  inviteUserRules, validate,
  requireProjectRole('admin'),
  joinRequestCtrl.adminInvite
);

// Member requests to join a public project
router.post('/:projectId/join',
  idParam('projectId'), validate,
  joinRequestRules, validate,
  joinRequestCtrl.requestJoin
);

// Admin views pending requests
router.get('/:projectId/requests',
  idParam('projectId'), validate,
  requireProjectRole('admin'),
  joinRequestCtrl.getPendingRequests
);

// Admin resolves (accept/reject) a request
router.put('/:projectId/requests/:requestId',
  idParam('projectId'), validate,
  requireProjectRole('admin'),
  joinRequestCtrl.resolveRequest
);

// ── Tasks ─────────────────────────────────────────────────────

// Stats (before :taskId to avoid route collision)
router.get('/:projectId/tasks/stats',
  idParam('projectId'), validate,
  requireProjectRole('admin', 'member'),
  taskCtrl.getTaskStats
);

// List all project tasks
router.get('/:projectId/tasks',
  idParam('projectId'), validate,
  requireProjectRole('admin', 'member'),
  taskCtrl.getProjectTasks
);

// Create task (admin)
router.post('/:projectId/tasks',
  idParam('projectId'), validate,
  createTaskRules, validate,
  requireProjectRole('admin'),
  taskCtrl.createTask
);

// Get single task
router.get('/:projectId/tasks/:taskId',
  idParam('projectId'), idParam('taskId'), validate,
  requireProjectRole('admin', 'member'),
  taskCtrl.getTask
);

// Update task (admin)
router.put('/:projectId/tasks/:taskId',
  idParam('projectId'), idParam('taskId'), validate,
  updateTaskRules, validate,
  requireProjectRole('admin'),
  taskCtrl.updateTask
);

// Assign task to a member (admin)
router.put('/:projectId/tasks/:taskId/assign',
  idParam('projectId'), idParam('taskId'), validate,
  requireProjectRole('admin'),
  taskCtrl.assignTask
);

// Member marks their own task complete
router.put('/:projectId/tasks/:taskId/complete',
  idParam('projectId'), idParam('taskId'), validate,
  requireProjectRole('admin', 'member'),
  taskCtrl.markComplete
);

// Delete task (admin)
router.delete('/:projectId/tasks/:taskId',
  idParam('projectId'), idParam('taskId'), validate,
  requireProjectRole('admin'),
  taskCtrl.deleteTask
);

module.exports = router;
