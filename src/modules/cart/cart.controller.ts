import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Headers } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Headers('x-session-id') sessionId: string, @Headers('authorization') authHeader: string) {
    return this.cartService.getCart(sessionId, authHeader);
  }

  @Post('items')
  async addToCart(
    @Headers('x-session-id') sessionId: string,
    @Headers('authorization') authHeader: string,
    @Body() dto: AddToCartDto
  ) {
    return this.cartService.addToCart(sessionId, authHeader, dto);
  }

  @Patch('items/:id')
  async updateCartItem(
    @Param('id') itemId: string,
    @Body() dto: UpdateCartItemDto
  ) {
    return this.cartService.updateCartItem(itemId, dto.quantity);
  }

  @Delete('items/:id')
  async removeCartItem(@Param('id') itemId: string) {
    return this.cartService.removeCartItem(itemId);
  }
}
