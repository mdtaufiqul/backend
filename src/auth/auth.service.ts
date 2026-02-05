import { Injectable, UnauthorizedException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { DynamicMailerService } from '../services/dynamic-mailer.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private prisma: PrismaService,
        private mailerService: DynamicMailerService
    ) { }

    async register(data: any) {
        const { name, email, password, role, timezone } = data;

        // Check if user exists (Case Insensitive)
        const existingUser = await this.prisma.user.findFirst({
            where: {
                email: {
                    equals: email,
                    mode: 'insensitive'
                }
            },
        });

        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user (Store lowercase)
        const user = await this.prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                passwordHash,
                role: role || 'patient',
                timezone: timezone || 'UTC', // Auto-detect timezone from client
            },
        });

        // Generate token
        const token = this.generateToken(user);

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                clinicId: user.clinicId,
                image: user.image,
                timezone: user.timezone || 'UTC'
            },
            token,
        };
    }

    async login(data: any) {
        const { email, password, role } = data;

        // 1. Authenticate against central Account
        const account = await this.prisma.account.findUnique({
            where: { email },
            include: {
                users: { include: { memberships: { include: { clinic: true } } } },
                patients: true
            }
        });

        // Fallback for legacy users not yet migrated (safety net)
        if (!account) {
            return this.loginLegacy(data);
        }

        const isValid = await bcrypt.compare(password, account.passwordHash);
        if (!isValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!account.isActive) {
            throw new UnauthorizedException('Account is disabled');
        }

        // 2. Collate all available profiles
        const profiles: any[] = [];

        // Add User profiles (Doctor, Staff, Admin)
        for (const user of account.users) {
            // Primary Role
            profiles.push({
                type: 'USER',
                id: user.id,
                name: user.name,
                role: user.role,
                clinicId: user.clinicId,
                clinicName: 'Primary Clinic' // You might want to fetch clinic name if clinicId exists
            });

            // Secondary Memberships
            for (const member of user.memberships) {
                profiles.push({
                    type: 'MEMBER',
                    id: member.id, // Membership ID for context switching
                    userId: user.id,
                    name: user.name,
                    role: member.role,
                    clinicId: member.clinicId,
                    clinicName: member.clinic ? member.clinic.name : 'Clinic'
                });
            }
        }

        // Add Patient profiles
        for (const patient of account.patients) {
            profiles.push({
                type: 'PATIENT',
                id: patient.id,
                name: patient.name,
                role: 'PATIENT',
                clinicId: patient.clinicId,
                clinicName: 'Patient Portal'
            });
        }

        // 3. Determine Login Path
        // If specific role requested and found, try to auto-select
        if (role) {
            const match = profiles.find(p => p.role === role);
            if (match) {
                return this.generateSessionForProfile(match);
            }
        }

        // If only one profile, auto-login
        if (profiles.length === 1) {
            return this.generateSessionForProfile(profiles[0]);
        }

        // 4. Multiple profiles found -> Return Temporary Token for Selection UI
        const tempToken = jwt.sign(
            { accountId: account.id, purpose: 'ROLE_SELECTION' },
            process.env.JWT_SECRET || 'supersecret',
            { expiresIn: '15m' }
        );

        return {
            requiresRoleSelection: true,
            tempToken,
            availableRoles: profiles
        };
    }

    async selectRole(tempToken: string, profileId: string, profileType: string) {
        let payload: any;
        try {
            payload = jwt.verify(tempToken, process.env.JWT_SECRET || 'supersecret');
        } catch (e) {
            throw new UnauthorizedException('Invalid or expired selection session');
        }

        if (payload.purpose !== 'ROLE_SELECTION') {
            throw new UnauthorizedException('Invalid token purpose');
        }

        const account = await this.prisma.account.findUnique({
            where: { id: payload.accountId },
            include: {
                users: { include: { memberships: { include: { clinic: true } } } },
                patients: true
            }
        });

        if (!account || !account.isActive) throw new UnauthorizedException('Account unavailable');

        // Re-construct profiles to validate selection (secure way)
        // Alternatively, we could decoded the tempToken if we stored valid profile IDs in it, 
        // but re-fetching ensures up-to-date permission revocation status.

        // Find matching profile
        let match: any = null;

        if (profileType === 'USER') {
            match = account.users.find(u => u.id === profileId);
            if (match) match = { ...match, type: 'USER', role: match.role, clinicId: match.clinicId };
        } else if (profileType === 'MEMBER') {
            for (const u of account.users) {
                const m = u.memberships.find(m => m.id === profileId);
                if (m) {
                    match = { ...m, type: 'MEMBER', userId: u.id, role: m.role, clinicId: m.clinicId };
                    break;
                }
            }
        } else if (profileType === 'PATIENT') {
            match = account.patients.find(p => p.id === profileId);
            if (match) match = { ...match, type: 'PATIENT', role: 'patient', clinicId: match.clinicId };
        }

        if (!match) {
            throw new UnauthorizedException('Invalid role selection');
        }

        return this.generateSessionForProfile(match);
    }

    // Helper for generating final session
    private async generateSessionForProfile(profile: any) {
        let user: any;
        let role = profile.role;
        let permissions: any = null;
        let clinicId = profile.clinicId;

        if (profile.type === 'USER') {
            user = await this.prisma.user.findUnique({ where: { id: profile.id } });

            // Check if user status is PENDING (awaiting email verification)
            if (user && user.status === 'PENDING') {
                throw new UnauthorizedException('Please verify your email address before logging in. Check your email for the verification link.');
            }

            permissions = user.permissions;
        } else if (profile.type === 'MEMBER') {
            const member = await this.prisma.clinicMember.findUnique({
                where: { id: profile.id },
                include: {
                    user: true,
                    clinic: { select: { id: true, name: true, logo: true, timezone: true } }
                }
            });
            if (!member) throw new UnauthorizedException('Membership not found');
            user = member.user;
            const activeClinic = member.clinic;

            // Check if user status is PENDING
            if (user && user.status === 'PENDING') {
                throw new UnauthorizedException('Please verify your email address before logging in. Check your email for the verification link.');
            }

            role = member.role;
            permissions = member.permissions;
            clinicId = member.clinicId;
        } else if (profile.type === 'PATIENT') {
            user = await this.prisma.patient.findUnique({
                where: { id: profile.id },
                include: { clinic: { select: { id: true, name: true, logo: true, timezone: true } } }
            });
            role = 'patient'; // ensure lowercase for consistency check later
            const activeClinic = (user as any)?.clinic;
        }

        const activeClinic = (user as any)?.clinic;

        // Generate full token with role context
        const token = this.generateToken({
            ...user,
            role,
            clinicId,
            permissions,
            activeRoleId: profile.id,
            profileType: profile.type
        });

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role,
                clinicId,
                image: (user as any).image, // safe cast
                permissions,
                memberships: user.memberships, // [FIX] Ensure memberships are returned on login
                // [FIX] Ensure context fields are returned on login for role switcher
                profileType: profile.type,
                globalRole: user.role,
                globalClinicId: user.clinicId,
                timezone: user.timezone || (activeClinic ? activeClinic.timezone : null) || 'UTC'
            },
            token
        };
    }

    // Legacy Login (Keep for safety during rollout)
    async loginLegacy(data: any) {
        // ... (Original logic for non-migrated users)
        const { email, password, role } = data;

        let user;
        
        // 1. Try to find precise match by Role if provided
        if (role) {
            const normalizedRole = role.toLowerCase();
            user = await this.prisma.user.findFirst({
                where: { 
                    email: { equals: email, mode: 'insensitive' },
                    role: normalizedRole
                }
            });
        }

        // 2. Fallback to just email if no role specified or no match found (flexible)
        if (!user) {
            user = await this.prisma.user.findFirst({
                where: { email: { equals: email, mode: 'insensitive' } }
            });
        }
        
        // Check if User credentials are valid
        let isUserValid = false;
        if (user && user.passwordHash) {
            isUserValid = await bcrypt.compare(password, user.passwordHash);
        }

        // If User authentication failed (no user, no password, or wrong password), try Patient
        if (!isUserValid && (!role || role.toUpperCase() === 'PATIENT')) {
             const patient = await this.prisma.patient.findFirst({
                where: { 
                    email: { equals: email, mode: 'insensitive' },
                    passwordHash: { not: null } 
                }
            });
            
            if (patient) {
                const isPatientValid = await bcrypt.compare(password, patient.passwordHash!);
                if (isPatientValid) {
                     // Override user object with Patient context
                     user = {
                        id: patient.id,
                        name: patient.name,
                        email: patient.email!,
                        passwordHash: patient.passwordHash,
                        role: 'patient',
                        clinicId: patient.clinicId,
                        status: 'ACTIVE',
                        image: null,
                        permissions: {},
                        timezone: 'UTC',
                        profileType: 'PATIENT'
                    };
                    // Skip further password check since we just validated it
                    // We need to jump to token generation. 
                    // To do this cleanly without refactoring the whole function, we can set isValid flag handled below?
                    // But below checks `user.passwordHash` again.
                    // Let's rely on the fact that we set `user` with the valid hash.
                    isUserValid = true; 
                }
            }
        }

        if (!user) {
             throw new UnauthorizedException('No account found');
        }

        // Final check (if we didn't just validate it above, or if we fell through)
        // We re-check to be safe or just trust our flow.
        const isValid = await bcrypt.compare(password, user.passwordHash || '');
        if (!isValid) throw new UnauthorizedException('Invalid credentials');

        // Check if user status is PENDING (awaiting email verification)
        if (user.status === 'PENDING') {
            throw new UnauthorizedException('Please verify your email address before logging in. Check your email for the verification link.');
        }

        // ... simplified token gen
        return {
            user: { ...user },
            token: this.generateToken(user)
        };
    }


    private generateToken(user: any) {
        // In production, use ConfigService for secret
        const secret = process.env.JWT_SECRET || 'supersecret';
        return jwt.sign(
            {
                userId: user.id || user.userId, // Handle both user object and payload object
                email: user.email,
                role: user.role,
                clinicId: user.clinicId,
                permissions: user.permissions,
                activeRoleId: user.activeRoleId,
                profileType: user.profileType
            },
            secret,
            { expiresIn: '7d' },
        );
    }

    async getMe(jwtUser: any) {
        console.log('[getMe] ========== GET ME CALLED ==========');
        console.log('[getMe] Full JWT user object:', JSON.stringify(jwtUser, null, 2));
        console.log('[getMe] JWT userId:', jwtUser.userId);
        console.log('[getMe] JWT role:', jwtUser.role);
        console.log('[getMe] JWT profileType:', jwtUser.profileType);
        console.log('[getMe] JWT activeRoleId:', jwtUser.activeRoleId);
        console.log('[getMe] JWT clinicId:', jwtUser.clinicId);

        // Fetch full user from database
        const user = await this.prisma.user.findUnique({
            where: { id: jwtUser.userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                timezone: true,
                clinicId: true,
                image: true,
                permissions: true,
                // Profile Fields
                specialties: true,
                schedule: true,
                consultationType: true,
                breakTime: true,
                videoProvider: true,
                personalSmsNumber: true,

                clinic: {
                    select: {
                        name: true,
                        logo: true,
                        timezone: true
                    }
                },
                memberships: {
                    select: {
                        id: true,
                        role: true,
                        clinicId: true,
                        permissions: true,
                        clinic: {
                            select: {
                                name: true,
                                logo: true,
                                timezone: true
                            }
                        }
                    }
                },
                accountId: true // [FIX] Fetch accountId
            }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // [FIX] Fetch Account to find sibling profiles (e.g. Admin + Doctor as separate users)
        let siblingProfiles: any[] = [];
        console.log('[getMe] User Account ID:', user.accountId); // Log account ID
        if (user.accountId) {
            const account = await this.prisma.account.findUnique({
                where: { id: user.accountId },
                include: {
                    users: {
                        select: {
                            id: true,
                            name: true,
                            role: true,
                            clinicId: true,
                            clinic: { select: { name: true } }
                        }
                    }
                }
            });

            if (account && account.users) {
                // Filter out current user
                siblingProfiles = account.users.filter(u => u.id !== user.id).map(u => ({
                    id: u.id, // User ID acting as "Profile ID"
                    role: u.role,
                    clinicId: u.clinicId,
                    type: 'USER', // Distinguish from MEMBER
                    clinic: u.clinic,
                    isSibling: true
                }));
            }
        }

        console.log('[getMe] User from DB - primary role:', user.role, 'memberships count:', user.memberships.length);

        let userClinicId: string | null = null;
        let activeClinic = user?.clinic;
        let activeRole = user?.role;
        let activePermissions = user?.permissions;
        let activeRoleId = user.id;
        let profileType = 'USER';

        // Determine active context based on JWT profileType and activeRoleId
        console.log('[getMe] Checking profileType:', jwtUser.profileType, '=== "MEMBER"?', jwtUser.profileType === 'MEMBER');
        console.log('[getMe] activeRoleId present?', !!jwtUser.activeRoleId);

        if (jwtUser.profileType === 'MEMBER' && jwtUser.activeRoleId) {
            console.log('[getMe] → Entering MEMBER context branch');
            // User is in a membership context
            const membership = user.memberships.find(m => m.id === jwtUser.activeRoleId);
            console.log('[getMe] Looking for membership with ID:', jwtUser.activeRoleId);
            console.log('[getMe] Found membership?', !!membership);

            if (membership) {
                activeRole = membership.role;
                activePermissions = membership.permissions;
                activeClinic = membership.clinic;
                userClinicId = membership.clinicId;
                activeRoleId = membership.id;
                profileType = 'MEMBER';
                console.log('[getMe] ✓ Using MEMBER context:', { role: activeRole, clinicId: userClinicId, membershipId: activeRoleId });
            } else {
                console.warn('[getMe] ✗ Membership not found, falling back to primary role');
                userClinicId = user.clinicId;
            }
        } else {
            console.log('[getMe] → Entering PRIMARY USER context branch');
            // User is in primary USER context (or JWT doesn't have profileType)
            activeRole = user.role;
            activePermissions = user.permissions;
            activeClinic = user.clinic;
            userClinicId = user.clinicId;
            activeRoleId = user.id;
            profileType = 'USER';
            console.log('[getMe] ✓ Using PRIMARY USER context:', { role: activeRole, clinicId: userClinicId });
        }

        // If patient, also fetch Patient profile and waitlist status
        let patientId: string | null = null;
        let isOnWaitlist = false;

        if (user.role === 'patient') {
            const patient = await this.prisma.patient.findFirst({
                where: { email: { equals: user.email, mode: 'insensitive' } },
                include: { clinic: true }
            });
            patientId = patient?.id || null;
            userClinicId = patient?.clinicId || null;

            if (patientId) {
                const waitlistEntry = await this.prisma.appointment.findFirst({
                    where: {
                        patientId,
                        status: 'waitlist'
                    }
                });
                isOnWaitlist = !!waitlistEntry;
            }
        }

        const result = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: activeRole, // Return context role
            // [TIMEZONE FALLBACK] User -> Clinic -> UTC
            timezone: user.timezone || (activeClinic ? activeClinic.timezone : null) || 'UTC',
            clinicId: userClinicId,
            patientId,
            isOnWaitlist,
            image: user.image,
            permissions: activePermissions, // Return context permissions
            // Profile fields
            specialties: user.specialties,
            schedule: user.schedule,
            consultationType: user.consultationType,
            breakTime: user.breakTime,
            videoProvider: user.videoProvider,
            personalSmsNumber: user.personalSmsNumber,
            clinic: activeClinic ? {
                name: activeClinic.name,
                logo: activeClinic.logo,
            } : userClinicId ? await this.prisma.clinic.findUnique({
                where: { id: userClinicId },
                select: { name: true, logo: true }
            }) : undefined,
            memberships: [...user.memberships, ...siblingProfiles], // Return all memberships AND sibling profiles for switcher
            // Expose the "Base" identity details so frontend knows it exists
            globalRole: user.role,
            globalClinicId: user.clinicId,
            activeRoleId: activeRoleId,
            profileType: profileType
        };

        console.log('[getMe] Returning:', { role: result.role, profileType: result.profileType, activeRoleId: result.activeRoleId });

        return result;
    }

    async switchRole(userId: string, membershipId: string) {
        console.log('[switchRole] Called with userId:', userId, 'membershipId:', membershipId);

        let activeRole, activeClinicId, activePermissions, activeClinic, activeRoleId, profileType;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                clinicId: true,
                permissions: true,
                timezone: true, // [FIX] Include timezone
                memberships: {
                    select: {
                        id: true,
                        role: true,
                        clinicId: true,
                        permissions: true,
                        clinic: { select: { name: true, logo: true, timezone: true } }
                    }
                },
                clinic: { select: { name: true, logo: true, timezone: true } },
                accountId: true // [FIX] Fetch accountId
            }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        console.log('[switchRole] User found:', { id: user.id, primaryRole: user.role, memberships: user.memberships.length });

        if (membershipId === 'main') {
            // Revert to primary user context
            activeRole = user.role;
            activeClinicId = user.clinicId;
            activePermissions = user.permissions;
            activeClinic = user.clinic;
            activeRoleId = user.id;
            profileType = 'USER';
            console.log('[switchRole] Switching to MAIN profile:', { activeRole, activeClinicId, profileType });
        } else {
            // Verify membership OR Sibling Profile
            const membership = user.memberships.find(m => m.id === membershipId);

            if (membership) {
                activeRole = membership.role;
                activeClinicId = membership.clinicId;
                activePermissions = membership.permissions;
                activeClinic = membership.clinic;
                activeRoleId = membership.id;
                profileType = 'MEMBER';
                console.log('[switchRole] Switching to MEMBERSHIP:', { activeRole, activeClinicId, profileType, membershipId });
            } else {
                // Check if it's a Sibling User (Account-level switch)
                if (user.accountId) {
                    const account = await this.prisma.account.findUnique({
                        where: { id: user.accountId },
                        include: { users: { include: { clinic: true } } }
                    });

                    const siblingUser = account?.users?.find(u => u.id === membershipId);

                    if (siblingUser) {
                        // Found sibling!
                        console.log('[switchRole] Switching to SIBLING USER:', siblingUser.id);

                        // We are basically logging in as the other user
                        // But we want to maintain the "linked" feeling if possible, 
                        // or just treat it as a full user switch.
                        // For simplicity in this `switchRole` flow, we generate a token for THAT user.

                        activeRole = siblingUser.role;
                        activeClinicId = siblingUser.clinicId;
                        activePermissions = siblingUser.permissions;
                        activeClinic = siblingUser.clinic;
                        activeRoleId = siblingUser.id; // The user ID itself is the active role ID
                        profileType = 'USER';

                        // CRITICAL: We need to return this new User's ID as the userId in the token
                        // So we are effectively SU-ing into the sibling.
                        userId = siblingUser.id;

                    } else {
                        throw new UnauthorizedException('Invalid membership or profile');
                    }
                } else {
                    throw new UnauthorizedException('Invalid membership');
                }
            }
        }

        // Generate new token with new context
        const secret = process.env.JWT_SECRET || 'supersecret';
        const token = jwt.sign(
            {
                userId: userId,
                email: user.email,
                role: activeRole,
                clinicId: activeClinicId,
                permissions: activePermissions,
                activeRoleId: activeRoleId,
                profileType: profileType
            },
            secret,
            { expiresIn: '7d' },
        );

        const response = {
            token,
            profileType, // Return for frontend routing
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: activeRole,
                image: user.image,
                clinicId: activeClinicId,
                permissions: activePermissions,
                activeRoleId: activeRoleId,
                profileType: profileType,
                globalRole: user.role,
                globalClinicId: user.clinicId,
                timezone: user.timezone || (activeClinic ? activeClinic.timezone : null) || 'UTC', // [FIX] Include timezone
                clinic: activeClinic ? {
                    name: activeClinic.name,
                    logo: activeClinic.logo
                } : undefined,
                memberships: user.memberships,
                // Pass back valid switch options (e.g. main identity)
                isMainIdentity: membershipId === 'main' // Helper for frontend if needed
            }
        };

        console.log('[switchRole] Returning response:', { role: response.user.role, profileType: response.profileType });

        return response;
    }

    async forgotPassword(email: string) {
        console.log(`[AuthService] Forgot password requested for: ${email}`);
        // Case Insensitive Lookup
        const user = await this.prisma.user.findFirst({
            where: {
                email: {
                    equals: email,
                    mode: 'insensitive'
                }
            }
        });

        // Always return success to prevent user enumeration
        if (!user) {
            console.log('[AuthService] User not found for email:', email);
            return { message: 'If an account exists, a reset link has been sent.' };
        }
        console.log('[AuthService] User found. Generating token...');

        // Generate reset token (short-lived JWT)
        const secret = process.env.JWT_SECRET || 'supersecret';
        const resetToken = jwt.sign(
            { userId: user.id, purpose: 'password_reset' },
            secret,
            { expiresIn: '15m' }
        );

        // Construct reset link (Frontend URL)
        // Ensure FRONTEND_URL is set or fallback
        const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

        try {
            console.log('[AuthService] Sending email...');
            await this.mailerService.sendMail(undefined, { // undefined userId forces system sender
                to: email,
                subject: 'Reset Your Password - MediFlow',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Password Reset Request</h2>
                        <p>We received a request to reset your password for your MediFlow account.</p>
                        <p>Click the button below to reset it. This link expires in 15 minutes.</p>
                        <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">Reset Password</a>
                        <p>If you didn't request this, you can safely ignore this email.</p>
                    </div>
                `
            });
            console.log('[AuthService] Email sent successfully via MailerService');
        } catch (error) {
            console.error('[AuthService] Failed to send reset email:', error);
            // Don't expose email failure to client, just log it
        }

        return { message: 'If an account exists, a reset link has been sent.' };
    }
    async resetPassword(token: string, newPassword: string) {
        const secret = process.env.JWT_SECRET || 'supersecret';
        let decoded: any;
        try {
            decoded = jwt.verify(token, secret);
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired token');
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Handle Patient Invite / Set Password
        if (decoded.type === 'patient_invite') {
            await this.prisma.patient.update({
                where: { id: decoded.id },
                data: { passwordHash }
            });
            return { message: 'Password set successfully' };
        }

        // Handle User Password Reset
        if (decoded.purpose === 'password_reset') {
            await this.prisma.user.update({
                where: { id: decoded.userId },
                data: { passwordHash }
            });
            return { message: 'Password updated successfully' };
        }

        throw new UnauthorizedException('Invalid token purpose');
    }

    async verifyPassword(userId: string, password: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return false;
        return bcrypt.compare(password, user.passwordHash || '');
    }

    async changePassword(userId: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const isSame = await bcrypt.compare(newPassword, user.passwordHash || '');
        if (isSame) {
            throw new ConflictException('you typed existing password, type a new one');
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update(({
            where: { id: userId },
            data: { passwordHash }
        }) as any);
        return { message: 'Password changed successfully' };
    }

    async requestVerification(data: { email: string; name: string; password: string; role: string; timezone?: string }) {
        const { email, name, password, role, timezone } = data;

        // Check if user already exists
        const [existingUser, existingAccount] = await Promise.all([
            this.prisma.user.findFirst({
                where: { email: { equals: email, mode: 'insensitive' } }
            }),
            this.prisma.account.findUnique({
                where: { email: email.toLowerCase() }
            })
        ]);

        if (existingUser || existingAccount) {
            const rawRole = existingUser?.role || 'user';
            const humanRole = rawRole.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            throw new ConflictException(`An account with this email already exists as a ${humanRole}. Please log in instead.`);
        }

        // Rate limiting: Check if too many requests from this email
        const recentRequests = await this.prisma.emailVerification.count({
            where: {
                email: email.toLowerCase(),
                createdAt: {
                    gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
                }
            }
        });

        if (recentRequests >= 3) {
            throw new ConflictException('Too many verification requests. Please try again later.');
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash password before storing
        const passwordHash = await bcrypt.hash(password, 10);

        // Store verification data
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Delete any existing verification for this email
        await this.prisma.emailVerification.deleteMany({
            where: { email: email.toLowerCase() }
        });

        await this.prisma.emailVerification.create({
            data: {
                email: email.toLowerCase(),
                code,
                userData: {
                    name,
                    passwordHash,
                    role: role || 'patient',
                    timezone: timezone || 'UTC' // Store timezone for account creation
                },
                expiresAt
            }
        });

        // Send verification email
        try {
            await this.mailerService.sendMail(undefined, {
                to: email,
                subject: 'Verify Your MediFlow Account',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Verify Your Email</h2>
                        <p>Hello ${name},</p>
                        <p>Your verification code is:</p>
                        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                            ${code}
                        </div>
                        <p>This code will expire in 10 minutes.</p>
                        <p>If you didn't request this code, please ignore this email.</p>
                        <p>Best regards,<br>MediFlow Team</p>
                    </div>
                `
            });
        } catch (error) {
            console.error('Failed to send verification email:', error);
            // Don't block registration if email fails, just log the code for developers
            this.logger.warn(`
            ==================================================
            EMAIL SEND FAILURE for ${email}
            Verification Code: ${code}
            ==================================================
            `);
        }

        return {
            message: 'Verification code sent to your email',
            email: email.toLowerCase()
        };
    }

    async verifyInvite(token: string) {
        // Find user by verification token
        const user = await this.prisma.user.findFirst({
            where: { verificationToken: token }
        });

        if (!user) {
            throw new UnauthorizedException('Invalid or expired verification token');
        }

        // Activate user
        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                status: 'ACTIVE',
                verificationToken: null // Clear token
            }
        });

        // Auto-login (generate token)
        const authToken = this.generateToken(updatedUser);

        return {
            message: 'Account verified successfully',
            token: authToken,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                clinicId: updatedUser.clinicId,
                image: updatedUser.image,
            }
        };
    }

    async verifyAndCreateAccount(email: string, code: string) {
        // Find verification record
        const verification = await this.prisma.emailVerification.findFirst({
            where: {
                email: email.toLowerCase(),
                code
            }
        });

        if (!verification) {
            throw new UnauthorizedException('Invalid verification code');
        }

        // Check expiration
        if (new Date() > verification.expiresAt) {
            await this.prisma.emailVerification.delete({ where: { id: verification.id } });
            throw new UnauthorizedException('Verification code has expired');
        }

        // Extract user data
        const userData = verification.userData as any;

        // Implicit Clinic Creation for SYSTEM_ADMIN
        let clinicId: string | null = null;
        if (userData.role === 'SYSTEM_ADMIN') {
            const clinic = await this.prisma.clinic.create({
                data: {
                    name: `${userData.name}'s Clinic`,
                    address: 'Default Address',
                    timezone: userData.timezone || 'UTC' // Use user's timezone for clinic
                }
            });
            clinicId = clinic.id;
        }

        // Define default permissions based on role
        const defaultPermissions: Record<string, boolean> = {};
        if (userData.role === 'SYSTEM_ADMIN') {
            // System Admin has all permissions implicitly, but we can store them for clarity if needed
            // However, the rule says it bypasses checks.
        } else if (userData.role === 'CLINIC_ADMIN') {
            defaultPermissions['view_clinic_info'] = true;
            defaultPermissions['manage_clinic_info'] = true;
            defaultPermissions['view_doctors'] = true;
            defaultPermissions['manage_doctors'] = true;
            defaultPermissions['view_patients'] = true;
            defaultPermissions['manage_patients'] = true;
            defaultPermissions['manage_appointments'] = true;
            defaultPermissions['view_workflows'] = true;
            defaultPermissions['manage_workflows'] = true;
            defaultPermissions['manage_own_config'] = true;
        } else if (userData.role === 'DOCTOR') {
            defaultPermissions['view_clinic_info'] = true;
            defaultPermissions['view_doctors'] = true;
            defaultPermissions['view_own_schedule'] = true;
            defaultPermissions['manage_own_schedule'] = true;
            defaultPermissions['view_patients'] = true;
            defaultPermissions['chat_with_own_patients'] = true;
            defaultPermissions['manage_own_config'] = true;
        } else if (userData.role === 'STAFF') {
            defaultPermissions['view_clinic_info'] = true;
            defaultPermissions['view_doctors'] = true;
            defaultPermissions['view_patients'] = true;
            defaultPermissions['manage_patients'] = true;
            defaultPermissions['manage_appointments'] = true;
            defaultPermissions['view_all_appointments'] = true;
        } else if (userData.role === 'MANAGER') {
            defaultPermissions['view_clinic_info'] = true;
            defaultPermissions['view_doctors'] = true;
            defaultPermissions['view_patients'] = true;
            defaultPermissions['view_all_appointments'] = true;
            defaultPermissions['view_workflows'] = true;
        }
        // ... more defaults can be added later as we refine

        // Create user
        const user = await this.prisma.user.create({
            data: {
                name: userData.name,
                email: email.toLowerCase(),
                passwordHash: userData.passwordHash,
                role: userData.role,
                clinicId: clinicId,
                permissions: defaultPermissions,
                timezone: userData.timezone || 'UTC' // Set user's timezone
            } as any
        });

        // Delete verification record
        await this.prisma.emailVerification.delete({ where: { id: verification.id } });

        // Generate token
        const token = this.generateToken(user);

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                clinicId: user.clinicId,
                image: user.image
            },
            token
        };
    }

}
