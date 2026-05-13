import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubscribeNewsletterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class SubmitContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
