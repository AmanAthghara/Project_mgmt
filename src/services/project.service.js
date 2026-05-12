const { query, getClient } = require('../config/db');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════
//  CREATE PROJECT
//  Creator is automatically inserted as admin in a transaction
// ══════════════════════════════════════════════════════════════
const createProject = async (userId, { name, description, visibility = 'public' }) => {
  logger.info('PROJECT_SVC', `Creating project "${name}" by user ${userId}`);
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO projects (name, description, visibility, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description || null, visibility, userId]
    );
    const project = rows[0];

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [project.id, userId]
    );

    await client.query('COMMIT');
    logger.success('PROJECT_SVC', `Project ${project.id} created, user ${userId} set as admin`);
    return project;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ══════════════════════════════════════════════════════════════
//  GET ALL PUBLIC PROJECTS  (with optional search)
// ══════════════════════════════════════════════════════════════
const getPublicProjects = async ({ search = '', page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const searchParam = `%${search}%`;

  logger.info('PROJECT_SVC', `Listing public projects | search="${search}" page=${page}`);

  const { rows } = await query(
    `SELECT p.*,
            u.first_name AS creator_first_name,
            u.last_name  AS creator_last_name,
            COUNT(pm.id) AS member_count
     FROM projects p
     JOIN users u ON u.id = p.created_by
     LEFT JOIN project_members pm ON pm.project_id = p.id
     WHERE p.visibility = 'public'
       AND (p.name ILIKE $1 OR p.description ILIKE $1)
     GROUP BY p.id, u.first_name, u.last_name
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [searchParam, limit, offset]
  );

  const total = await query(
    `SELECT COUNT(*) FROM projects
     WHERE visibility = 'public' AND (name ILIKE $1 OR description ILIKE $1)`,
    [searchParam]
  );

  return {
    projects: rows,
    meta: {
      total:    parseInt(total.rows[0].count),
      page:     parseInt(page),
      limit:    parseInt(limit),
      pages:    Math.ceil(total.rows[0].count / limit),
    },
  };
};

// ══════════════════════════════════════════════════════════════
//  GET PROJECTS FOR A USER (member of)
// ══════════════════════════════════════════════════════════════
const getMyProjects = async (userId) => {
  logger.info('PROJECT_SVC', `Fetching projects for user ${userId}`);

  const { rows } = await query(
    `SELECT p.*,
            pm.role AS my_role,
            u.first_name AS creator_first_name,
            u.last_name  AS creator_last_name,
            COUNT(pm2.id) AS member_count
     FROM projects p
     JOIN project_members pm  ON pm.project_id  = p.id  AND pm.user_id = $1
     JOIN users u              ON u.id           = p.created_by
     LEFT JOIN project_members pm2 ON pm2.project_id = p.id
     GROUP BY p.id, pm.role, u.first_name, u.last_name
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return rows;
};

// ══════════════════════════════════════════════════════════════
//  GET SINGLE PROJECT
//  Public projects: anyone. Private: members only (caller enforces)
// ══════════════════════════════════════════════════════════════
const getProjectById = async (projectId, userId) => {
  logger.info('PROJECT_SVC', `Fetching project ${projectId} for user ${userId}`);

  const { rows } = await query(
    `SELECT p.*,
            u.first_name AS creator_first_name,
            u.last_name  AS creator_last_name,
            COUNT(pm.id) AS member_count,
            MAX(CASE WHEN pm2.user_id = $2 THEN pm2.role END) AS my_role
     FROM projects p
     JOIN users u ON u.id = p.created_by
     LEFT JOIN project_members pm  ON pm.project_id  = p.id
     LEFT JOIN project_members pm2 ON pm2.project_id = p.id AND pm2.user_id = $2
     WHERE p.id = $1
     GROUP BY p.id, u.first_name, u.last_name`,
    [projectId, userId]
  );

  if (!rows.length) throw Object.assign(new Error('Project not found'), { statusCode: 404 });

  const project = rows[0];

  // Private project: non-members cannot see it
  if (project.visibility === 'private' && !project.my_role) {
    throw Object.assign(new Error('This project is private'), { statusCode: 403 });
  }

  return project;
};

// ══════════════════════════════════════════════════════════════
//  UPDATE PROJECT  (admin only — enforced in route middleware)
// ══════════════════════════════════════════════════════════════
const updateProject = async (projectId, updates) => {
  const allowed = ['name', 'description', 'visibility'];
  const fields  = [];
  const values  = [];
  let idx = 1;

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(updates[key]);
    }
  }

  if (!fields.length) throw Object.assign(new Error('No fields to update'), { statusCode: 400 });

  values.push(projectId);
  const { rows } = await query(
    `UPDATE projects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  logger.success('PROJECT_SVC', `Project ${projectId} updated`);
  return rows[0];
};

// ══════════════════════════════════════════════════════════════
//  DELETE PROJECT  (admin only)
// ══════════════════════════════════════════════════════════════
const deleteProject = async (projectId) => {
  await query('DELETE FROM projects WHERE id = $1', [projectId]);
  logger.success('PROJECT_SVC', `Project ${projectId} deleted`);
};

// ══════════════════════════════════════════════════════════════
//  GET PROJECT MEMBERS
// ══════════════════════════════════════════════════════════════
const getProjectMembers = async (projectId) => {
  logger.info('PROJECT_SVC', `Fetching members of project ${projectId}`);

  const { rows } = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number,
            pm.role, pm.joined_at
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.role DESC, pm.joined_at ASC`,
    [projectId]
  );

  return rows;
};

// ══════════════════════════════════════════════════════════════
//  REMOVE MEMBER  (admin only)
// ══════════════════════════════════════════════════════════════
const removeMember = async (projectId, targetUserId, requestingUserId) => {
  // Cannot remove yourself if you are the only admin
  const { rows: admins } = await query(
    `SELECT user_id FROM project_members WHERE project_id = $1 AND role = 'admin'`,
    [projectId]
  );

  const isOnlyAdmin = admins.length === 1 && admins[0].user_id === targetUserId;
  if (isOnlyAdmin) {
    throw Object.assign(new Error('Cannot remove the only admin of a project'), { statusCode: 400 });
  }

  const { rowCount } = await query(
    `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, targetUserId]
  );

  if (!rowCount) throw Object.assign(new Error('Member not found in this project'), { statusCode: 404 });

  logger.success('PROJECT_SVC', `User ${targetUserId} removed from project ${projectId} by ${requestingUserId}`);
};

// ══════════════════════════════════════════════════════════════
//  PROMOTE MEMBER TO ADMIN
// ══════════════════════════════════════════════════════════════
const promoteMember = async (projectId, targetUserId) => {
  const { rowCount } = await query(
    `UPDATE project_members SET role = 'admin'
     WHERE project_id = $1 AND user_id = $2`,
    [projectId, targetUserId]
  );

  if (!rowCount) throw Object.assign(new Error('Member not found in this project'), { statusCode: 404 });

  logger.success('PROJECT_SVC', `User ${targetUserId} promoted to admin in project ${projectId}`);
};

// ══════════════════════════════════════════════════════════════
//  SEARCH USERS (for admin invite flow)
// ══════════════════════════════════════════════════════════════
const searchUsers = async (searchTerm, projectId) => {
  logger.info('PROJECT_SVC', `Searching users: "${searchTerm}" for project ${projectId}`);

  const param = `%${searchTerm}%`;

  // Exclude users already in the project
  const { rows } = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email
     FROM users u
     WHERE u.is_active = TRUE
       AND (u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1)
       AND u.id NOT IN (
         SELECT user_id FROM project_members WHERE project_id = $2
       )
     LIMIT 20`,
    [param, projectId]
  );

  return rows;
};

module.exports = {
  createProject,
  getPublicProjects,
  getMyProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectMembers,
  removeMember,
  promoteMember,
  searchUsers,
};
