import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { successResponse } from '../../common/responses/api-response';
import { PrismaService } from '../../database/prisma.service';

@Controller('admin/roles')
@UseGuards(AdminAuthGuard)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private prisma: PrismaService,
  ) {}

  private async checkSuperAdmin(req: any) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: req.user.sub },
      include: { role: true },
    });
    if (admin?.role?.name !== 'Super Admin') {
      throw new ForbiddenException('Only Super Admin can manage roles');
    }
  }

  @Get()
  async findAll(@Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.rolesService.findAll();
    return successResponse('Roles fetched successfully', data);
  }

  @Get('permissions')
  async findPermissions(@Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.rolesService.findPermissions();
    return successResponse('Permissions fetched successfully', data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.rolesService.findOne(id);
    return successResponse('Role fetched successfully', data);
  }

  @Post()
  async create(@Body() dto: CreateRoleDto, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.rolesService.create(req.user.sub, dto);
    return successResponse('Role created successfully', data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.rolesService.update(id, req.user.sub, dto);
    return successResponse('Role updated successfully', data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.rolesService.delete(id, req.user.sub);
    return successResponse(data.message);
  }
}
