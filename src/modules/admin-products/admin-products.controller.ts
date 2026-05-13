import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, Res } from '@nestjs/common';
import { AdminProductsService } from './admin-products.service';
import { CreateProductDto, UpdateProductDto, CreateCategoryDto } from './dto/admin-product.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminProductsController {
  constructor(private readonly productsService: AdminProductsService) {}

  @Get('products')
  getProducts(@Query() query: any) {
    return this.productsService.getProducts(query);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto, @Req() req: any) {
    // In a real app, get user_id from req.user
    const adminUserId = req?.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.productsService.createProduct(adminUserId, dto);
  }

  // Categories
  @Get('categories')
  getCategories() {
    return this.productsService.getCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @Get('products/export')
  async exportProducts(@Res() res: any, @Req() req: any) {
    const adminUserId = req?.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.productsService.exportProducts(res, adminUserId);
  }

  @Get('products/:id')
  getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() req: any) {
    const adminUserId = req?.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.productsService.updateProduct(id, adminUserId, dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string, @Req() req: any) {
    const adminUserId = req?.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.productsService.deleteProduct(id, adminUserId);
  }
}
