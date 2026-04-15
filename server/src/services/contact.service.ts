/**
 * Contact Service
 * Handles contact submission CRUD operations, filtering, and admin management
 */

import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from './logger.service.js';
import { mailHelper } from '../helper/mail.js';

// ============================================
// TYPES
// ============================================

export type ContactStatus = 'new' | 'read' | 'in_progress' | 'resolved' | 'archived';
export type ContactPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ContactRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: ContactStatus;
  priority: ContactPriority;
  assigned_to: string | null;
  admin_notes: string | null;
  ip_address: string | null;
  user_agent: string | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ContactWithAssignee extends ContactRow {
  assigned_first_name: string | null;
  assigned_last_name: string | null;
  resolved_first_name: string | null;
  resolved_last_name: string | null;
}

export interface CreateContactInput {
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  ip_address?: string;
  user_agent?: string;
}

export interface UpdateContactInput {
  status?: ContactStatus;
  priority?: ContactPriority;
  assigned_to?: string | null;
  admin_notes?: string | null;
}

export interface ContactListFilters {
  status?: ContactStatus;
  priority?: ContactPriority;
  search?: string;
  assigned_to?: string;
  created_after?: Date;
  created_before?: Date;
}

export interface ContactListOptions {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'priority' | 'status' | 'name' | 'email';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedContacts {
  contacts: ContactWithAssignee[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ContactStats {
  total: number;
  new: number;
  read: number;
  in_progress: number;
  resolved: number;
  archived: number;
  by_priority: Record<string, number>;
  by_subject: Array<{ subject: string; count: number }>;
  avg_resolution_hours: number | null;
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Create a new contact submission (public)
 */
export async function createContact(input: CreateContactInput): Promise<ContactRow> {
  const result = await query<ContactRow>(
    `INSERT INTO contact_submissions (name, email, phone, subject, message, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [input.name, input.email, input.phone || null, input.subject, input.message, input.ip_address || null, input.user_agent || null]
  );

  logger.info('[Contact] New submission created', { id: result.rows[0].id, email: input.email, subject: input.subject });

  // Send confirmation email to user (non-blocking)
  mailHelper.sendContactConfirmationEmail(
    input.email,
    input.name,
    input.subject,
    input.message
  ).catch((error) => {
    logger.error('[Contact] Failed to send confirmation email', {
      error: error?.message,
      email: input.email,
      contactId: result.rows[0].id,
    });
  });

  return result.rows[0];
}

/**
 * List contacts with filters and pagination (admin)
 */
export async function listContacts(
  filters: ContactListFilters = {},
  options: ContactListOptions = {}
): Promise<PaginatedContacts> {
  const {
    status,
    priority,
    search,
    assigned_to,
    created_after,
    created_before,
  } = filters;

  const {
    page = 1,
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'desc',
  } = options;

  const offset = (page - 1) * limit;

  // Build WHERE clauses
  const conditions: string[] = [];
  const params: (string | number | boolean | null | Date | object)[] = [];
  let paramCount = 0;

  if (status) {
    paramCount++;
    conditions.push(`cs.status = $${paramCount}`);
    params.push(status);
  }

  if (priority) {
    paramCount++;
    conditions.push(`cs.priority = $${paramCount}`);
    params.push(priority);
  }

  if (search) {
    paramCount++;
    conditions.push(
      `(cs.name ILIKE $${paramCount} OR cs.email ILIKE $${paramCount} OR cs.subject ILIKE $${paramCount} OR cs.message ILIKE $${paramCount})`
    );
    params.push(`%${search}%`);
  }

  if (assigned_to) {
    paramCount++;
    conditions.push(`cs.assigned_to = $${paramCount}`);
    params.push(assigned_to);
  }

  if (created_after) {
    paramCount++;
    conditions.push(`cs.created_at >= $${paramCount}`);
    params.push(created_after);
  }

  if (created_before) {
    paramCount++;
    conditions.push(`cs.created_at <= $${paramCount}`);
    params.push(created_before);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort column
  const allowedSortColumns = ['created_at', 'updated_at', 'priority', 'status', 'name', 'email'];
  const sortColumn = allowedSortColumns.includes(sort_by) ? `cs.${sort_by}` : 'cs.created_at';
  const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM contact_submissions cs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated results with assignee info
  paramCount++;
  params.push(limit);
  paramCount++;
  params.push(offset);

  const result = await query<ContactWithAssignee>(
    `SELECT cs.*,
       au.first_name as assigned_first_name,
       au.last_name as assigned_last_name,
       ru.first_name as resolved_first_name,
       ru.last_name as resolved_last_name
     FROM contact_submissions cs
     LEFT JOIN users au ON cs.assigned_to = au.id
     LEFT JOIN users ru ON cs.resolved_by = ru.id
     ${whereClause}
     ORDER BY ${sortColumn} ${sortDir}
     LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
    params
  );

  return {
    contacts: result.rows,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}

/**
 * Get single contact by ID (admin)
 */
export async function getContactById(id: string): Promise<ContactWithAssignee | null> {
  const result = await query<ContactWithAssignee>(
    `SELECT cs.*,
       au.first_name as assigned_first_name,
       au.last_name as assigned_last_name,
       ru.first_name as resolved_first_name,
       ru.last_name as resolved_last_name
     FROM contact_submissions cs
     LEFT JOIN users au ON cs.assigned_to = au.id
     LEFT JOIN users ru ON cs.resolved_by = ru.id
     WHERE cs.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Update contact submission (admin)
 */
export async function updateContact(
  id: string,
  input: UpdateContactInput,
  adminUserId?: string
): Promise<ContactRow> {
  const existing = await getContactById(id);
  if (!existing) {
    throw ApiError.notFound('Contact submission not found');
  }

  const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const params: (string | number | boolean | null | Date | object)[] = [];
  let paramCount = 0;

  if (input.status !== undefined) {
    paramCount++;
    updates.push(`status = $${paramCount}`);
    params.push(input.status);

    // Auto-set resolved fields when status changes to resolved
    if (input.status === 'resolved' && existing.status !== 'resolved') {
      updates.push('resolved_at = CURRENT_TIMESTAMP');
      if (adminUserId) {
        paramCount++;
        updates.push(`resolved_by = $${paramCount}`);
        params.push(adminUserId);
      }
    }
  }

  if (input.priority !== undefined) {
    paramCount++;
    updates.push(`priority = $${paramCount}`);
    params.push(input.priority);
  }

  if (input.assigned_to !== undefined) {
    paramCount++;
    updates.push(`assigned_to = $${paramCount}`);
    params.push(input.assigned_to);
  }

  if (input.admin_notes !== undefined) {
    paramCount++;
    updates.push(`admin_notes = $${paramCount}`);
    params.push(input.admin_notes);
  }

  paramCount++;
  params.push(id);

  const result = await query<ContactRow>(
    `UPDATE contact_submissions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    params
  );

  logger.info('[Contact] Submission updated', { id, changes: Object.keys(input) });

  // Send email notification when admin adds/updates notes
  if (input.admin_notes !== undefined && input.admin_notes && input.admin_notes.trim().length > 0) {
    // Only send if notes were actually added (not just cleared)
    const previousNotes = existing.admin_notes || '';
    if (input.admin_notes !== previousNotes) {
      // Get admin user info if available
      let adminName: string | undefined;
      let adminRole: string | undefined;

      if (adminUserId) {
        try {
          const adminResult = await query<{ first_name: string; last_name: string; role?: string }>(
            `SELECT u.first_name, u.last_name, r.slug AS role FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
            [adminUserId]
          );
          if (adminResult.rows[0]) {
            const admin = adminResult.rows[0];
            adminName = `${admin.first_name} ${admin.last_name}`.trim();
            adminRole = admin.role || 'Support Team';
          }
        } catch (error) {
          logger.warn('[Contact] Failed to fetch admin info for email', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      // Send notification email to user (non-blocking)
      mailHelper.sendContactAdminNoteEmail(
        existing.email,
        existing.name,
        existing.subject,
        existing.message,
        input.admin_notes,
        adminName,
        adminRole,
        result.rows[0].status,
      ).catch((error) => {
        logger.error('[Contact] Failed to send admin note notification email', {
          error: error?.message,
          email: existing.email,
          contactId: id,
        });
      });
    }
  }

  return result.rows[0];
}

/**
 * Delete contact submission (admin)
 */
export async function deleteContact(id: string): Promise<void> {
  const result = await query('DELETE FROM contact_submissions WHERE id = $1', [id]);
  if (result.rowCount === 0) {
    throw ApiError.notFound('Contact submission not found');
  }
  logger.info('[Contact] Submission deleted', { id });
}

/**
 * Bulk delete contacts (admin)
 */
export async function bulkDeleteContacts(ids: string[]): Promise<void> {
  await query('DELETE FROM contact_submissions WHERE id = ANY($1)', [ids]);
  logger.info('[Contact] Bulk delete', { count: ids.length });
}

/**
 * Bulk update contact status (admin)
 */
export async function bulkUpdateContactStatus(
  ids: string[],
  status: ContactStatus,
  adminUserId?: string
): Promise<void> {
  const resolvedFields = status === 'resolved'
    ? `, resolved_at = CURRENT_TIMESTAMP, resolved_by = $3`
    : '';
  const params: (string | number | boolean | null | Date | object)[] = [status, ids];
  if (status === 'resolved' && adminUserId) {
    params.push(adminUserId);
  }

  await query(
    `UPDATE contact_submissions SET status = $1, updated_at = CURRENT_TIMESTAMP${resolvedFields} WHERE id = ANY($2)`,
    params
  );
  logger.info('[Contact] Bulk status update', { count: ids.length, status });
}

/**
 * Get contact statistics (admin)
 */
export async function getContactStats(): Promise<ContactStats> {
  // Status counts
  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM contact_submissions GROUP BY status`
  );

  const statusCounts: Record<string, number> = {};
  let total = 0;
  for (const row of statusResult.rows) {
    statusCounts[row.status] = parseInt(row.count, 10);
    total += parseInt(row.count, 10);
  }

  // Priority counts
  const priorityResult = await query<{ priority: string; count: string }>(
    `SELECT priority, COUNT(*) as count FROM contact_submissions GROUP BY priority`
  );

  const byPriority: Record<string, number> = {};
  for (const row of priorityResult.rows) {
    byPriority[row.priority] = parseInt(row.count, 10);
  }

  // Top subjects
  const subjectResult = await query<{ subject: string; count: string }>(
    `SELECT subject, COUNT(*) as count FROM contact_submissions
     GROUP BY subject ORDER BY count DESC LIMIT 10`
  );

  const bySubject = subjectResult.rows.map((r) => ({
    subject: r.subject,
    count: parseInt(r.count, 10),
  }));

  // Average resolution time
  const avgResult = await query<{ avg_hours: string | null }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
     FROM contact_submissions WHERE resolved_at IS NOT NULL`
  );

  return {
    total,
    new: statusCounts['new'] || 0,
    read: statusCounts['read'] || 0,
    in_progress: statusCounts['in_progress'] || 0,
    resolved: statusCounts['resolved'] || 0,
    archived: statusCounts['archived'] || 0,
    by_priority: byPriority,
    by_subject: bySubject,
    avg_resolution_hours: avgResult.rows[0]?.avg_hours ? parseFloat(avgResult.rows[0].avg_hours) : null,
  };
}
