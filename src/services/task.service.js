const { query } = require('../config/db');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════
//  CREATE TASK  (admin only — enforced in route)
// ══════════════════════════════════════════════════════════════
const createTask = async (projectId, adminId, { title, description, priority, assigned_to, due_date }) => {
  logger.info('TASK_SVC', `Admin ${adminId} creating task "${title}" in project ${projectId}`);

  // If assigning, verify the target is a project member
  if (assigned_to) {
    const check = await query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, assigned_to]
    );
    if (!check.rows.length) {
      throw Object.assign(
        new Error('assigned_to user is not a member of this project'),
        { statusCode: 400 }
      );
    }
  }

  const { rows } = await query(
    `INSERT INTO tasks (project_id, title, description, priority, created_by, assigned_to, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      projectId,
      title,
      description || null,
      priority   || 'medium',
      adminId,
      assigned_to || null,
      due_date   || null,
    ]
  );

  logger.success('TASK_SVC', `Task ${rows[0].id} created in project ${projectId}`);
  return rows[0];
};

// ══════════════════════════════════════════════════════════════
//  GET ALL PROJECT TASKS  (all members can see)
// ══════════════════════════════════════════════════════════════
const getProjectTasks = async (projectId, { status, priority, assigned_to, page = 1, limit = 50 } = {}) => {
  logger.info('TASK_SVC', `Fetching tasks for project ${projectId}`);

  const conditions = ['t.project_id = $1'];
  const values     = [projectId];
  let idx = 2;

  if (status) {
    conditions.push(`t.status = $${idx++}`);
    values.push(status);
  }
  if (priority) {
    conditions.push(`t.priority = $${idx++}`);
    values.push(priority);
  }
  if (assigned_to) {
    conditions.push(`t.assigned_to = $${idx++}`);
    values.push(assigned_to);
  }

  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const { rows } = await query(
    `SELECT t.*,
            creator.first_name  AS creator_first_name,
            creator.last_name   AS creator_last_name,
            assignee.first_name AS assignee_first_name,
            assignee.last_name  AS assignee_last_name
     FROM tasks t
     JOIN  users creator  ON creator.id  = t.created_by
     LEFT JOIN users assignee ON assignee.id = t.assigned_to
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
                       WHEN 'medium' THEN 3 ELSE 4 END,
       t.due_date ASC NULLS LAST,
       t.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    values
  );

  return rows;
};

// ══════════════════════════════════════════════════════════════
//  GET MY TASKS  (tasks assigned to the requesting user)
// ══════════════════════════════════════════════════════════════
const getMyTasks = async (userId, { status, projectId } = {}) => {
  logger.info('TASK_SVC', `Fetching personal tasks for user ${userId}`);

  const conditions = ['t.assigned_to = $1'];
  const values     = [userId];
  let idx = 2;

  if (status) {
    conditions.push(`t.status = $${idx++}`);
    values.push(status);
  }
  if (projectId) {
    conditions.push(`t.project_id = $${idx++}`);
    values.push(projectId);
  }

  const { rows } = await query(
    `SELECT t.*,
            p.name AS project_name,
            creator.first_name AS creator_first_name,
            creator.last_name  AS creator_last_name
     FROM tasks t
     JOIN projects p      ON p.id      = t.project_id
     JOIN users   creator ON creator.id = t.created_by
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE t.status WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
       t.due_date ASC NULLS LAST`,
    values
  );

  return rows;
};

// ══════════════════════════════════════════════════════════════
//  GET SINGLE TASK
// ══════════════════════════════════════════════════════════════
const getTaskById = async (taskId, projectId) => {
  const { rows } = await query(
    `SELECT t.*,
            creator.first_name  AS creator_first_name,
            creator.last_name   AS creator_last_name,
            assignee.first_name AS assignee_first_name,
            assignee.last_name  AS assignee_last_name
     FROM tasks t
     JOIN  users creator  ON creator.id  = t.created_by
     LEFT JOIN users assignee ON assignee.id = t.assigned_to
     WHERE t.id = $1 AND t.project_id = $2`,
    [taskId, projectId]
  );

  if (!rows.length) throw Object.assign(new Error('Task not found'), { statusCode: 404 });
  return rows[0];
};

// ══════════════════════════════════════════════════════════════
//  UPDATE TASK  (admin only)
//  Can update: title, description, priority, assigned_to, due_date, status
// ══════════════════════════════════════════════════════════════
const updateTask = async (taskId, projectId, updates) => {
  logger.info('TASK_SVC', `Updating task ${taskId}`);

  // If re-assigning, verify new assignee is a project member
  if (updates.assigned_to) {
    const check = await query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, updates.assigned_to]
    );
    if (!check.rows.length) {
      throw Object.assign(
        new Error('assigned_to user is not a member of this project'),
        { statusCode: 400 }
      );
    }
  }

  const allowed = ['title', 'description', 'priority', 'assigned_to', 'due_date', 'status'];
  const fields  = [];
  const values  = [];
  let idx = 1;

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(updates[key] === '' ? null : updates[key]);
    }
  }

  // Auto-set completed_at when status flips to completed
  if (updates.status === 'completed') {
    fields.push(`completed_at = NOW()`);
  } else if (updates.status && updates.status !== 'completed') {
    fields.push(`completed_at = NULL`);
  }

  if (!fields.length) throw Object.assign(new Error('No fields to update'), { statusCode: 400 });

  values.push(taskId, projectId);
  const { rows } = await query(
    `UPDATE tasks SET ${fields.join(', ')}
     WHERE id = $${idx++} AND project_id = $${idx} RETURNING *`,
    values
  );

  if (!rows.length) throw Object.assign(new Error('Task not found'), { statusCode: 404 });

  logger.success('TASK_SVC', `Task ${taskId} updated`);
  return rows[0];
};

// ══════════════════════════════════════════════════════════════
//  MEMBER MARKS THEIR TASK AS COMPLETE
// ══════════════════════════════════════════════════════════════
const markTaskComplete = async (taskId, userId) => {
  logger.info('TASK_SVC', `User ${userId} marking task ${taskId} as complete`);

  const { rows } = await query(
    `UPDATE tasks
     SET status = 'completed', completed_at = NOW()
     WHERE id = $1 AND assigned_to = $2
     RETURNING *`,
    [taskId, userId]
  );

  if (!rows.length) {
    throw Object.assign(
      new Error('Task not found or not assigned to you'),
      { statusCode: 404 }
    );
  }

  logger.success('TASK_SVC', `Task ${taskId} marked complete by user ${userId}`);
  return rows[0];
};

// ══════════════════════════════════════════════════════════════
//  ASSIGN TASK TO A MEMBER  (admin only — separate endpoint)
// ══════════════════════════════════════════════════════════════
const assignTask = async (taskId, projectId, assigneeId) => {
  logger.info('TASK_SVC', `Assigning task ${taskId} to user ${assigneeId}`);

  // Verify assignee is a project member
  const check = await query(
    'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, assigneeId]
  );
  if (!check.rows.length) {
    throw Object.assign(
      new Error('Target user is not a member of this project'),
      { statusCode: 400 }
    );
  }

  const { rows } = await query(
    `UPDATE tasks SET assigned_to = $1, status = 'pending', completed_at = NULL
     WHERE id = $2 AND project_id = $3 RETURNING *`,
    [assigneeId, taskId, projectId]
  );

  if (!rows.length) throw Object.assign(new Error('Task not found'), { statusCode: 404 });

  logger.success('TASK_SVC', `Task ${taskId} assigned to user ${assigneeId}`);
  return rows[0];
};

// ══════════════════════════════════════════════════════════════
//  DELETE TASK  (admin only)
// ══════════════════════════════════════════════════════════════
const deleteTask = async (taskId, projectId) => {
  const { rowCount } = await query(
    'DELETE FROM tasks WHERE id = $1 AND project_id = $2',
    [taskId, projectId]
  );
  if (!rowCount) throw Object.assign(new Error('Task not found'), { statusCode: 404 });
  logger.success('TASK_SVC', `Task ${taskId} deleted from project ${projectId}`);
};

// ══════════════════════════════════════════════════════════════
//  PROJECT TASK STATS  (for admin dashboard)
// ══════════════════════════════════════════════════════════════
const getProjectTaskStats = async (projectId) => {
  const { rows } = await query(
    `SELECT
       COUNT(*)                                              AS total,
       COUNT(*) FILTER (WHERE status = 'pending')           AS pending,
       COUNT(*) FILTER (WHERE status = 'in_progress')       AS in_progress,
       COUNT(*) FILTER (WHERE status = 'completed')         AS completed,
       COUNT(*) FILTER (WHERE assigned_to IS NULL)          AS unassigned,
       COUNT(*) FILTER (WHERE due_date < NOW()
                        AND status != 'completed')          AS overdue
     FROM tasks WHERE project_id = $1`,
    [projectId]
  );

  return rows[0];
};

module.exports = {
  createTask,
  getProjectTasks,
  getMyTasks,
  getTaskById,
  updateTask,
  markTaskComplete,
  assignTask,
  deleteTask,
  getProjectTaskStats,
};
