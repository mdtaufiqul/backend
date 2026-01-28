import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateServiceDto {
    @IsString()
    name: string;

    @IsString()
    duration: string;

    @IsNumber()
    @IsOptional()
    price?: number;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    type?: string;

    @IsString()
    @IsOptional()
    clinicId?: string;

    @IsString()
    @IsOptional()
    doctorId?: string;
}
