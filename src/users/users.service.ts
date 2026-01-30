import { Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { RoleTemplateService } from '../auth/role-template.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private roleTemplateService: RoleTemplateService,
    private mailer: DynamicMailerService
  ) { }

  async create(createUserDto: CreateUserDto) {
    const { password, ...userData } = createUserDto;

    // SYSTEM_ADMIN cannot be created via standard user creation
    if (userData.role === 'SYSTEM_ADMIN') {
      throw new Error('SYSTEM_ADMIN role cannot be assigned manually.');
    }

    let passwordHash = 'dummy_hash_for_demo';
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Determine permissions
    let permissions = userData.permissions;
    const isOverride = userData.isPermissionOverridden ?? (!!permissions);

    // If no explicit permissions provided, fetch from template
    if (!permissions && userData.clinicId) {
      permissions = await this.roleTemplateService.getTemplate(userData.clinicId, userData.role);
    } else if (!permissions) {
      permissions = await this.roleTemplateService.getTemplate('default', userData.role);
    }

    // Check if user already exists in the system (by email)
    const existingUser = await this.prisma.user.findFirst({
      where: { email: userData.email.toLowerCase() },
      include: { memberships: true }
    });

    if (existingUser) {
      // User exists. Check if they already have this role in this clinic.
      const hasRoleInClinic = (existingUser.role === userData.role && existingUser.clinicId === userData.clinicId) ||
        existingUser.memberships.some(m => m.clinicId === userData.clinicId && m.role === userData.role);

      if (hasRoleInClinic) {
        throw new Error('User already exists in this clinic with this role.');
      }

      // Add a new membership for the existing user
      const newMembership = await this.prisma.clinicMember.create({
        data: {
          userId: existingUser.id,
          clinicId: userData.clinicId,
          role: userData.role,
          permissions: permissions || {},
          isPermissionOverridden: isOverride,
        }
      });

      this.logger.log(`Added membership for existing user ${userData.email} with role ${userData.role} in clinic ${userData.clinicId}`);

      // Optionally update the existing user's name if it was missing or different? 
      // For now, let's keep it simple and just return the user with their new membership.
      return { ...existingUser, newMembership };
    }

    // Prepare data for user creation, excluding clinicId, permissions, and creatorId
    // Also exclude timezone if not explicitly provided (let it be null for clinic fallback)
    const { clinicId, permissions: _perms, creatorId, isPermissionOverridden: __, ...restUserData } = userData;

    // Generate random verification token
    const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Default status to PENDING for new users (except maybe System Admin)
    const status = userData.role === 'SYSTEM_ADMIN' ? 'ACTIVE' : 'PENDING';

    const newUser = await this.prisma.user.create({
      data: {
        ...restUserData,
        email: userData.email.toLowerCase(),
        passwordHash,
        permissions: permissions || {},
        isPermissionOverridden: isOverride,
        verificationToken,
        status, // Set status
        timezone: (userData as any).timezone || null, // Ensure explicit null if undefined, to trigger fallback
        ...(clinicId && { clinic: { connect: { id: clinicId } } })
      } as any,
    });


    try {
      // Send Verification Email
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const verifyLink = `${frontendUrl}/verify-invite?token=${verificationToken}`;

      // Use creatorId for SMTP config if available, otherwise fall back to system
      await this.mailer.sendMail(createUserDto.creatorId, {
        to: newUser.email,
        subject: `Welcome to MediFlow - Verify Your Account`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>Welcome to the team, ${newUser.name}!</h2>
            <p>An account has been created for you at MediFlow.</p>
            <p><strong>Role:</strong> ${newUser.role}</p>
            <p><strong>Clinic ID:</strong> ${clinicId || 'System'}</p>
            <br/>
            <p>Your account is currently PENDING. Please click the link below to verify your email and activate your account:</p>
            <p>
              <a href="${verifyLink}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Verify & Activate Account
              </a>
            </p>
            <p style="margin-top: 10px; font-size: 12px; color: #666;">
              Or copy this link: ${verifyLink}
            </p>
          </div>
        `
      });
    } catch (error) {
      console.error('Failed to send invite email:', error);
      // Don't block creation, just log error
    }

    return newUser;
  }

  async getRolePermissions(clinicId: string, role: string) {
    return this.roleTemplateService.getTemplate(clinicId, role);
  }

  findAll(role?: string, clinicId?: string, search?: string) {
    const where: any = {};

    // Normalize role for internal consistency (standard is uppercase)
    if (role) {
      role = role.toUpperCase();
    }

    // Support both primary role/clinic and membership-based role/clinic
    if (role && clinicId) {
      where.OR = [
        { role, clinicId },
        {
          memberships: {
            some: {
              role,
              clinicId
            }
          }
        }
      ];
    } else if (clinicId) {
      where.OR = [
        { clinicId },
        {
          memberships: {
            some: { clinicId }
          }
        }
      ];
    } else if (role) {
      where.role = role;
    }

    if (search) {
      const searchFilter = {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } }
        ]
      };

      // Combine search filter with existing where filters
      if (where.OR) {
        // If we already have OR (from role/clinic logic), we need to wrap everything in AND
        const baseFilter = { ...where };
        delete where.OR; // Clear existing OR to avoid conflict
        where.AND = [
          baseFilter,
          searchFilter
        ];
      } else {
        Object.assign(where, searchFilter);
      }
    }

    return this.prisma.user.findMany({
      where,
      include: {
        memberships: {
          include: {
            clinic: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20 // Limit results for performance
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, updatedBy?: string) {
    // Fetch existing user to check for email changes
    const existingUser = await this.prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      throw new Error('User not found');
    }

    // Prevent escalating to SYSTEM_ADMIN
    if (updateUserDto.role === 'SYSTEM_ADMIN') {
      if (existingUser?.role !== 'SYSTEM_ADMIN') {
        throw new Error('Cannot escalate user to SYSTEM_ADMIN role.');
      }
    }

    const { password, ...rest } = updateUserDto as any;
    const dataToUpdate: any = { ...rest };
    console.log(`[UsersService] Data to update for ${id}:`, JSON.stringify(dataToUpdate, null, 2));

    // Check if email is being updated
    let emailChanged = false;
    let verificationToken: string | null = null;

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      emailChanged = true;
      // Generate new verification token
      verificationToken = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

      // Set status to PENDING and add verification token
      dataToUpdate.status = 'PENDING';
      dataToUpdate.verificationToken = verificationToken;

      console.log(`[UsersService] Email changed from ${existingUser.email} to ${updateUserDto.email}, setting status to PENDING`);
    }

    if (password && password.trim() !== '') {
      dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
    }

    // Multi-Role Logic:
    // If updating role or permissions in a specific clinic context, assume we want to create/update a Membership
    // For Backward Compatibility: We also update the User's main record IF it's the current context.
    // But importantly, we UPSERT a ClinicMember record.

    if (updateUserDto.clinicId && updateUserDto.role) {
      const membership = await this.prisma.clinicMember.upsert({
        where: {
          userId_clinicId_role: {
            userId: id,
            clinicId: updateUserDto.clinicId,
            role: updateUserDto.role
          }
        },
        update: {
          role: updateUserDto.role,
          permissions: updateUserDto.permissions || undefined,
          isPermissionOverridden: updateUserDto.isPermissionOverridden !== undefined
            ? updateUserDto.isPermissionOverridden
            : !!updateUserDto.permissions
        },
        create: {
          userId: id,
          clinicId: updateUserDto.clinicId,
          role: updateUserDto.role,
          permissions: updateUserDto.permissions || undefined,
          isPermissionOverridden: updateUserDto.isPermissionOverridden !== undefined
            ? updateUserDto.isPermissionOverridden
            : !!updateUserDto.permissions
        }
      });

      // Log the change if permissions were provided
      if (updateUserDto.permissions) {
        await this.prisma.systemLog.create({
          data: {
            action: 'UPDATE_USER_PERMISSIONS',
            module: 'PERMISSIONS',
            userId: updatedBy || id, // Log performer if available, otherwise target
            clinicId: updateUserDto.clinicId,
            metadata: { targetUserId: id, permissions: updateUserDto.permissions }
          }
        });
      }

      // [Multi-Role Notification] Send email if a new role/membership was added or updated
      // Fetch user email details if needed (we have id). 
      // Ideally we fetch user to get name/email.
      try {
        const user = await this.prisma.user.findUnique({
          where: { id },
          include: { clinic: true } // Fetch primary; but we need the target clinic
        });

        const targetClinic = await this.prisma.clinic.findUnique({
          where: { id: updateUserDto.clinicId }
        });

        if (user && targetClinic) {
          // Send notification email
          const subject = `Role Assignment: ${updateUserDto.role} at ${targetClinic.name}`;
          // Note: using creatorId logic if we had it, but here we don't pass creatorId in updateDTO usually.
          // We'll fall back to system email for role updates.
          await this.mailer.sendMail(undefined, {
            to: user.email,
            subject: subject,
            html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Role Update Notification</h2>
                            <p>Hello ${user.name},</p>
                            <p>You have been assigned a new role at <strong>${targetClinic.name}</strong>.</p>
                            <p><strong>Role:</strong> ${updateUserDto.role}</p>
                            <p>You can switch to this profile at any time from your dashboard sidebar.</p>
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">Go to Dashboard</a>
                        </div>
                    `
          });
        }
      } catch (err) {
        console.error('Failed to send role assignment email', err);
      }

      // [Multi-Role Fix] Do NOT overwrite the primary user.role if we are just adding a membership.
      // We only update the user.role if this is the FIRST assignment or explicit intent.
      // For now, we will simply REMOVE 'role' and 'clinicId' from the main user update 
      // to preserve the original identity unless it's a password change or other profile update.
      delete dataToUpdate.role;
      delete dataToUpdate.clinicId;
      delete dataToUpdate.permissions;
    }

    // If updating main user object directly (legacy or single profile update)
    if (updateUserDto.isPermissionOverridden !== undefined) {
      dataToUpdate.isPermissionOverridden = updateUserDto.isPermissionOverridden;
    } else if (updateUserDto.permissions) {
      dataToUpdate.isPermissionOverridden = true;
    }


    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    // Send verification email if email was changed
    if (emailChanged && verificationToken) {
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const verifyLink = `${frontendUrl}/verify-invite?token=${verificationToken}`;

        await this.mailer.sendMail(updatedBy, {
          to: updateUserDto.email,
          subject: 'Verify Your New Email Address - MediFlow',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #2563eb;">Email Address Updated</h2>
              <p>Hello ${updatedUser.name},</p>
              <p>Your email address has been updated by a system administrator.</p>
              <p><strong>New Email:</strong> ${updateUserDto.email}</p>
              <br/>
              <p>For security reasons, you need to verify this new email address before you can log in again.</p>
              <p>Please click the button below to verify your email and activate your account:</p>
              <p>
                <a href="${verifyLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">
                  Verify Email Address
                </a>
              </p>
              <p style="margin-top: 20px; font-size: 12px; color: #666;">
                Or copy this link: ${verifyLink}
              </p>
              <p style="margin-top: 20px; font-size: 12px; color: #666;">
                If you didn't request this change, please contact your system administrator immediately.
              </p>
            </div>
          `
        });

        console.log(`[UsersService] Verification email sent to ${updateUserDto.email}`);
      } catch (error) {
        console.error('[UsersService] Failed to send verification email:', error);
        // Don't block the update, just log the error
      }
    }

    return updatedUser;
  }

  async updateAvatar(id: string, imagePath: string) {
    return this.prisma.user.update({
      where: { id },
      data: { image: imagePath },
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async checkEmailExists(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    if (user) {
      return {
        exists: true,
        user
      };
    }

    return { exists: false };
  }

  async getVideoSettings(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        videoProvider: true,
        zoomClientId: true,
        zoomAccountId: true,
        googleClientId: true,
      },
    });

    return {
      videoProvider: user?.videoProvider || 'daily',
      hasZoomCredentials: !!(user?.zoomClientId && user?.zoomAccountId),
      hasGoogleCredentials: !!user?.googleClientId,
    };
  }

  async updateVideoProvider(id: string, provider: string) {
    if (!['daily', 'zoom', 'google-meet'].includes(provider)) {
      throw new Error('Invalid video provider');
    }

    return this.prisma.user.update({
      where: { id },
      data: { videoProvider: provider },
      select: {
        id: true,
        videoProvider: true,
      },
    });
  }

  async updateZoomCredentials(
    id: string,
    credentials: { clientId: string; clientSecret: string; accountId: string }
  ) {
    return this.prisma.user.update({
      where: { id },
      data: {
        zoomClientId: credentials.clientId,
        zoomClientSecret: credentials.clientSecret,
        zoomAccountId: credentials.accountId,
      },
      select: {
        id: true,
        zoomClientId: true,
        zoomAccountId: true,
      },
    });
  }

  async updateGoogleCredentials(
    id: string,
    credentials: { clientId: string; clientSecret: string; refreshToken?: string }
  ) {
    return this.prisma.user.update({
      where: { id },
      data: {
        googleClientId: credentials.clientId,
        googleClientSecret: credentials.clientSecret,
        googleRefreshToken: credentials.refreshToken,
      },
      select: {
        id: true,
        googleClientId: true,
      },
    });
  }

  async getUserGoogleCredentials(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        googleClientId: true,
        googleClientSecret: true
      }
    });
  }
}
