import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFile, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ZoomService } from '../services/zoom.service';
import { GoogleMeetService } from '../services/google-meet.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../common/public.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly zoomService: ZoomService,
    private readonly googleMeetService: GoogleMeetService
  ) { }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('manage_staff')
  create(@Body() createUserDto: CreateUserDto, @Request() req) {
    // Pass the creator's ID to use their SMTP config for the welcome email
    if (req.user && req.user.id) {
      createUserDto.creatorId = req.user.id;
    }

    // STRICT MULTI-TENANCY: Enforce clinicId
    // If not SaaS owner, you can ONLY create users in your own clinic.
    if (req.user.role !== 'SAAS_OWNER') {
      if (req.user.clinicId) {
        // Enforce the creator's clinic ID
        createUserDto.clinicId = req.user.clinicId;
      } else {
        // Should not happen for valid admins, but safety check
        throw new ForbiddenException('You must belong to a clinic to create users.');
      }
    }

    return this.usersService.create(createUserDto);
  }

  @Get('check-email/:email')
  @Permissions('view_staff') // Or just public? Actually check-email is used in signup too, but this is management.
  async checkEmail(@Param('email') email: string) {
    return this.usersService.checkEmailExists(email);
  }

  @Get()
  @Get()
  // @Permissions('view_staff') // Moved to internal check to allow restricted access (e.g. Doctor fetching self)
  findAll(
    @Query('role') role?: string,
    @Query('clinicId') queryClinicId?: string,
    @Query('search') search?: string,
    @Request() req?: any
  ) {
    let targetClinicId = req.user.clinicId; // Default to user's clinic

    // STRICT ACCESS CONTROL
    const isSaasOwner = req.user.role === 'SAAS_OWNER';
    const hasViewStaff = req.user.role === 'SYSTEM_ADMIN' || req.user.permissions?.view_staff;

    // Internal Permission Check
    if (!hasViewStaff && !isSaasOwner) {
      // If user is DOCTOR (or other) without view_staff, strictly limit to THEMSELVES.
      // This fixes the FormRenderer 403 while maintaining isolation.
      // We bypass the service.findAll regex/search logic for this specific case to be safe.
      // Actually, we can just return an array containing the current user if they match the filters.
      if (role && role !== req.user.role) {
        return []; // Asking for different role -> Empty
      }
      // Force return only self
      return this.usersService.findAll(req.user.role, targetClinicId, search).then(users => {
        return users.filter(u => u.id === req.user.id);
      });
    }

    if (isSaasOwner) {
      // SaaS Owner can override clinicId context or view all (if undefined)
      targetClinicId = queryClinicId;
    } else if (req.user.role === 'SYSTEM_ADMIN' && !req.user.clinicId && queryClinicId) {
      // Allow SYSTEM_ADMIN with stale token (but correct DB state) to use the query param
      // Ideally we verify this against DB, but for now we trust the client's context if they are admin
      targetClinicId = queryClinicId;
    } else {
      // Everyone else (SYSTEM_ADMIN with valid token, DOCTOR, etc.) is FORCED to their clinic.
      // Even if they pass ?clinicId=Other, we ignore it and use req.user.clinicId
      if (queryClinicId && req.user.clinicId && queryClinicId !== req.user.clinicId) {
        // Option: throw error, or just silently enforce. 
        // Silent enforcement is safer for UX stability, preventing leakage.
        // But let's log it.
        console.warn(`[Security] User ${req.user.id} (${req.user.role}) attempted to access clinic ${queryClinicId} but was scoped to ${req.user.clinicId}`);
      }
      // Use token clinicId if available, otherwise fallback to queryClinicId if user is SYSTEM_ADMIN (handled above) 
      // or null which returns empty.
      targetClinicId = req.user.clinicId;
    }

    // Edge case: Headless SYSTEM_ADMIN (no clinicId) should NOT see everything.
    if (!isSaasOwner && !targetClinicId) {
      return []; // Or throw Forbidden
    }

    return this.usersService.findAll(role, targetClinicId, search);
  }

  @Get('role-permissions')
  @UseGuards(JwtAuthGuard)
  async getRolePermissions(
    @Query('role') role: string,
    @Query('clinicId') clinicId: string
  ) {
    // If not passed, try to get from current user's clinic (if admin)
    // But for now, require them query params
    return this.usersService.getRolePermissions(clinicId, role);
  }

  @Public() // Allow public access for booking form to fetch doctor details
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    // If authenticated, apply permission checks
    if (req.user) {
      if (req.user.role !== 'SYSTEM_ADMIN' && req.user.userId !== id && !req.user.permissions?.view_staff) {
        throw new ForbiddenException('Unauthorized to view this user');
      }
    }
    // Public access allowed for booking forms
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    console.log(`[UsersController] Updating user ${id}`, JSON.stringify(updateUserDto, null, 2));
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.userId !== id && !req.user.permissions?.manage_staff) {
      throw new ForbiddenException('Unauthorized to update this user');
    }
    return this.usersService.update(id, updateUserDto, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions('manage_staff')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/avatars',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadAvatar(@Param('id') id: string, @UploadedFile() file: any, @Request() req) {
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.userId !== id && !req.user.permissions?.manage_staff) {
      throw new ForbiddenException('Unauthorized to update avatar for this user');
    }
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    // Use strict method to avoid update DTO casting issues
    await this.usersService.updateAvatar(id, avatarUrl);
    return { url: avatarUrl };
  }

  // Video Provider Settings Endpoints

  @Get(':id/video-settings')
  getVideoSettings(@Param('id') id: string, @Request() req) {
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.userId !== id && !req.user.permissions?.manage_staff) {
      throw new ForbiddenException('Unauthorized to view video settings');
    }
    return this.usersService.getVideoSettings(id);
  }

  @Patch(':id/video-provider')
  @Permissions('manage_staff')
  updateVideoProvider(
    @Param('id') id: string,
    @Body('provider') provider: string,
    @Request() req
  ) {
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.userId !== id && !req.user.permissions?.manage_staff) {
      throw new ForbiddenException('Unauthorized to update video provider');
    }
    return this.usersService.updateVideoProvider(id, provider);
  }

  @Patch(':id/zoom-credentials')
  async updateZoomCredentials(
    @Param('id') id: string,
    @Body() credentials: { clientId: string; clientSecret: string; accountId: string },
    @Request() req
  ) {
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.userId !== id && !req.user.permissions?.manage_staff) {
      throw new ForbiddenException('Unauthorized to update zoom credentials');
    }
    const result = await this.usersService.updateZoomCredentials(id, credentials);

    // Test credentials
    const isValid = await this.zoomService.testCredentials(id);

    return { ...result, credentialsValid: isValid };
  }

  @Patch(':id/google-credentials')
  async updateGoogleCredentials(
    @Param('id') id: string,
    @Body() credentials: { clientId: string; clientSecret: string; refreshToken?: string },
    @Request() req
  ) {
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.userId !== id && !req.user.permissions?.manage_staff) {
      throw new ForbiddenException('Unauthorized to update google credentials');
    }
    const result = await this.usersService.updateGoogleCredentials(id, credentials);

    // Test credentials
    const isValid = await this.googleMeetService.testCredentials(id);

    return { ...result, credentialsValid: isValid };
  }

  @Post(':id/google-auth-url')
  generateGoogleAuthUrl(
    @Param('id') id: string,
    @Body() body: { clientId: string; clientSecret: string },
    @Request() req
  ) {
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.userId !== id && !req.user.permissions?.manage_staff) {
      throw new ForbiddenException('Unauthorized to generate google auth url');
    }
    const authUrl = this.googleMeetService.generateAuthUrl(body.clientId, body.clientSecret);
    return { authUrl };
  }

  @Post(':id/google-exchange-code')
  async exchangeGoogleCode(
    @Param('id') id: string,
    @Body() body: { code: string; clientId?: string; clientSecret?: string; useStoredCredentials?: boolean },
    @Request() req
  ) {
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.userId !== id && !req.user.permissions?.manage_staff) {
      throw new ForbiddenException('Unauthorized to exchange google code');
    }
    let clientId = body.clientId;
    let clientSecret = body.clientSecret;

    if (body.useStoredCredentials) {
      const userCreds = await this.usersService.getUserGoogleCredentials(id);
      if (!userCreds?.googleClientId || !userCreds?.googleClientSecret) {
        throw new Error('Stored Google credentials not found. Please enter them again.');
      }
      clientId = userCreds.googleClientId;
      clientSecret = userCreds.googleClientSecret;
    }

    if (!clientId || !clientSecret) {
      throw new Error('Missing credentials');
    }

    const refreshToken = await this.googleMeetService.exchangeCodeForTokens(
      body.code,
      clientId,
      clientSecret
    );

    // Save the refresh token (and update creds if they were passed)
    await this.usersService.updateGoogleCredentials(id, {
      clientId,
      clientSecret,
      refreshToken
    });

    return { success: true, message: 'Google Meet connected successfully' };
  }
}
