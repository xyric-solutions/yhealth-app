/**
 * @file Journal Controller
 * @description API endpoints for daily journaling (F7.2)
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { journalService } from '../../services/wellbeing/journal.service.js';

class JournalController {
  /**
   * @route   GET /api/v1/wellbeing/journal/prompts
   * @desc    Get recommended journal prompts
   * @access  Private
   */
  getPrompts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const limit = parseInt(req.query.limit as string) || 3;

    const prompts = await journalService.getRecommendedPrompts(userId, limit);

    ApiResponse.success(res, { prompts }, 'Journal prompts retrieved successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/journal
   * @desc    Create journal entry
   * @access  Private
   */
  createEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const {
      prompt,
      prompt_category,
      prompt_id,
      entry_text,
      mode,
      voice_entry,
      duration_seconds,
      logged_at,
    } = req.body;

    if (!prompt || !entry_text || !mode) {
      throw ApiError.badRequest('prompt, entry_text, and mode are required');
    }

    if (!['light', 'deep'].includes(mode)) {
      throw ApiError.badRequest('mode must be either "light" or "deep"');
    }

    const entry = await journalService.createJournalEntry(userId, {
      prompt,
      promptCategory: prompt_category,
      promptId: prompt_id,
      entryText: entry_text,
      mode,
      voiceEntry: voice_entry,
      durationSeconds: duration_seconds,
      loggedAt: logged_at,
    });

    ApiResponse.success(
      res,
      { entry },
      {
        message: 'Journal entry created successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   GET /api/v1/wellbeing/journal
   * @desc    List journal entries (paginated)
   * @access  Private
   */
  getEntries = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const category = req.query.category as string | undefined;

    const result = await journalService.getJournalEntries(userId, {
      startDate,
      endDate,
      page,
      limit,
      category: category as any,
    });

    ApiResponse.success(res, result, 'Journal entries retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/journal/:id
   * @desc    Get single journal entry
   * @access  Private
   */
  getEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    const entry = await journalService.getJournalEntryById(userId, id);

    ApiResponse.success(res, { entry }, 'Journal entry retrieved successfully', undefined, req);
  });

  /**
   * @route   PUT /api/v1/wellbeing/journal/:id
   * @desc    Update journal entry
   * @access  Private
   */
  updateEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const { entry_text, prompt, prompt_category } = req.body;

    const entry = await journalService.updateJournalEntry(userId, id, {
      entryText: entry_text,
      prompt,
      promptCategory: prompt_category,
    });

    ApiResponse.success(res, { entry }, 'Journal entry updated successfully', undefined, req);
  });

  /**
   * @route   DELETE /api/v1/wellbeing/journal/:id
   * @desc    Delete journal entry
   * @access  Private
   */
  deleteEntry = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    await journalService.deleteJournalEntry(userId, id);

    ApiResponse.success(res, {}, 'Journal entry deleted successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/journal/streak
   * @desc    Get journal streak information
   * @access  Private
   */
  getStreak = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const streak = await journalService.getJournalStreak(userId);

    ApiResponse.success(res, { streak }, 'Journal streak retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/journal/export
   * @desc    Export all journal entries as text/PDF
   * @access  Private
   */
  exportEntries = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const format = (req.query.format as string) || 'text'; // 'text' or 'json'
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await journalService.getJournalEntries(userId, {
      startDate,
      endDate,
      page: 1,
      limit: 10000, // Get all entries
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="journal-entries-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(result);
    } else {
      // Text format
      const textContent = result.entries
        .map((entry) => {
          const date = new Date(entry.loggedAt).toLocaleDateString();
          return `Date: ${date}\nPrompt: ${entry.prompt}\n\n${entry.entryText}\n\n---\n\n`;
        })
        .join('');

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="journal-entries-${new Date().toISOString().split('T')[0]}.txt"`);
      res.send(textContent);
    }
  });
}

export const journalController = new JournalController();
export default journalController;

