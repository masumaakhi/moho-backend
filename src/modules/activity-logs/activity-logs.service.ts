import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export class CreateActivityLogDto {
  actor_type?: string; // admin, customer, system
  user_id?: string | null; // actor_id
  module_name?: string;
  action: string; // create, update, delete, login, etc.
  entity_type?: string;
  entity_id?: string;
  description?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
}

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateActivityLogDto) {
    return this.prisma.activityLog.create({
      data: {
        actor_type: data.actor_type || 'system',
        user_id: data.user_id,
        module_name: data.module_name,
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        description: data.description,
        details: data.details || {},
        ip_address: data.ip_address,
        user_agent: data.user_agent,
      },
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    module?: string;
    actor_type?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.module) {
      where.module_name = query.module;
    }

    if (query.actor_type) {
      where.actor_type = query.actor_type;
    }

    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { entity_type: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.start_date || query.end_date) {
      where.created_at = {};
      if (query.start_date) where.created_at.gte = new Date(query.start_date);
      if (query.end_date) where.created_at.lte = new Date(query.end_date);
    }

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    return this.prisma.activityLog.findUnique({
      where: { id },
    });
  }

  async exportLogs(res: Response, query: any) {
    const logs = await this.findAll({ ...query, limit: 2000 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Activity Logs');

    worksheet.columns = [
      { header: 'Date', key: 'created_at', width: 20 },
      { header: 'Actor', key: 'actor_type', width: 10 },
      { header: 'Module', key: 'module_name', width: 15 },
      { header: 'Action', key: 'action', width: 15 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'IP Address', key: 'ip_address', width: 15 },
    ];

    logs.items.forEach((log) => {
      worksheet.addRow({
        created_at: log.created_at.toISOString(),
        actor_type: log.actor_type,
        module_name: log.module_name,
        action: log.action,
        description: log.description,
        ip_address: log.ip_address,
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=activity_logs.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
