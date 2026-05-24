import { IsString, IsUrl, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateVideoReviewDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsUrl()
  video_url: string;

  @IsInt()
  @IsOptional()
  sort_order?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateVideoReviewDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsUrl()
  @IsOptional()
  video_url?: string;

  @IsInt()
  @IsOptional()
  sort_order?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
