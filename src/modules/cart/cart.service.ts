import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private extractUserId(authHeader?: string): string | null {
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    try {
      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'access_secret',
      });
      return decoded.sub;
    } catch {
      return null;
    }
  }

  async getCart(sessionId: string, authHeader?: string) {
    const userId = this.extractUserId(authHeader);

    if (!userId && !sessionId) return { items: [], subtotal: 0 };

    const cart = await this.prisma.cart.findFirst({
      where: {
        status: 'active',
        OR: [
          ...(userId ? [{ user_id: userId }] : []),
          ...(sessionId ? [{ session_id: sessionId }] : []),
        ],
      },
      include: {
        items: {
          include: {
            product: { include: { images: true } },
            variant: true,
          },
        },
      },
    });

    if (!cart) {
      return { items: [], subtotal: 0 };
    }

    // Merge carts if needed? Simplest approach is just return found cart
    const subtotal = cart.items.reduce(
      (acc, item) => acc + Number(item.price) * item.quantity,
      0,
    );
    return { ...cart, subtotal };
  }

  async addToCart(
    sessionId: string,
    authHeader: string,
    dto: { productId: string; variantId?: string; quantity: number },
  ) {
    const userId = this.extractUserId(authHeader);
    if (!sessionId && !userId)
      throw new BadRequestException('Session ID is required');

    // Check stock
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || product.status !== 'active')
      throw new NotFoundException('Product not available');

    let price = product.new_price || product.base_price;
    let availableStock = product.stock_quantity;

    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      });
      if (!variant) throw new NotFoundException('Variant not found');
      if (variant.price) price = variant.price;
      availableStock = variant.stock;
    }

    if (availableStock < dto.quantity) {
      throw new BadRequestException('Not enough stock available');
    }

    if (!sessionId && !userId)
      throw new BadRequestException('Session ID is required');

    // Find or create cart
    let cart = await this.prisma.cart.findFirst({
      where: {
        status: 'active',
        OR: [
          ...(userId ? [{ user_id: userId }] : []),
          ...(sessionId ? [{ session_id: sessionId }] : []),
        ],
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          user_id: userId,
          session_id: sessionId,
        },
      });
    } else if (userId && !cart.user_id) {
      // update cart with user id
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { user_id: userId },
      });
    }

    // Find existing item
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cart_id: cart.id,
        product_id: dto.productId,
        variant_id: dto.variantId || null,
      },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + dto.quantity;
      if (availableStock < newQty) {
        throw new BadRequestException(
          'Not enough stock available for this quantity',
        );
      }
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cart_id: cart.id,
          product_id: dto.productId,
          variant_id: dto.variantId || null,
          quantity: dto.quantity,
          price: price,
        },
      });
    }

    return this.getCart(sessionId, authHeader);
  }

  async updateCartItem(itemId: string, quantity: number) {
    if (quantity <= 0) return this.removeCartItem(itemId);

    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true, variant: true },
    });
    if (!item) throw new NotFoundException('Item not found');

    const availableStock = item.variant
      ? item.variant.stock
      : item.product.stock_quantity;
    if (availableStock < quantity) {
      throw new BadRequestException('Not enough stock available');
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    return { success: true };
  }

  async removeCartItem(itemId: string) {
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return { success: true };
  }
}
