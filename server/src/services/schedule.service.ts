/**
 * @file Schedule Service
 * @description Handles daily schedules with drag-drop items and workflow-style linking
 */

import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';

// ============================================
// TYPES
// ============================================

export interface ScheduleTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleItem {
  id: string;
  scheduleId: string;
  title: string;
  description?: string;
  startTime: string; // HH:mm format
  endTime?: string; // HH:mm format
  durationMinutes?: number;
  color?: string;
  icon?: string;
  category?: string;
  position: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleLink {
  id: string;
  scheduleId: string;
  sourceItemId: string;
  targetItemId: string;
  linkType: 'sequential' | 'conditional' | 'parallel';
  delayMinutes: number;
  conditions: Record<string, unknown>;
  createdAt: string;
}

export interface DailySchedule {
  id: string;
  userId: string;
  scheduleDate: string; // YYYY-MM-DD
  templateId?: string;
  name?: string;
  notes?: string;
  isTemplate: boolean;
  items: ScheduleItem[];
  links: ScheduleLink[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  scheduleDate: string;
  templateId?: string;
  name?: string;
  notes?: string;
}

export interface UpdateScheduleInput {
  name?: string;
  notes?: string;
}

export interface CreateScheduleItemInput {
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  color?: string;
  icon?: string;
  category?: string;
  position: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateScheduleItemInput {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  color?: string;
  icon?: string;
  category?: string;
  position?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateScheduleLinkInput {
  sourceItemId: string;
  targetItemId: string;
  linkType?: 'sequential' | 'conditional' | 'parallel';
  delayMinutes?: number;
  conditions?: Record<string, unknown>;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface CalendarSchedule {
  date: string;
  scheduleId?: string;
  itemCount: number;
  hasSchedule: boolean;
}

// ============================================
// DATABASE ROW TYPES
// ============================================

interface ScheduleTemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DailyScheduleRow {
  id: string;
  user_id: string;
  schedule_date: Date;
  template_id: string | null;
  name: string | null;
  notes: string | null;
  is_template: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ScheduleItemRow {
  id: string;
  schedule_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  color: string | null;
  icon: string | null;
  category: string | null;
  shape: string | null;
  position: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface ScheduleLinkRow {
  id: string;
  schedule_id: string;
  source_item_id: string;
  target_item_id: string;
  link_type: string;
  delay_minutes: number;
  conditions: Record<string, unknown>;
  created_at: Date;
}

// ============================================
// SERVICE CLASS
// ============================================

class ScheduleService {
  /**
   * Get schedule for a specific date
   */
  async getScheduleByDate(userId: string, date: string): Promise<DailySchedule | null> {
    const result = await query<DailyScheduleRow>(
      `SELECT * FROM daily_schedules 
       WHERE user_id = $1 AND schedule_date = $2 AND is_template = false
       LIMIT 1`,
      [userId, date]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const schedule = result.rows[0];
    const items = await this.getScheduleItems(schedule.id);
    const links = await this.getScheduleLinks(schedule.id);

    return {
      ...this.mapRowToSchedule(schedule),
      items,
      links,
    };
  }

  /**
   * Get schedules for a date range (for calendar view)
   */
  async getSchedulesForCalendar(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<CalendarSchedule[]> {
    const result = await query<{ date: string; schedule_id: string; item_count: string }>(
      `SELECT 
        schedule_date::text as date,
        id as schedule_id,
        (SELECT COUNT(*) FROM schedule_items WHERE schedule_id = daily_schedules.id) as item_count
       FROM daily_schedules
       WHERE user_id = $1 
         AND schedule_date >= $2 
         AND schedule_date <= $3
         AND is_template = false
       ORDER BY schedule_date ASC`,
      [userId, startDate, endDate]
    );

    const scheduleMap = new Map<string, CalendarSchedule>();

    // Initialize all dates in range
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      scheduleMap.set(dateStr, {
        date: dateStr,
        hasSchedule: false,
        itemCount: 0,
      });
    }

    // Update with actual schedules
    result.rows.forEach((row) => {
      scheduleMap.set(row.date, {
        date: row.date,
        scheduleId: row.schedule_id,
        hasSchedule: true,
        itemCount: parseInt(row.item_count, 10),
      });
    });

    return Array.from(scheduleMap.values());
  }

  /**
   * Create a new schedule (or return existing if it already exists)
   */
  async createSchedule(userId: string, input: CreateScheduleInput): Promise<DailySchedule> {
    // Check if schedule already exists for this date
    const existing = await this.getScheduleByDate(userId, input.scheduleDate);
    if (existing) {
      // Return existing schedule instead of throwing error (upsert behavior)
      return existing;
    }

    const result = await query<DailyScheduleRow>(
      `INSERT INTO daily_schedules (user_id, schedule_date, template_id, name, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, input.scheduleDate, input.templateId || null, input.name || null, input.notes || null]
    );

    const schedule = result.rows[0];

    // If template_id is provided, copy items and links from template
    if (input.templateId) {
      await this.applyTemplateToSchedule(schedule.id, input.templateId);
    }

    const items = await this.getScheduleItems(schedule.id);
    const links = await this.getScheduleLinks(schedule.id);

    return {
      ...this.mapRowToSchedule(schedule),
      items,
      links,
    };
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    userId: string,
    scheduleId: string,
    input: UpdateScheduleInput
  ): Promise<DailySchedule> {
    await this.verifyScheduleOwnership(userId, scheduleId);

    const updates: string[] = [];
    const values: (string | null)[] = [];
    let paramCount = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(input.name || null);
    }

    if (input.notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(input.notes || null);
    }

    if (updates.length === 0) {
      return this.getScheduleById(userId, scheduleId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(scheduleId, userId);

    const queryText = `UPDATE daily_schedules 
                       SET ${updates.join(', ')} 
                       WHERE id = $${paramCount++} AND user_id = $${paramCount++} 
                       RETURNING *`;

    const result = await query<DailyScheduleRow>(queryText, values);

    const schedule = result.rows[0];
    const items = await this.getScheduleItems(schedule.id);
    const links = await this.getScheduleLinks(schedule.id);

    return {
      ...this.mapRowToSchedule(schedule),
      items,
      links,
    };
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(userId: string, scheduleId: string): Promise<void> {
    await this.verifyScheduleOwnership(userId, scheduleId);

    const result = await query(
      `DELETE FROM daily_schedules WHERE id = $1 AND user_id = $2 RETURNING id`,
      [scheduleId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Schedule not found');
    }
  }

  /**
   * Get schedule by ID
   */
  async getScheduleById(userId: string, scheduleId: string): Promise<DailySchedule> {
    const result = await query<DailyScheduleRow>(
      `SELECT * FROM daily_schedules WHERE id = $1 AND user_id = $2 AND is_template = false`,
      [scheduleId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Schedule not found');
    }

    const schedule = result.rows[0];
    const items = await this.getScheduleItems(schedule.id);
    const links = await this.getScheduleLinks(schedule.id);

    return {
      ...this.mapRowToSchedule(schedule),
      items,
      links,
    };
  }

  /**
   * Add item to schedule
   */
  async addScheduleItem(
    userId: string,
    scheduleId: string,
    input: CreateScheduleItemInput
  ): Promise<ScheduleItem> {
    await this.verifyScheduleOwnership(userId, scheduleId);

    // Calculate duration if not provided
    let durationMinutes = input.durationMinutes;
    if (!durationMinutes && input.endTime) {
      const start = this.timeToMinutes(input.startTime);
      const end = this.timeToMinutes(input.endTime);
      durationMinutes = end - start;
    }

    const shape = (input.metadata as any)?.shape || 'square';
    const result = await query<ScheduleItemRow>(
      `INSERT INTO schedule_items (
        schedule_id, title, description, start_time, end_time, 
        duration_minutes, color, icon, category, shape, position, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        scheduleId,
        input.title,
        input.description || null,
        input.startTime,
        input.endTime || null,
        durationMinutes || null,
        input.color || null,
        input.icon || null,
        input.category || null,
        shape,
        input.position,
        JSON.stringify(input.metadata || {}),
      ]
    );

    return this.mapRowToScheduleItem(result.rows[0]);
  }

  /**
   * Update schedule item
   */
  async updateScheduleItem(
    userId: string,
    itemId: string,
    input: UpdateScheduleItemInput
  ): Promise<ScheduleItem> {
    // Verify item belongs to user's schedule
    const itemResult = await query<{ schedule_id: string }>(
      `SELECT schedule_id FROM schedule_items WHERE id = $1`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      throw ApiError.notFound('Schedule item not found');
    }

    await this.verifyScheduleOwnership(userId, itemResult.rows[0].schedule_id);

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramCount = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(input.title);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(input.description || null);
    }

    if (input.startTime !== undefined) {
      updates.push(`start_time = $${paramCount++}`);
      values.push(input.startTime);
    }

    if (input.endTime !== undefined) {
      updates.push(`end_time = $${paramCount++}`);
      values.push(input.endTime || null);
    }

    if (input.durationMinutes !== undefined) {
      updates.push(`duration_minutes = $${paramCount++}`);
      values.push(input.durationMinutes || null);
    }

    if (input.color !== undefined) {
      updates.push(`color = $${paramCount++}`);
      values.push(input.color || null);
    }

    if (input.icon !== undefined) {
      updates.push(`icon = $${paramCount++}`);
      values.push(input.icon || null);
    }

    if (input.category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(input.category || null);
    }

    if (input.position !== undefined) {
      updates.push(`position = $${paramCount++}`);
      values.push(input.position);
    }

    if (input.metadata !== undefined) {
      // Get existing metadata to merge with new metadata
      const existingItemResult = await query<ScheduleItemRow>(
        `SELECT metadata FROM schedule_items WHERE id = $1`,
        [itemId]
      );
      
      let mergedMetadata = input.metadata;
      if (existingItemResult.rows.length > 0 && existingItemResult.rows[0].metadata) {
        const existingMetadata = typeof existingItemResult.rows[0].metadata === 'string'
          ? JSON.parse(existingItemResult.rows[0].metadata)
          : existingItemResult.rows[0].metadata;
        mergedMetadata = {
          ...existingMetadata,
          ...input.metadata,
        };
      }
      
      updates.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(mergedMetadata));
      
      // Handle shape from metadata
      const shape = (mergedMetadata as any)?.shape;
      if (shape) {
        updates.push(`shape = $${paramCount++}`);
        values.push(shape);
      }
    }

    if (updates.length === 0) {
      const result = await query<ScheduleItemRow>(
        `SELECT * FROM schedule_items WHERE id = $1`,
        [itemId]
      );
      return this.mapRowToScheduleItem(result.rows[0]);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(itemId);

    const queryText = `UPDATE schedule_items 
                       SET ${updates.join(', ')} 
                       WHERE id = $${paramCount++} 
                       RETURNING *`;

    const result = await query<ScheduleItemRow>(queryText, values);

    return this.mapRowToScheduleItem(result.rows[0]);
  }

  /**
   * Delete schedule item
   */
  async deleteScheduleItem(userId: string, itemId: string): Promise<void> {
    // Verify item belongs to user's schedule
    const itemResult = await query<{ schedule_id: string }>(
      `SELECT schedule_id FROM schedule_items WHERE id = $1`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      throw ApiError.notFound('Schedule item not found');
    }

    await this.verifyScheduleOwnership(userId, itemResult.rows[0].schedule_id);

    // Delete associated links
    await query(
      `DELETE FROM schedule_links 
       WHERE source_item_id = $1 OR target_item_id = $1`,
      [itemId]
    );

    // Delete item
    await query(`DELETE FROM schedule_items WHERE id = $1`, [itemId]);
  }

  /**
   * Create link between schedule items
   */
  async createScheduleLink(
    userId: string,
    scheduleId: string,
    input: CreateScheduleLinkInput
  ): Promise<ScheduleLink> {
    await this.verifyScheduleOwnership(userId, scheduleId);

    // Verify both items belong to this schedule
    const itemsResult = await query<{ id: string }>(
      `SELECT id FROM schedule_items 
       WHERE id IN ($1, $2) AND schedule_id = $3`,
      [input.sourceItemId, input.targetItemId, scheduleId]
    );

    if (itemsResult.rows.length !== 2) {
      throw ApiError.badRequest('Both items must belong to the same schedule');
    }

    const result = await query<ScheduleLinkRow>(
      `INSERT INTO schedule_links (
        schedule_id, source_item_id, target_item_id, 
        link_type, delay_minutes, conditions
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        scheduleId,
        input.sourceItemId,
        input.targetItemId,
        input.linkType || 'sequential',
        input.delayMinutes || 0,
        JSON.stringify(input.conditions || {}),
      ]
    );

    return this.mapRowToScheduleLink(result.rows[0]);
  }

  /**
   * Delete schedule link
   */
  async deleteScheduleLink(userId: string, linkId: string): Promise<void> {
    // Verify link belongs to user's schedule
    const linkResult = await query<{ schedule_id: string }>(
      `SELECT schedule_id FROM schedule_links WHERE id = $1`,
      [linkId]
    );

    if (linkResult.rows.length === 0) {
      throw ApiError.notFound('Schedule link not found');
    }

    await this.verifyScheduleOwnership(userId, linkResult.rows[0].schedule_id);

    await query(`DELETE FROM schedule_links WHERE id = $1`, [linkId]);
  }

  /**
   * Get all templates for user
   */
  async getTemplates(userId: string): Promise<ScheduleTemplate[]> {
    const result = await query<ScheduleTemplateRow>(
      `SELECT * FROM schedule_templates 
       WHERE user_id = $1 
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => this.mapRowToTemplate(row));
  }

  /**
   * Create template
   */
  async createTemplate(userId: string, input: CreateTemplateInput): Promise<ScheduleTemplate> {
    // If setting as default, unset other defaults
    if (input.isDefault) {
      await query(
        `UPDATE schedule_templates 
         SET is_default = false 
         WHERE user_id = $1 AND is_default = true`,
        [userId]
      );
    }

    const result = await query<ScheduleTemplateRow>(
      `INSERT INTO schedule_templates (user_id, name, description, is_default)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, input.name, input.description || null, input.isDefault || false]
    );

    return this.mapRowToTemplate(result.rows[0]);
  }

  /**
   * Apply template to schedule
   */
  async applyTemplateToSchedule(_scheduleId: string, templateId: string): Promise<void> {
    // Get template schedule (templates are stored as schedules with is_template = true)
    // Actually, templates are separate - we need to get the template's items
    // For now, we'll create a template schedule when saving as template
    // This is a simplified version - in production, you'd want to store template items separately

    // Get the template
    const templateResult = await query<ScheduleTemplateRow>(
      `SELECT * FROM schedule_templates WHERE id = $1`,
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      throw ApiError.notFound('Template not found');
    }

    // For MVP, we'll copy items from a template schedule if it exists
    // This would need to be enhanced based on how templates are stored
  }

  /**
   * Save schedule as template
   */
  async saveScheduleAsTemplate(
    userId: string,
    scheduleId: string,
    templateName: string,
    description?: string
  ): Promise<ScheduleTemplate> {
    await this.verifyScheduleOwnership(userId, scheduleId);

    // Create template
    const template = await this.createTemplate(userId, {
      name: templateName,
      description,
      isDefault: false,
    });

    // Copy schedule items to template (this would need a template_items table in full implementation)
    // For MVP, we'll just create the template reference
    await query(
      `UPDATE daily_schedules 
       SET template_id = $1 
       WHERE id = $2`,
      [template.id, scheduleId]
    );

    return template;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getScheduleItems(scheduleId: string): Promise<ScheduleItem[]> {
    const result = await query<ScheduleItemRow>(
      `SELECT * FROM schedule_items 
       WHERE schedule_id = $1 
       ORDER BY position ASC, start_time ASC`,
      [scheduleId]
    );

    return result.rows.map((row) => this.mapRowToScheduleItem(row));
  }

  private async getScheduleLinks(scheduleId: string): Promise<ScheduleLink[]> {
    const result = await query<ScheduleLinkRow>(
      `SELECT * FROM schedule_links 
       WHERE schedule_id = $1`,
      [scheduleId]
    );

    return result.rows.map((row) => this.mapRowToScheduleLink(row));
  }

  private async verifyScheduleOwnership(userId: string, scheduleId: string): Promise<void> {
    const result = await query<{ id: string }>(
      `SELECT id FROM daily_schedules WHERE id = $1 AND user_id = $2`,
      [scheduleId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Schedule not found');
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private mapRowToSchedule(row: DailyScheduleRow): Omit<DailySchedule, 'items' | 'links'> {
    return {
      id: row.id,
      userId: row.user_id,
      scheduleDate: typeof row.schedule_date === 'string' ? row.schedule_date : row.schedule_date.toISOString().split('T')[0],
      templateId: row.template_id || undefined,
      name: row.name || undefined,
      notes: row.notes || undefined,
      isTemplate: row.is_template,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapRowToScheduleItem(row: ScheduleItemRow): ScheduleItem {
    const item: ScheduleItem = {
      id: row.id,
      scheduleId: row.schedule_id,
      title: row.title,
      description: row.description || undefined,
      startTime: row.start_time,
      endTime: row.end_time || undefined,
      durationMinutes: row.duration_minutes || undefined,
      color: row.color || undefined,
      icon: row.icon || undefined,
      category: row.category || undefined,
      position: row.position,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
    // Add shape to metadata if it exists
    if (row.shape) {
      (item as any).shape = row.shape;
    }
    return item;
  }

  private mapRowToScheduleLink(row: ScheduleLinkRow): ScheduleLink {
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      sourceItemId: row.source_item_id,
      targetItemId: row.target_item_id,
      linkType: row.link_type as 'sequential' | 'conditional' | 'parallel',
      delayMinutes: row.delay_minutes,
      conditions: row.conditions || {},
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapRowToTemplate(row: ScheduleTemplateRow): ScheduleTemplate {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || undefined,
      isDefault: row.is_default,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const scheduleService = new ScheduleService();
export default scheduleService;


