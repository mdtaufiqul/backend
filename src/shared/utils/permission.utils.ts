import { UserRole, ROLES } from '../constants/roles.constant';

/**
 * Permission Helper Utilities
 * Centralizes permission logic to avoid duplication across controllers/services
 */

export interface PermissionContext {
    userId: string;
    role: string;
    clinicId?: string;
    permissions?: Record<string, boolean>;
    activeRoleId?: string;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(
    context: PermissionContext,
    permission: string
): boolean {
    // Global admins bypass all checks
    if (isGlobalAdmin(context)) {
        return true;
    }

    // Check explicit permissions
    return context.permissions?.[permission] === true;
}

/**
 * Check if user is a global admin (SYSTEM_ADMIN or SAAS_OWNER without clinic)
 */
export function isGlobalAdmin(context: PermissionContext): boolean {
    const normalizedRole = context.role?.toUpperCase();
    return (
        normalizedRole === ROLES.SYSTEM_ADMIN ||
        (normalizedRole === ROLES.SAAS_OWNER && !context.clinicId)
    );
}

/**
 * Check if user has a specific role
 */
export function hasRole(context: PermissionContext, role: UserRole): boolean {
    return context.role?.toUpperCase() === role;
}

/**
 * Check if user can access a specific feature/action
 * Combines role and permission checks
 */
export function canAccess(
    context: PermissionContext,
    feature: string,
    action: 'view' | 'create' | 'edit' | 'delete' = 'view'
): boolean {
    // Global admins can access everything
    if (isGlobalAdmin(context)) {
        return true;
    }

    // Build permission key (e.g., "patients:view", "appointments:edit")
    const permissionKey = `${feature}:${action}`;

    // Check if user has the specific permission
    return hasPermission(context, permissionKey);
}

/**
 * Check if user belongs to the same clinic as the resource
 */
export function isSameClinic(
    userClinicId: string | undefined,
    resourceClinicId: string | undefined
): boolean {
    if (!userClinicId || !resourceClinicId) {
        return false;
    }
    return userClinicId === resourceClinicId;
}

/**
 * Get effective permissions for a user
 * Combines role template with user-specific overrides
 */
export function getEffectivePermissions(
    templatePermissions: Record<string, boolean>,
    userPermissions?: Record<string, boolean>,
    isOverridden: boolean = false
): Record<string, boolean> {
    if (isOverridden && userPermissions) {
        return userPermissions;
    }

    return {
        ...templatePermissions,
        ...userPermissions
    };
}
