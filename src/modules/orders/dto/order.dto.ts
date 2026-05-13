import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum } from 'class-validator';

export class CheckoutSummaryDto {
  @IsOptional()
  @IsString()
  zone?: string;
}

export class PlaceOrderDto {
  @IsString()
  @IsNotEmpty()
  customer_name: string;

  @IsString()
  @IsNotEmpty()
  customer_phone: string;

  @IsOptional()
  @IsEmail()
  customer_email?: string;

  @IsString()
  @IsNotEmpty()
  shipping_address: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(['cod', 'online'])
  payment_method?: string;
}
