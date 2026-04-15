/**
 * Contact Controller
 * Handles HTTP requests for contact submission operations
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import {
  createContact,
  listContacts,
  getContactById,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  bulkUpdateContactStatus,
  getContactStats,
  type CreateContactInput,
  type UpdateContactInput,
} from '../services/contact.service.js';
import { mailHelper } from '../helper/mail.js';
import { query } from '../database/pg.js';

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * Create contact submission (public)
 * POST /api/contact
 */
export const createContactSubmission = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const input: CreateContactInput = {
      ...req.body,
      ip_address: req.ip || req.socket.remoteAddress,
      user_agent: req.get('User-Agent'),
    };

    const contact = await createContact(input);
    ApiResponse.success(res, { id: contact.id }, 'Your message has been sent successfully. We will get back to you within 24 hours.', 201);
  }
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * Get all contact submissions (admin)
 * GET /api/admin/contacts
 */
export const getAdminContacts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const {
      page = '1',
      limit = '20',
      sort_by = 'created_at',
      sort_order = 'desc',
      status,
      priority,
      search,
      assigned_to,
      created_after,
      created_before,
    } = req.query;

    const filters = {
      ...(status && { status: status as any }),
      ...(priority && { priority: priority as any }),
      ...(search && { search: search as string }),
      ...(assigned_to && { assigned_to: assigned_to as string }),
      ...(created_after && { created_after: new Date(created_after as string) }),
      ...(created_before && { created_before: new Date(created_before as string) }),
    };

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      sort_by: sort_by as any,
      sort_order: sort_order as 'asc' | 'desc',
    };

    const result = await listContacts(filters, options);

    ApiResponse.paginated(
      res,
      result.contacts,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
      'Contact submissions fetched successfully'
    );
  }
);

/**
 * Get contact statistics (admin)
 * GET /api/admin/contacts/stats
 */
export const getContactStatistics = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await getContactStats();
    ApiResponse.success(res, stats, 'Contact statistics fetched successfully');
  }
);

/**
 * Get single contact by ID (admin)
 * GET /api/admin/contacts/:id
 */
export const getAdminContactById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const contact = await getContactById(id);

    if (!contact) {
      throw ApiError.notFound('Contact submission not found');
    }

    // Mark as read if it was new
    if (contact.status === 'new') {
      await updateContact(id, { status: 'read' }, req.user?.id);
    }

    ApiResponse.success(res, contact, 'Contact submission fetched successfully');
  }
);

/**
 * Update contact submission (admin)
 * PATCH /api/admin/contacts/:id
 */
export const updateContactSubmission = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input: UpdateContactInput = req.body;

    const contact = await updateContact(id, input, req.user?.id);
    ApiResponse.success(res, contact, 'Contact submission updated successfully');
  }
);

/**
 * Delete contact submission (admin)
 * DELETE /api/admin/contacts/:id
 */
export const deleteContactSubmission = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await deleteContact(id);
    ApiResponse.success(res, null, 'Contact submission deleted successfully');
  }
);

/**
 * Bulk delete contacts (admin)
 * POST /api/admin/contacts/bulk-delete
 */
export const bulkDeleteContactsPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = req.body;
    await bulkDeleteContacts(ids);
    ApiResponse.success(res, null, `${ids.length} contact(s) deleted successfully`);
  }
);

/**
 * Bulk update contact status (admin)
 * POST /api/admin/contacts/bulk-status
 */
export const bulkUpdateContactStatusPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids, status } = req.body;
    await bulkUpdateContactStatus(ids, status, req.user?.id);
    ApiResponse.success(
      res,
      null,
      `${ids.length} contact(s) updated to "${status}" successfully`
    );
  }
);

/**
 * Send reply email to contact submission (admin)
 * POST /api/admin/contacts/:id/reply
 */
export const sendContactReply = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { message } = req.body as { message: string };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw ApiError.badRequest('Message is required');
    }

    if (message.length > 5000) {
      throw ApiError.badRequest('Message is too long (max 5000 characters)');
    }

    const contact = await getContactById(id);
    if (!contact) {
      throw ApiError.notFound('Contact submission not found');
    }

    // Get admin user info
    let adminName: string | undefined;
    let adminEmail: string | undefined;

    if (req.user?.id) {
      try {
        const adminResult = await query<{ first_name: string; last_name: string; email: string }>(
          `SELECT first_name, last_name, email FROM users WHERE id = $1`,
          [req.user.id]
        );
        if (adminResult.rows[0]) {
          const admin = adminResult.rows[0];
          adminName = `${admin.first_name} ${admin.last_name}`.trim();
          adminEmail = admin.email;
        }
      } catch (error) {
        // Log but don't fail
        console.error('Failed to fetch admin info', error);
      }
    }

    // Send email (non-blocking)
    const emailSent = await mailHelper.sendContactReplyEmail(
      contact.email,
      contact.name,
      contact.subject,
      message.trim(),
      adminName,
      adminEmail
    );

    if (!emailSent) {
      throw ApiError.internal('Failed to send email. Please check email configuration.');
    }

    // Optionally update contact status to "in_progress" if it's still "new" or "read"
    if (contact.status === 'new' || contact.status === 'read') {
      await updateContact(id, { status: 'in_progress' }, req.user?.id);
    }

    ApiResponse.success(res, { sent: true }, 'Reply email sent successfully');
  }
);
