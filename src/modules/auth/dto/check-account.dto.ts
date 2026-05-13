import { IsNotEmpty, IsString } from 'class-validator';

export class CheckAccountDto {
  @IsString()
  @IsNotEmpty()
  contact!: string; // phone or email
}

