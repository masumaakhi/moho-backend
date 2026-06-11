import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(6)
  new_password!: string;
}
