import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto, UpdateProductDto, CreateCategoryDto } from './dto/admin-product.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class AdminProductsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activityLogs: ActivityLogsService
  ) {}

  async getProducts(query: any) {
    const { page = 1, limit = 10, search, category, status, stock } = query;
    const skip = (page - 1) * limit;

    const where: any = { deleted_at: null };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (category) {
      where.category_id = category;
    }
    if (status) {
      where.status = status;
    }
    if (stock === 'in_stock') {
      where.stock_quantity = { gt: 0 };
    } else if (stock === 'out_of_stock') {
      where.stock_quantity = { lte: 0 };
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, images: true },
        skip: Number(skip),
        take: Number(limit),
        orderBy: { created_at: 'desc' }
      }),
      this.prisma.product.count({ where })
    ]);

    return {
      items,
      meta: {
        total,
        page: Number(page),
        last_page: Math.ceil(total / limit)
      }
    };
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id, deleted_at: null },
      include: {
        category: true,
        images: true,
        variants: true,
        faqs: true
      }
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async createProduct(adminUserId: string, dto: CreateProductDto) {
    // 1. Category check
    const categoryExists = await this.prisma.category.findUnique({ where: { id: dto.category_id } });
    if (!categoryExists) {
      throw new BadRequestException('Category required or does not exist');
    }

    // 2. Slug generation
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        sku: dto.sku,
        category_id: dto.category_id,
        short_description: dto.short_description,
        description: dto.description,
        how_to_use: dto.how_to_use,
        base_price: dto.base_price,
        new_price: dto.new_price,
        stock_quantity: dto.stock_quantity || 0,
        status: dto.status || 'active',
        is_featured: dto.is_featured || false,
        is_trending: dto.is_trending || false,
        is_free_delivery: dto.is_free_delivery || false,
        images: {
          create: dto.images?.map((img, index) => ({
            image_url: img.image_url,
            alt_text: img.alt_text,
            sort_order: index
          })) || []
        },
        variants: {
          create: dto.variants?.map(v => ({
            name: v.name,
            value: v.value,
            sku: v.sku,
            price: v.price,
            stock: v.stock || 0
          })) || []
        },
        faqs: {
          create: dto.faqs?.map(f => ({
            question: f.question,
            answer: f.answer
          })) || []
        }
      }
    });

    // Create activity log
    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminUserId,
      module_name: 'product',
      action: 'create_product',
      entity_type: 'product',
      entity_id: product.id,
      description: `Product "${product.name}" created`,
      details: { name: product.name }
    });

    return product;
  }

  async updateProduct(id: string, adminUserId: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    if (dto.category_id) {
      const catExists = await this.prisma.category.findUnique({ where: { id: dto.category_id } });
      if (!catExists) throw new BadRequestException('Category not found');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        sku: dto.sku,
        category_id: dto.category_id,
        short_description: dto.short_description,
        description: dto.description,
        how_to_use: dto.how_to_use,
        base_price: dto.base_price,
        new_price: dto.new_price,
        stock_quantity: dto.stock_quantity,
        status: dto.status,
        is_featured: dto.is_featured,
        is_trending: dto.is_trending,
        is_free_delivery: dto.is_free_delivery,
      }
    });

    // Low stock notification
    if (updated.stock_quantity <= 5) {
      await this.notifications.create({
        type: 'low-stock',
        title: 'Low Stock Alert',
        message: `Product ${updated.name} is running low on stock (${updated.stock_quantity} left).`
      });
    }

    // Activity log
    await this.prisma.activityLog.create({
      data: {
        user_id: adminUserId,
        action: 'update_product',
        entity_type: 'product',
        entity_id: updated.id,
        details: { name: updated.name }
      }
    });

    return updated;
  }

  async deleteProduct(id: string, adminUserId: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deleted_at) {
      throw new NotFoundException('Product not found');
    }

    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: { deleted_at: new Date(), status: 'inactive' }
    });

    // Activity log
    await this.prisma.activityLog.create({
      data: {
        user_id: adminUserId,
        action: 'delete_product',
        entity_type: 'product',
        entity_id: id,
        details: { name: existing.name }
      }
    });

    return { success: true, message: 'Product deleted' };
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image_url: dto.image_url,
        status: dto.status || 'active'
      }
    });
  }

  async exportProducts(res: any, adminUserId: string) {
    const products = await this.prisma.product.findMany({
      where: { deleted_at: null },
      include: {
        category: true,
        variants: true,
      }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Products');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 40 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Base Price', key: 'base_price', width: 15 },
      { header: 'New Price', key: 'new_price', width: 15 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created At', key: 'created_at', width: 20 },
    ];

    products.forEach(p => {
      worksheet.addRow({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name || 'Uncategorized',
        base_price: Number(p.base_price),
        new_price: p.new_price ? Number(p.new_price) : null,
        stock: p.stock_quantity,
        status: p.status,
        created_at: p.created_at.toISOString(),
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');

    await workbook.xlsx.write(res);
    res.end();

    await this.activityLogs.create({
      actor_type: 'admin',
      user_id: adminUserId,
      module_name: 'product',
      action: 'export_products',
      entity_type: 'product',
      description: `Exported ${products.length} products`,
    });
  }
}
