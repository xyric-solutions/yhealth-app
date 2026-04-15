/**
 * Permission Service
 * Handles permission listing and grouping
 */

import { query } from '../database/pg.js';

export interface PermissionRow {
  id: string;
  slug: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface PermissionGroup {
  resource: string;
  permissions: PermissionRow[];
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const result = await query<PermissionRow>(
    'SELECT * FROM permissions ORDER BY resource, action'
  );

  return result.rows;
}

export async function listPermissionsGroupedByResource(): Promise<PermissionGroup[]> {
  const permissions = await listPermissions();

  const grouped = new Map<string, PermissionRow[]>();
  permissions.forEach((p) => {
    const list = grouped.get(p.resource) || [];
    list.push(p);
    grouped.set(p.resource, list);
  });

  return Array.from(grouped.entries()).map(([resource, perms]) => ({
    resource,
    permissions: perms,
  }));
}
