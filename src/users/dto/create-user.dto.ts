import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateUserDto {
    name: string;
    email: string;
    role: string;

    @IsOptional()
    @IsString()
    creatorId?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    specialties?: string[];

    @IsOptional()
    consultationType?: string;

    @IsOptional()
    schedule?: any;

    @IsOptional()
    @IsString()
    clinicId?: string;
    password?: string;
    passwordHash?: string;
    image?: string;
    permissions?: Record<string, boolean>;

    @IsOptional()
    @IsString()
    personalSmsNumber?: string;

    @IsOptional()
    isPermissionOverridden?: boolean;
}
