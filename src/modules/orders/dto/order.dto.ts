import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum } from 'class-validator';

export class CheckoutSummaryDto {
  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  coupon_code?: string;
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
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  coupon_code?: string;
}
