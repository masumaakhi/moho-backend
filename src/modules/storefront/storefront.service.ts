import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StorefrontService {
  constructor(private prisma: PrismaService) {}

  async getHome() {
    const heroSections = await this.prisma.homepageSection.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });
    
    const trendingProducts = await this.prisma.product.findMany({
      where: { status: 'active', is_trending: true, deleted_at: null },
      take: 8,
      include: { images: true, category: true, reviews: { where: { status: 'approved' } } }
    });
    
    const featuredProducts = await this.prisma.product.findMany({
      where: { status: 'active', is_featured: true, deleted_at: null },
      take: 8,
      include: { images: true, category: true, reviews: { where: { status: 'approved' } } }
    });
    
    const reviews = await this.prisma.productReview.findMany({
      where: { status: 'approved' },
      take: 5,
      include: { product: true, customer: true }
    });
    
    return {
      heroSections,
      trendingProducts,
      featuredProducts,
      reviews,
    };
  }

  async getProducts(query: any) {
    const { search, category, minPrice, maxPrice, sort, page = 1, limit = 12 } = query;
    const where: Prisma.ProductWhereInput = { status: 'active', deleted_at: null };
    
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    
    if (category) {
      where.category = { slug: category };
    }
    
    if (minPrice) {
      where.new_price = { ...((where.new_price as any) || {}), gte: parseFloat(minPrice) };
    }
    
    if (maxPrice) {
      where.new_price = { ...((where.new_price as any) || {}), lte: parseFloat(maxPrice) };
    }
    
    let orderBy: Prisma.ProductOrderByWithRelationInput = { created_at: 'desc' };
    if (sort === 'price_asc') orderBy = { new_price: 'asc' };
    else if (sort === 'price_desc') orderBy = { new_price: 'desc' };
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: Number(limit),
        include: { images: true, category: true, reviews: { where: { status: 'approved' } } }
      }),
      this.prisma.product.count({ where })
    ]);
    
    return {
      data: products,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    };
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug, status: 'active', deleted_at: null },
      include: {
        images: true,
        category: true,
        variants: true,
        faqs: true,
        reviews: {
          where: { status: 'approved' }
        }
      }
    });
    
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    
    return product;
  }

  async getTrendingProducts() {
    return this.prisma.product.findMany({
      where: { status: 'active', is_trending: true, deleted_at: null },
      take: 10,
      include: { images: true, category: true }
    });
  }

  async getFeaturedProducts() {
    return this.prisma.product.findMany({
      where: { status: 'active', is_featured: true, deleted_at: null },
      take: 10,
      include: { images: true, category: true }
    });
  }

  async getRelatedProducts(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException();
    
    return this.prisma.product.findMany({
      where: {
        status: 'active',
        deleted_at: null,
        category_id: product.category_id,
        id: { not: id }
      },
      take: 4,
      include: { images: true, category: true }
    });
  }

  async subscribeNewsletter(email: string) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      return { success: true, message: 'Already subscribed', existing: true };
    }
    await this.prisma.newsletterSubscriber.create({
      data: { email }
    });
    return { success: true, message: 'Subscribed successfully', existing: false };
  }

  async submitContact(data: any) {
    const message = await this.prisma.contactMessage.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: data.message
      }
    });
    return { success: true, message: 'Message sent successfully' };
  }
}
