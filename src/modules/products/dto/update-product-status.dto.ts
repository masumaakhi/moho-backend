import { IsEnum, IsNotEmpty } from 'class-validator';

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DRAFT = 'DRAFT',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export class UpdateProductStatusDto {
  @IsNotEmpty()
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
