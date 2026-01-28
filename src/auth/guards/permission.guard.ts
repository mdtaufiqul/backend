import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermissions) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();


        if (!user) {
            console.log('[PermissionGuard] No user in request');
            return false;
        }

        console.log(`[PermissionGuard] Checking permissions for user: ${user.email}, role: ${user.role}`);
        console.log(`[PermissionGuard] Required: ${requiredPermissions}`);

        // SYSTEM_ADMIN has root control (bypasses all checks)
        const userRole = user.role?.toUpperCase();
        if (userRole === 'SYSTEM_ADMIN' || userRole === 'SAAS_OWNER') {
            console.log('[PermissionGuard] Admin role detected, bypassing permission check');
            return true;
        }

        // Role-based logic could also be added here if we want implicit role permissions
        // But we are aiming for granular permission-based logic
        const userPermissions = user.permissions || {};
        console.log(`[PermissionGuard] User permissions keys: ${Object.keys(userPermissions)}`);

        const hasPermission = requiredPermissions.every((permission) => userPermissions[permission] === true);

        if (!hasPermission) {
            throw new ForbiddenException('You do not have the required permissions to perform this action');
        }

        return true;
    }
}
