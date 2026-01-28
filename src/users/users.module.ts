import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ServicesModule,
    MulterModule.register({
      dest: './uploads/avatars',
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
