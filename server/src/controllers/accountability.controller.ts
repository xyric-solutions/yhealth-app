import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { accountabilityConsentService } from '../services/accountability-consent.service.js';
import { accountabilityTriggerService } from '../services/accountability-trigger.service.js';
import { query } from '../database/pg.js';
import type { AuthenticatedRequest } from '../types/index.js';

class AccountabilityController {
  // ── Consent ──────────────────────────────────────────────────

  getConsent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const consent = await accountabilityConsentService.getConsent(userId);
    ApiResponse.success(res, consent, 'Consent settings retrieved');
  });

  updateConsent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const consent = await accountabilityConsentService.updateConsent(userId, req.body);
    ApiResponse.success(res, consent, 'Consent settings updated');
  });

  revokeAll = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    await accountabilityConsentService.revokeAll(userId);
    ApiResponse.success(res, { revoked: true }, 'All accountability access revoked');
  });

  // ── Contacts ─────────────────────────────────────────────────

  getContacts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const contacts = await accountabilityConsentService.getContacts(userId);
    ApiResponse.success(res, contacts, 'Contacts retrieved');
  });

  addContact = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const { contact_user_id, nickname, role } = req.body;

    if (contact_user_id === userId) {
      throw ApiError.badRequest('Cannot add yourself as a contact');
    }

    const contact = await accountabilityConsentService.addContact(userId, contact_user_id, nickname, role);
    ApiResponse.success(res, contact, 'Contact added', 201);
  });

  removeContact = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const { contactId } = req.params;
    if (!contactId) throw ApiError.badRequest('Contact ID required');
    await accountabilityConsentService.removeContact(userId, contactId);
    ApiResponse.success(res, { removed: true }, 'Contact removed');
  });

  updateContactConsent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const { contactId } = req.params;
    if (!contactId) throw ApiError.badRequest('Contact ID required');
    await accountabilityConsentService.updateContactConsent(userId, contactId, req.body);
    ApiResponse.success(res, { updated: true }, 'Contact consent updated');
  });

  // ── Groups ───────────────────────────────────────────────────

  getGroups = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const groups = await accountabilityConsentService.getGroups(userId);
    ApiResponse.success(res, groups, 'Groups retrieved');
  });

  createGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const { name, description, contact_ids } = req.body;
    const group = await accountabilityConsentService.createGroup(userId, name, description, contact_ids);
    ApiResponse.success(res, group, 'Group created', 201);
  });

  deleteGroup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const { groupId } = req.params;
    if (!groupId) throw ApiError.badRequest('Group ID required');
    await accountabilityConsentService.deleteGroup(userId, groupId);
    ApiResponse.success(res, { deleted: true }, 'Group deleted');
  });

  addGroupMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const { groupId } = req.params;
    const { contact_id } = req.body;
    if (!groupId) throw ApiError.badRequest('Group ID required');
    await accountabilityConsentService.addGroupMember(userId, groupId, contact_id);
    ApiResponse.success(res, { added: true }, 'Member added to group');
  });

  removeGroupMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const { groupId, contactId } = req.params;
    if (!groupId || !contactId) throw ApiError.badRequest('Group ID and Contact ID required');
    await accountabilityConsentService.removeGroupMember(userId, groupId, contactId);
    ApiResponse.success(res, { removed: true }, 'Member removed from group');
  });

  // ── Triggers ─────────────────────────────────────────────────

  getTriggers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const triggers = await accountabilityTriggerService.getTriggers(userId);
    ApiResponse.success(res, triggers, 'Triggers retrieved');
  });

  createTrigger = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const trigger = await accountabilityTriggerService.createTrigger(userId, req.body);
    ApiResponse.success(res, trigger, 'Trigger created', 201);
  });

  updateTrigger = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const { triggerId } = req.params;
    if (!triggerId) throw ApiError.badRequest('Trigger ID required');
    const trigger = await accountabilityTriggerService.updateTrigger(userId, triggerId, req.body);
    ApiResponse.success(res, trigger, 'Trigger updated');
  });

  deleteTrigger = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const { triggerId } = req.params;
    if (!triggerId) throw ApiError.badRequest('Trigger ID required');
    await accountabilityTriggerService.deleteTrigger(userId, triggerId);
    ApiResponse.success(res, { deleted: true }, 'Trigger deleted');
  });

  // ── Logs & Audit ─────────────────────────────────────────────

  getTriggerLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const result = await query(
      `SELECT tl.*, t.name as trigger_name, t.condition_type, t.message_type
       FROM accountability_trigger_logs tl
       LEFT JOIN accountability_triggers t ON t.id = tl.trigger_id
       WHERE tl.user_id = $1 ORDER BY tl.created_at DESC LIMIT $2`,
      [userId, limit]
    );
    ApiResponse.success(res, result.rows, 'Trigger logs retrieved');
  });

  getAuditLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const logs = await accountabilityConsentService.getAuditLog(userId, limit);
    ApiResponse.success(res, logs, 'Audit log retrieved');
  });

  // ── Emergency ────────────────────────────────────────────────

  getEmergencyContacts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');
    const contacts = await accountabilityConsentService.getEmergencyContacts(userId);
    ApiResponse.success(res, contacts, 'Emergency contacts retrieved');
  });
}

export const accountabilityController = new AccountabilityController();
