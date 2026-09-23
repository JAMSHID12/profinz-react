import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ModuleKey, Portal, PublicConfig, RoleCode, SessionUser } from './types';

/**
 * A screen of the application and who may open it. The same definition drives the menu and
 * the route guard, so a hidden menu entry is never reachable by typing its URL either.
 */
export interface AppRoute {
  path: string;
  element: ReactNode;
  /** The user needs at least one of these permissions. */
  permissions?: string[];
  /** The user also needs one of these roles (for work only certain roles do, like taking attendance). */
  roles?: RoleCode[];
  /** Hidden when this module is switched off for the client. */
  module?: ModuleKey;
  /** Hidden when this academic feature is switched off. */
  feature?: keyof PublicConfig['features'];
  /** Limited to these home portals (for example the student self-service screens). */
  portals?: Portal[];
  nav?: { section: string; label: string; icon: LucideIcon };
}

export function canAccess(route: AppRoute, user: SessionUser, config: PublicConfig): boolean {
  if (route.portals && !route.portals.includes(user.portal)) return false;
  if (route.module && !config.modules[route.module]) return false;
  if (route.feature && !config.features[route.feature]) return false;
  if (route.permissions && !route.permissions.some((code) => user.permissions.includes(code))) return false;
  if (route.roles && !route.roles.some((role) => user.roles.includes(role))) return false;
  return true;
}

/** Roles that take student attendance. The API enforces the same rule on every save. */
export const ATTENDANCE_TAKERS: RoleCode[] = ['MENTORS', 'FACULTY'];

export function canTakeAttendance(user: SessionUser | null): boolean {
  return Boolean(user && user.permissions.includes('ATTENDANCE_CREATE')
    && ATTENDANCE_TAKERS.some((role) => user.roles.includes(role)));
}
