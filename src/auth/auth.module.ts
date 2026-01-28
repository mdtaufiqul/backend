import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RoleTemplateService } from './role-template.service';
import { DynamicMailerService } from '../services/dynamic-mailer.service';
import { EncryptionService } from '../common/encryption.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, RoleTemplateService, DynamicMailerService, EncryptionService],
  exports: [RoleTemplateService]
})
export class AuthModule { }
