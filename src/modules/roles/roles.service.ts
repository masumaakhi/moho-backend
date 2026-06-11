import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
  ) {}

  async findAll() {
    return this.prisma.role.findMany({
      where: { deleted_at: null },
      include: {
        role_permissions: {
          include: { permission: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async findPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        role_permissions: {
          include: { permission: true },
        },
      },
    });
    if (!role || role.deleted_at) throw new NotFoundException('Role not found');
    return role;
  }

  async create(adminUserId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Role name already exists');

    const role = await this.prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      if (dto.permission_ids.length > 0) {
        await tx.rolePermission.createMany({
          data: dto.permission_ids.map((p_id) => ({
            role_id: newRole.id,
            permission_id: p_id,
          })),
        });
      }

      return newRole;
    });

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'CREATE_ROLE',
      entity_type: 'roles',
      entity_id: role.id,
      details: { name: role.name },
    });

    return this.findOne(role.id);
  }

  async update(id: string, adminUserId: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id);
    if (role.is_system)
      throw new ForbiddenException('Cannot modify system roles');

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      if (dto.permission_ids) {
        // Remove old permissions
        await tx.rolePermission.deleteMany({
          where: { role_id: id },
        });

        // Add new permissions
        if (dto.permission_ids.length > 0) {
          await tx.rolePermission.createMany({
            data: dto.permission_ids.map((p_id) => ({
              role_id: id,
              permission_id: p_id,
            })),
          });
        }
      }

      return updated;
    });

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'UPDATE_ROLE',
      entity_type: 'roles',
      entity_id: id,
      details: { name: updatedRole.name },
    });

    return this.findOne(id);
  }

  async delete(id: string, adminUserId: string) {
    const role = await this.findOne(id);
    if (role.is_system)
      throw new ForbiddenException('Cannot delete system roles');

    // Check if any admin is using this role
    const admins = await this.prisma.adminUser.count({
      where: { role_id: id, deleted_at: null },
    });
    if (admins > 0)
      throw new ForbiddenException('Cannot delete role assigned to admins');

    await this.prisma.role.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'DELETE_ROLE',
      entity_type: 'roles',
      entity_id: id,
    });

    return { message: 'Role deleted successfully' };
  }
}
