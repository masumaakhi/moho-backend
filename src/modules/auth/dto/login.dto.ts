import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  contact!: string; // phone or email

  @IsString()
  @IsNotEmpty()
  password!: string;
}
