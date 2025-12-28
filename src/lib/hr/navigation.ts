// HR Module Navigation Utilities
// Provides consistent navigation paths across HR module

export type HrEntity =
  | 'employees'
  | 'positions'
  | 'roles'
  | 'authorizations'
  | 'training-courses'
  | 'training-sessions'
  | 'health-records';

const ENTITY_PATH_MAP: Record<HrEntity, string> = {
  'employees': '/hr/employees',
  'positions': '/hr/positions',
  'roles': '/hr/roles',
  'authorizations': '/hr/authorizations',
  'training-courses': '/hr/training/courses',
  'training-sessions': '/hr/training/sessions',
  'health-records': '/hr/health-records',
};

/**
 * Returns the list page path for an HR entity
 * @param entity - The HR entity type
 * @returns The list page path
 */
export function getHrListPath(entity: HrEntity): string {
  return ENTITY_PATH_MAP[entity];
}

/**
 * Returns the detail page path for an HR entity
 * @param entity - The HR entity type
 * @param id - The entity ID
 * @returns The detail page path
 */
export function getHrDetailPath(entity: HrEntity, id: number | string): string {
  return `${ENTITY_PATH_MAP[entity]}/${id}`;
}

/**
 * Returns the new item page path for an HR entity
 * @param entity - The HR entity type
 * @returns The new item page path
 */
export function getHrNewPath(entity: HrEntity): string {
  return `${ENTITY_PATH_MAP[entity]}/new`;
}

/**
 * Returns the edit page path for an HR entity
 * @param entity - The HR entity type
 * @param id - The entity ID
 * @returns The edit page path
 */
export function getHrEditPath(entity: HrEntity, id: number | string): string {
  return `${ENTITY_PATH_MAP[entity]}/${id}/edit`;
}

/**
 * Navigation handler interface for router integration
 */
export interface HrNavigator {
  /** Navigate to the list page */
  toList: () => void;
  /** Navigate to the detail page for an entity */
  toDetail: (id: number | string) => void;
  /** Navigate to the new item page */
  toNew: () => void;
  /** Navigate to the edit page for an entity */
  toEdit: (id: number | string) => void;
}

/**
 * Creates a navigation handler for common HR navigation use cases
 * @param router - Router object with push method (Next.js useRouter)
 * @param entity - The HR entity type
 * @returns Navigation helper object
 */
export function createHrNavigator(
  router: { push: (path: string) => void },
  entity: HrEntity
): HrNavigator {
  return {
    toList: () => router.push(getHrListPath(entity)),
    toDetail: (id: number | string) => router.push(getHrDetailPath(entity, id)),
    toNew: () => router.push(getHrNewPath(entity)),
    toEdit: (id: number | string) => router.push(getHrEditPath(entity, id)),
  };
}
