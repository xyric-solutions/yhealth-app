import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { query } from '../config/database.config.js';
import { lifeAreasService } from '../services/life-areas.service.js';

const TEST_USER = '00000000-0000-0000-0000-00000000aaaa';

// Note: the users table uses `password` (not `password_hash`) and requires
// first_name/last_name NOT NULL. `onboarding_status` is an enum that accepts
// 'completed'. role_id has a default that references a pre-seeded role.
async function insertTestUser(id: string, email: string): Promise<void> {
  await query(
    `INSERT INTO users (id, email, password, first_name, last_name, role_id, onboarding_status, is_email_verified, is_active)
     VALUES ($1, $2, 'x', 'Test', 'User', '11111111-1111-1111-1111-111111111101', 'completed', true, true)
     ON CONFLICT (id) DO NOTHING`,
    [id, email],
  );
}

beforeAll(async () => {
  await insertTestUser(TEST_USER, 'la-test@example.com');
});

beforeEach(async () => {
  await query(
    'DELETE FROM life_area_links WHERE life_area_id IN (SELECT id FROM life_areas WHERE user_id = $1)',
    [TEST_USER],
  );
  await query('DELETE FROM life_areas WHERE user_id = $1', [TEST_USER]);
});

afterAll(async () => {
  await query('DELETE FROM life_areas WHERE user_id = $1', [TEST_USER]);
  await query('DELETE FROM users WHERE id = $1', [TEST_USER]);
});

describe('lifeAreasService', () => {
  it('creates a life area with defaults from registry', async () => {
    const area = await lifeAreasService.create(TEST_USER, {
      slug: 'career',
      display_name: 'My Career',
      domain_type: 'career',
    });
    expect(area.id).toBeDefined();
    expect(area.is_flagship).toBe(true);
    expect(area.icon).toBe('Briefcase');
    expect(area.color).toBe('#6366f1');
    expect(area.status).toBe('active');
  });

  it('rejects duplicate slug per user', async () => {
    await lifeAreasService.create(TEST_USER, {
      slug: 'career',
      display_name: 'Career',
      domain_type: 'career',
    });
    await expect(
      lifeAreasService.create(TEST_USER, {
        slug: 'career',
        display_name: 'Career 2',
        domain_type: 'career',
      }),
    ).rejects.toThrow(/already exists/i);
  });

  it('lists only active areas by default', async () => {
    const a = await lifeAreasService.create(TEST_USER, { slug: 'a', display_name: 'A', domain_type: 'custom' });
    await lifeAreasService.create(TEST_USER, { slug: 'b', display_name: 'B', domain_type: 'custom' });
    await lifeAreasService.update(TEST_USER, a.id, { status: 'archived' });
    const list = await lifeAreasService.list(TEST_USER);
    expect(list.map((x) => x.slug)).toEqual(['b']);
  });

  it('updates preferences via JSONB merge', async () => {
    const area = await lifeAreasService.create(TEST_USER, {
      slug: 'relationships',
      display_name: 'Relationships',
      domain_type: 'relationships',
      preferences: { preferredTimeOfDay: 'morning' },
    });
    const updated = await lifeAreasService.update(TEST_USER, area.id, {
      preferences: { tone: 'gentle' },
    });
    expect(updated!.preferences.preferredTimeOfDay).toBe('morning');
    expect(updated!.preferences.tone).toBe('gentle');
  });

  it('returns null when updating an area owned by another user', async () => {
    const otherUser = '00000000-0000-0000-0000-00000000bbbb';
    await insertTestUser(otherUser, 'la-other@example.com');
    const area = await lifeAreasService.create(otherUser, { slug: 's', display_name: 'S', domain_type: 'custom' });
    const result = await lifeAreasService.update(TEST_USER, area.id, { display_name: 'Hacked' });
    expect(result).toBeNull();
    await query('DELETE FROM life_areas WHERE user_id = $1', [otherUser]);
    await query('DELETE FROM users WHERE id = $1', [otherUser]);
  });

  it('links an existing goal and prevents double-linking', async () => {
    const area = await lifeAreasService.create(TEST_USER, { slug: 'c', display_name: 'C', domain_type: 'custom' });
    const fakeGoalId = '00000000-0000-0000-0000-0000000c0001';
    await lifeAreasService.link(TEST_USER, area.id, { entity_type: 'goal', entity_id: fakeGoalId });
    await expect(
      lifeAreasService.link(TEST_USER, area.id, { entity_type: 'goal', entity_id: fakeGoalId }),
    ).rejects.toThrow(/already linked/i);
  });
});
