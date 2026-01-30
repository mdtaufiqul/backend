import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LRUCache } from 'lru-cache';

@Injectable()
export class RoleTemplateService {
    private templateCache = new LRUCache<string, any>({
        max: 500, // Max 500 templates
        ttl: 1000 * 60 * 60, // Cache for 1 hour
    });

    constructor(private prisma: PrismaService) { }

    private readonly DEFAULT_PERMISSIONS = {
        'CLINIC_ADMIN': {
            'view_clinic_info': true,
            'manage_clinic_info': true,
            'view_staff': true,
            'manage_staff': true,
            'view_patients': true,
            'manage_patients': true,
            'view_appointments': true,
            'manage_appointments': true,
            'view_workflows': true,
            'manage_workflows': true,
            'manage_own_config': true,
            'view_billing': true,
            'manage_billing': true
        },
        'DOCTOR': {
            'view_clinic_info': true,
            'view_staff': true,
            'view_schedule': true, // Added to allow sidebar access
            'view_own_schedule': true,
            'manage_own_schedule': true,
            'view_patients': true,
            'manage_patients': true,
            'view_appointments': true,
            'manage_appointments': true,
            'chat_with_own_patients': true,
            'manage_own_config': true
        },
        'STAFF': {
            'view_clinic_info': true,
            'view_staff': true,
            'view_patients': true,
            'view_appointments': true,
            'manage_appointments': true,
            'chat_with_patients': true
        },
        'MANAGER': {
            'view_clinic_info': true,
            'view_staff': true,
            'view_patients': true,
            'view_appointments': true,
            'view_workflows': true
        },
        'RECEPTIONIST': {
            'view_clinic_info': true,
            'view_staff': true,
            'view_patients': true,
            'view_appointments': true,
            'manage_appointments': true
        },
        'NURSE': {
            'view_clinic_info': true,
            'view_staff': true,
            'view_patients': true,
            'manage_patients': true
        },
        'REPRESENTATIVE': {
            'view_clinic_info': true,
            'view_staff': true,
            'view_patients': true,
            'chat_with_patients': true
        }
    };

    async getTemplate(clinicId: string, role: string) {
        const cacheKey = `${clinicId}:${role}`;
        const cached = this.templateCache.get(cacheKey);
        if (cached) return cached;

        // Try to find custom template for this clinic
        const template = await this.prisma.rolePermissionTemplate.findUnique({
            where: {
                clinicId_role: {
                    clinicId,
                    role
                }
            }
        });

        const permissions = template ? template.permissions : (this.DEFAULT_PERMISSIONS[role.toUpperCase()] || {});

        // Cache the result
        this.templateCache.set(cacheKey, permissions);
        return permissions;
    }

    async updateTemplate(clinicId: string, role: string, permissions: any, updatedBy?: string) {
        // Normalize role for consistency
        const normalizedRole = role.toUpperCase();

        // Upsert the template
        const result = await this.prisma.rolePermissionTemplate.upsert({
            where: {
                clinicId_role: {
                    clinicId,
                    role: normalizedRole
                }
            },
            create: {
                clinicId,
                role: normalizedRole,
                permissions
            },
            update: {
                permissions
            }
        });

        // Log the change
        await this.prisma.systemLog.create({
            data: {
                action: 'UPDATE_ROLE_TEMPLATE',
                module: 'PERMISSIONS',
                userId: updatedBy,
                clinicId,
                metadata: { role, permissions }
            }
        });

        // Batch update all existing users with this role in this clinic who DON'T have overrides
        await this.prisma.user.updateMany({
            where: {
                clinicId,
                role,
                isPermissionOverridden: false
            },
            data: {
                permissions
            }
        });

        // Also update memberships
        await this.prisma.clinicMember.updateMany({
            where: {
                clinicId,
                role,
                isPermissionOverridden: false
            },
            data: {
                permissions
            }
        });

        // Invalidate cache
        this.templateCache.delete(`${clinicId}:${normalizedRole}`);

        return result;
    }
}
