import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateAdminDto, UpdateAdminDto, UpdateAdminStatusDto } from './dto/admin-user.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  async findAll(query: any) {
    const { search, role_id, status } = query;
    
    return this.prisma.adminUser.findMany({
      where: {
        deleted_at: null,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(role_id && { role_id }),
        ...(status && { status }),
      },
      include: {
        role: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!admin || admin.deleted_at) throw new NotFoundException('Admin not found');
    return admin;
  }

  async create(adminUserId: string, dto: CreateAdminDto) {
    const existing = await this.prisma.adminUser.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already in use');

    const password_hash = await bcrypt.hash(dto.password, 10);

    const admin = await this.prisma.adminUser.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        password_hash,
        role_id: dto.role_id,
        status: 'active',
      },
    });

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'CREATE_ADMIN',
      entity_type: 'admin_users',
      entity_id: admin.id,
      details: { name: admin.name, email: admin.email },
    });

    return admin;
  }

  async update(id: string, adminUserId: string, dto: UpdateAdminDto) {
    const admin = await this.findOne(id);

    const data: any = { ...dto };
    if (dto.password) {
      data.password_hash = await bcrypt.hash(dto.password, 10);
      delete data.password;
    }

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data,
    });

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'UPDATE_ADMIN',
      entity_type: 'admin_users',
      entity_id: id,
      details: { changes: Object.keys(dto) },
    });

    return updated;
  }

  async updateStatus(id: string, adminUserId: string, dto: UpdateAdminStatusDto) {
    await this.findOne(id);

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'UPDATE_ADMIN_STATUS',
      entity_type: 'admin_users',
      entity_id: id,
      details: { status: dto.status },
    });

    return updated;
  }

  async delete(id: string, adminUserId: string) {
    await this.findOne(id);

    await this.prisma.adminUser.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'DELETE_ADMIN',
      entity_type: 'admin_users',
      entity_id: id,
    });

    return { message: 'Admin deleted successfully' };
  }
}
