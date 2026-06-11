import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { Response } from 'express';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogsService,
  ) {}

  async findAll(query: any) {
    const { search, limit = 10, page = 1 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { invoice_number: { contains: search, mode: 'insensitive' } },
        { order_id: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        take: Number(limit),
        skip,
        orderBy: { created_at: 'desc' },
        include: {
          order: {
            include: {
              user: {
                select: { name: true, email: true, phone: true },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      success: true,
      data: invoices,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            order_items: { include: { product: true } },
            user: true,
            customer: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    return { success: true, data: invoice };
  }

  async generate(orderId: string, adminId?: string) {
    // 1. Validate Order
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        order_items: { include: { product: true } },
        user: true,
        customer: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    // 2. Check existing invoice
    const existing = await this.prisma.invoice.findFirst({
      where: { order_id: orderId, deleted_at: null },
    });

    if (existing) {
      return {
        success: true,
        message: 'Invoice already exists',
        data: existing,
      };
    }

    // 3. Calculate Totals
    const subtotal = order.order_items.reduce(
      (sum, item) => sum + Number(item.unit_price) * item.quantity,
      0,
    );
    const totalAmount = Number(order.total_amount);
    const deliveryCharge = Number(order.delivery_charge || 0);
    const discount = Number(order.discount_amount || 0);

    // 4. Generate Invoice Number (e.g. INV-2026-0001)
    const count = await this.prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    // 5. Save Invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        order_id: orderId,
        invoice_number: invoiceNumber,
        subtotal,
        discount,
        delivery_charge: deliveryCharge,
        total_amount: totalAmount,
        status: 'generated',
        invoice_date: new Date(),
      },
    });

    // 6. Log Activity
    await this.activityLog.create({
      user_id: adminId,
      action: 'GENERATE_INVOICE',
      entity_type: 'invoice',
      entity_id: invoice.id,
      details: { orderId, invoiceNumber },
    });

    return {
      success: true,
      message: 'Invoice generated successfully',
      data: invoice,
    };
  }

  async exportPdf(id: string, res: Response, adminId?: string) {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id },
        include: {
          order: {
            include: {
              order_items: { include: { product: true } },
              user: true,
              customer: true,
            },
          },
        },
      });

      if (!invoice) throw new NotFoundException('Invoice not found');

      // Use require for pdfkit to ensure correct constructor access
      const PDFDoc = require('pdfkit');
      const doc = new PDFDoc({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=invoice-${invoice.invoice_number}.pdf`,
      );

      doc.pipe(res);

      // Header
      doc.fontSize(20).text('MOHUL ORGANIC', { align: 'left' });
      doc.fontSize(10).text('Premium Organic Products', { align: 'left' });
      doc.moveDown();

      doc
        .fontSize(12)
        .text(`Invoice Number: ${invoice.invoice_number}`, { align: 'right' });
      doc.text(`Date: ${invoice.invoice_date.toLocaleDateString()}`, {
        align: 'right',
      });
      doc.text(`Order ID: ${invoice.order_id}`, { align: 'right' });
      doc.moveDown();

      // Customer Info
      const customer = invoice.order.customer || invoice.order.user;
      doc.fontSize(14).text('Bill To:', { underline: true });
      doc.fontSize(10).text(`Name: ${customer?.name || 'N/A'}`);
      doc.text(`Phone: ${customer?.phone || 'N/A'}`);
      doc.text(`Email: ${customer?.email || 'N/A'}`);
      doc.text(`Address: ${invoice.order.shipping_address || 'N/A'}`);
      doc.moveDown();

      // Items Table
      doc.fontSize(12).text('Order Summary', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.fontSize(10).text('Product', 50, tableTop);
      doc.text('Qty', 300, tableTop);
      doc.text('Price', 350, tableTop);
      doc.text('Total', 450, tableTop);

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

      let currentY = tableTop + 25;
      invoice.order.order_items.forEach((item) => {
        doc.text(item.product.name, 50, currentY);
        doc.text(item.quantity.toString(), 300, currentY);
        // Use 'Tk' instead of '৳' as standard fonts don't support the Taka symbol
        doc.text(`Tk ${item.unit_price}`, 350, currentY);
        doc.text(
          `Tk ${Number(item.unit_price) * item.quantity}`,
          450,
          currentY,
        );
        currentY += 20;
      });

      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 10;

      // Totals
      doc.text('Subtotal:', 350, currentY);
      doc.text(`Tk ${invoice.subtotal}`, 450, currentY);
      currentY += 15;
      doc.text('Delivery Charge:', 350, currentY);
      doc.text(`Tk ${invoice.delivery_charge}`, 450, currentY);
      currentY += 15;
      doc.text('Discount:', 350, currentY);
      doc.text(`-Tk ${invoice.discount}`, 450, currentY);
      currentY += 15;
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Total Amount:', 350, currentY);
      doc.text(`Tk ${invoice.total_amount}`, 450, currentY);

      doc.moveDown(4);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Thank you for shopping with Mohul Organic!', {
          align: 'center',
        });

      doc.end();

      // Log Download
      await this.activityLog.create({
        user_id: adminId,
        action: 'DOWNLOAD_INVOICE_PDF',
        entity_type: 'invoice',
        entity_id: id,
        details: { invoiceNumber: invoice.invoice_number },
      });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      if (!res.headersSent) {
        res.status(500).send('Failed to generate PDF');
      }
    }
  }

  async exportBulkPdf(orderIds: string[], res: Response, adminId?: string) {
    try {
      const invoices: any[] = [];
      for (const orderId of orderIds) {
        let invoice = await this.prisma.invoice.findFirst({
          where: { order_id: orderId, deleted_at: null },
          include: {
            order: {
              include: {
                order_items: { include: { product: true } },
                user: true,
                customer: true,
              },
            },
          },
        });

        if (!invoice) {
          const genResult = await this.generate(orderId, adminId);
          if (genResult.success) {
            invoice = await this.prisma.invoice.findUnique({
              where: { id: genResult.data.id },
              include: {
                order: {
                  include: {
                    order_items: { include: { product: true } },
                    user: true,
                    customer: true,
                  },
                },
              },
            });
          }
        }

        if (invoice) {
          invoices.push(invoice);
        }
      }

      if (invoices.length === 0) {
        throw new NotFoundException(
          'No invoices found or generated for selected orders',
        );
      }

      const PDFDoc = require('pdfkit');
      const doc = new PDFDoc({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=bulk-invoices.pdf`,
      );

      doc.pipe(res);

      invoices.forEach((invoice, index) => {
        if (index > 0) {
          doc.addPage();
        }

        // Header
        doc.fontSize(20).text('MOHUL ORGANIC', { align: 'left' });
        doc.fontSize(10).text('Premium Organic Products', { align: 'left' });
        doc.moveDown();

        doc.fontSize(12).text(`Invoice Number: ${invoice.invoice_number}`, {
          align: 'right',
        });
        doc.text(`Date: ${invoice.invoice_date.toLocaleDateString()}`, {
          align: 'right',
        });
        doc.text(`Order ID: ${invoice.order_id}`, { align: 'right' });
        doc.moveDown();

        // Customer Info
        const customer = invoice.order.customer || invoice.order.user;
        doc.fontSize(14).text('Bill To:', { underline: true });
        doc.fontSize(10).text(`Name: ${customer?.name || 'N/A'}`);
        doc.text(`Phone: ${customer?.phone || 'N/A'}`);
        doc.text(`Email: ${customer?.email || 'N/A'}`);
        doc.text(`Address: ${invoice.order.shipping_address || 'N/A'}`);
        doc.moveDown();

        // Items Table
        doc.fontSize(12).text('Order Summary', { underline: true });
        doc.moveDown(0.5);

        const tableTop = doc.y;
        doc.fontSize(10).text('Product', 50, tableTop);
        doc.text('Qty', 300, tableTop);
        doc.text('Price', 350, tableTop);
        doc.text('Total', 450, tableTop);

        doc
          .moveTo(50, tableTop + 15)
          .lineTo(550, tableTop + 15)
          .stroke();

        let currentY = tableTop + 25;
        invoice.order.order_items.forEach((item) => {
          doc.text(item.product?.name || item.product_name, 50, currentY);
          doc.text(item.quantity.toString(), 300, currentY);
          doc.text(`Tk ${item.unit_price}`, 350, currentY);
          doc.text(
            `Tk ${Number(item.unit_price) * item.quantity}`,
            450,
            currentY,
          );
          currentY += 20;
        });

        doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
        currentY += 10;

        // Totals
        doc.text('Subtotal:', 350, currentY);
        doc.text(`Tk ${invoice.subtotal}`, 450, currentY);
        currentY += 15;
        doc.text('Delivery Charge:', 350, currentY);
        doc.text(`Tk ${invoice.delivery_charge}`, 450, currentY);
        currentY += 15;
        doc.text('Discount:', 350, currentY);
        doc.text(`-Tk ${invoice.discount}`, 450, currentY);
        currentY += 15;
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Total Amount:', 350, currentY);
        doc.text(`Tk ${invoice.total_amount}`, 450, currentY);

        doc.moveDown(4);
        doc
          .fontSize(10)
          .font('Helvetica')
          .text('Thank you for shopping with Mohul Organic!', {
            align: 'center',
          });
      });

      doc.end();

      await this.activityLog.create({
        user_id: adminId,
        action: 'DOWNLOAD_BULK_INVOICES_PDF',
        entity_type: 'invoice',
        details: { count: invoices.length, orderIds },
      });
    } catch (error) {
      console.error('Bulk PDF Generation Error:', error);
      if (!res.headersSent) {
        res.status(500).send('Failed to generate bulk PDF');
      }
    }
  }
}
