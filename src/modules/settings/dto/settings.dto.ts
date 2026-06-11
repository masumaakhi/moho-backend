import { IsString, IsOptional, IsNumber, IsBoolean, IsEmail, IsObject } from 'class-validator';

export class UpdateGeneralSettingsDto {
  @IsString()
  @IsOptional()
  business_name?: string;

  @IsString()
  @IsOptional()
  business_phone?: string;

  @IsString()
  @IsOptional()
  business_address?: string;

  @IsString()
  @IsOptional()
  business_logo?: string;

  @IsString()
  @IsOptional()
  manual_report_prices?: string;
}

export class UpdateDeliverySettingsDto {
  @IsString()
  @IsOptional()
  pathao_api_key?: string;

  @IsString()
  @IsOptional()
  pathao_secret?: string;

  @IsString()
  @IsOptional()
  pathao_client_id?: string;

  @IsString()
  @IsOptional()
  pathao_store_id?: string;

  @IsString()
  @IsOptional()
  pathao_username?: string;

  @IsString()
  @IsOptional()
  pathao_password?: string;

  @IsNumber()
  @IsOptional()
  delivery_charge_default?: number;

  @IsNumber()
  @IsOptional()
  delivery_charge_inside?: number;

  @IsNumber()
  @IsOptional()
  delivery_charge_outside?: number;
}

export class UpdateEmailSettingsDto {
  @IsString()
  @IsOptional()
  smtp_host?: string;

  @IsNumber()
  @IsOptional()
  smtp_port?: number;

  @IsString()
  @IsOptional()
  smtp_user?: string;

  @IsString()
  @IsOptional()
  smtp_pass?: string;

  @IsEmail()
  @IsOptional()
  sender_email?: string;
}

export class UpdateNotificationSettingsDto {
  @IsNumber()
  @IsOptional()
  inventory_alert_threshold?: number;

  @IsBoolean()
  @IsOptional()
  auto_send_daily_digest?: boolean;

  @IsEmail()
  @IsOptional()
  admin_report_email?: string;

  @IsString()
  @IsOptional()
  report_time?: string;
}

export class UpdateReportReceiverDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  email: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
