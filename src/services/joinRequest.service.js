const { query, getClient } = require('../config/db');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════
//  ADMIN INVITES A USER
// ══════════════════════════════════════════════════════════════
const adminInviteUser = async (projectId, adminId, { user_id, message }) => {
  logger.info('JOIN_SVC', `Admin ${adminId} inviting user ${user_id} to project ${projectId}`);

  // Check target user exists
  const userCheck = await query('SELECT id FROM users WHERE id = $1 AND is_active = TRUE', [user_id]);
  if (!userCheck.rows.length) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  // Check not already a member
  const memberCheck = await query(
    'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, user_id]
  );
  if (memberCheck.rows.length) {
    throw Object.assign(new Error('User is already a member of this project'), { statusCode: 409 });
  }

  // Check no pending request already exists
  const existing = await query(
    `SELECT id, status FROM join_requests
     WHERE project_id = $1 AND requester_id = $2`,
    [projectId, user_id]
  );
  if (existing.rows.length) {
    throw Object.assign(
      new Error(`A ${existing.rows[0].status} request already exists for this user`),
      { statusCode: 409 }
    );
  }

  const { rows } = await query(
    `INSERT INTO join_requests (project_id, requester_id, type, message)
     VALUES ($1, $2, 'admin_invite', $3) RETURNING *`,
    [projectId, user_id, message || null]
  );

  logger.success('JOIN_SVC', `Admin invite created (id=${rows[0].id})`);
  return rows[0];
};

// ══════════════════════════════════════════════════════════════
//  MEMBER REQUESTS TO JOIN A PUBLIC PROJECT
// ══════════════════════════════════════════════════════════════
const memberRequestJoin = async (projectId, userId, { message }) => {
  logger.info('JOIN_SVC', `User ${userId} requesting to join project ${projectId}`);

  // Project must be public
  const projectCheck = await query(
    `SELECT id, visibility FROM projects WHERE id = $1`,
    [projectId]
  );
  if (!projectCheck.rows.length) {
    throw Object.assign(new Error('Project not found'), { statusCode: 404 });
  }
  if (projectCheck.rows[0].visibility === 'private') {
    throw Object.assign(new Error('Cannot request to join a private project'), { statusCode: 403 });
  }

  // Not already a member
  const memberCheck = await query(
    'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  if (memberCheck.rows.length) {
    throw Object.assign(new Error('You are already a member of this project'), { statusCode: 409 });
  }

  // No duplicate pending request
  const existing = await query(
    `SELECT id FROM join_requests WHERE project_id = $1 AND requester_id = $2`,
    [projectId, userId]
  );
  if (existing.rows.length) {
    throw Object.assign(new Error('You already have a pending request for this project'), { statusCode: 409 });
  }

  const { rows } = await query(
    `INSERT INTO join_requests (project_id, requester_id, type, message)
     VALUES ($1, $2, 'member_request', $3) RETURNING *`,
    [projectId, userId, message || null]
  );

  logger.success('JOIN_SVC', `Member join request created (id=${rows[0].id})`);
  return rows[0];
};

// ══════════════════════════════════════════════════════════════
//  LIST PENDING REQUESTS FOR A PROJECT  (admin view)
// ══════════════════════════════════════════════════════════════
const getPendingRequests = async (projectId) => {
  logger.info('JOIN_SVC', `Fetching pending requests for project ${projectId}`);

  const { rows } = await query(
    `SELECT jr.*,
            u.first_name AS requester_first_name,
            u.last_name  AS requester_last_name,
            u.email      AS requester_email
     FROM join_requests jr
     JOIN users u ON u.id = jr.requester_id
     WHERE jr.project_id = $1 AND jr.status = 'pending'
     ORDER BY jr.created_at ASC`,
    [projectId]
  );

  return rows;
};

// ══════════════════════════════════════════════════════════════
//  ADMIN RESOLVES A REQUEST (accept / reject)
// ══════════════════════════════════════════════════════════════
const resolveRequest = async (requestId, adminId, action) => {
  if (!['accepted', 'rejected'].includes(action)) {
    throw Object.assign(new Error('action must be "accepted" or "rejected"'), { statusCode: 400 });
  }

  logger.info('JOIN_SVC', `Admin ${adminId} resolving request ${requestId} → ${action}`);

  const { rows } = await query(
    `SELECT * FROM join_requests WHERE id = $1 AND status = 'pending'`,
    [requestId]
  );

  if (!rows.length) {
    throw Object.assign(new Error('Request not found or already resolved'), { statusCode: 404 });
  }

  const request = rows[0];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE join_requests
       SET status = $1, resolved_by = $2, resolved_at = NOW()
       WHERE id = $3`,
      [action, adminId, requestId]
    );

    if (action === 'accepted') {
      // Add to project_members (ignore if somehow already there)
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [request.project_id, request.requester_id]
      );
      logger.success('JOIN_SVC', `User ${request.requester_id} added to project ${request.project_id}`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { message: `Request ${action}` };
};

// ══════════════════════════════════════════════════════════════
//  LIST MY REQUESTS  (for the requesting user)
// ══════════════════════════════════════════════════════════════
const getMyRequests = async (userId) => {
  logger.info('JOIN_SVC', `Fetching join requests for user ${userId}`);

  const { rows } = await query(
    `SELECT jr.*,
            p.name  AS project_name,
            p.visibility
     FROM join_requests jr
     JOIN projects p ON p.id = jr.project_id
     WHERE jr.requester_id = $1
     ORDER BY jr.created_at DESC`,
    [userId]
  );

  return rows;
};



// ══════════════════════════════════════════════════════════════
//  INVITED USER ACCEPTS OR REJECTS THEIR OWN ADMIN INVITE
// ══════════════════════════════════════════════════════════════
const resolveOwnInvite = async (requestId, userId, action) => {
  if (!['accepted', 'rejected'].includes(action)) {
    throw Object.assign(new Error('action must be "accepted" or "rejected"'), { statusCode: 400 });
  }

  logger.info('JOIN_SVC', `User ${userId} resolving own invite ${requestId} → ${action}`);

  const { rows } = await query(
    `SELECT * FROM join_requests
     WHERE id = $1 AND requester_id = $2 AND type = 'admin_invite' AND status = 'pending'`,
    [requestId, userId]
  );

  if (!rows.length) {
    throw Object.assign(new Error('Invite not found or already resolved'), { statusCode: 404 });
  }

  const request = rows[0];
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE join_requests SET status = $1, resolved_at = NOW() WHERE id = $2`,
      [action, requestId]
    );
    if (action === 'accepted') {
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [request.project_id, userId]
      );
      logger.success('JOIN_SVC', `User ${userId} accepted invite and joined project ${request.project_id}`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { message: `Invite ${action}`, project_id: request.project_id };
};


// ══════════════════════════════════════════════════════════════
//  CANCEL A REQUEST  (by the requester themselves)
// ══════════════════════════════════════════════════════════════
const cancelRequest = async (requestId, userId) => {
  logger.info('JOIN_SVC', `User ${userId} cancelling request ${requestId}`);

  const { rowCount } = await query(
    `DELETE FROM join_requests
     WHERE id = $1 AND requester_id = $2 AND status = 'pending'`,
    [requestId, userId]
  );

  if (!rowCount) {
    throw Object.assign(new Error('Request not found or cannot be cancelled'), { statusCode: 404 });
  }

  logger.success('JOIN_SVC', `Request ${requestId} cancelled`);
};

module.exports = {
  adminInviteUser,
  memberRequestJoin,
  getPendingRequests,
  resolveRequest,
  resolveOwnInvite,
  getMyRequests,
  cancelRequest,
};
