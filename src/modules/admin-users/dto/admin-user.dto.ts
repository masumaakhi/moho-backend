import { IsString, IsEmail, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { AdminStatus } from '@prisma/client';

export class CreateAdminDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  password: string;

  @IsUUID()
  role_id: string;
}

export class UpdateAdminDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsUUID()
  @IsOptional()
  role_id?: string;
}

export class UpdateAdminStatusDto {
  @IsEnum(AdminStatus)
  status: AdminStatus;
}
