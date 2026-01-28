import { IsString, IsOptional, IsEnum, IsBoolean, IsJSON, IsObject } from 'class-validator';

export class CreateFormDto {
    @IsString()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(['draft', 'published', 'archived'])
    @IsOptional()
    status?: string;

    @IsObject()
    config: any; // Using any to support dynamic JSON structure of forms

    @IsString()
    @IsOptional()
    type?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
