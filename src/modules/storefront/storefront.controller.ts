import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { StorefrontService } from './storefront.service';
import { SubscribeNewsletterDto, SubmitContactDto } from './dto/storefront.dto';

@Controller()
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get('home')
  getHome() {
    return this.storefrontService.getHome();
  }

  @Get('products')
  getProducts(@Query() query: any) {
    return this.storefrontService.getProducts(query);
  }

  @Get('products/trending')
  getTrendingProducts() {
    return this.storefrontService.getTrendingProducts();
  }

  @Get('products/featured')
  getFeaturedProducts() {
    return this.storefrontService.getFeaturedProducts();
  }

  @Get('products/:slug')
  getProductBySlug(@Param('slug') slug: string) {
    return this.storefrontService.getProductBySlug(slug);
  }

  @Get('products/:id/related')
  getRelatedProducts(@Param('id') id: string) {
    return this.storefrontService.getRelatedProducts(id);
  }

  @Post('newsletter')
  subscribeNewsletter(@Body() body: SubscribeNewsletterDto) {
    return this.storefrontService.subscribeNewsletter(body.email);
  }

  @Post('contact')
  submitContact(@Body() body: SubmitContactDto) {
    return this.storefrontService.submitContact(body);
  }
}
