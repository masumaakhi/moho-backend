import { IsNotEmpty, IsString } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  email!: string; // email or username as per UI label; we treat as email for now

  @IsString()
  @IsNotEmpty()
  password!: string;
}
