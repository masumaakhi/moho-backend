import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CreateAdminDto, UpdateAdminDto, UpdateAdminStatusDto } from './dto/admin-user.dto';
import { successResponse } from '../../common/responses/api-response';
import { PrismaService } from '../../database/prisma.service';

@Controller('admin/admins')
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private prisma: PrismaService,
  ) {}

  private async checkSuperAdmin(req: any) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: req.user.sub },
      include: { role: true },
    });
    if (admin?.role?.name !== 'Super Admin') {
      throw new ForbiddenException('Only Super Admin can perform this action');
    }
  }

  @Get()
  async findAll(@Query() query: any, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.adminUsersService.findAll(query);
    return successResponse('Admins fetched successfully', data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.adminUsersService.findOne(id);
    return successResponse('Admin fetched successfully', data);
  }

  @Post()
  async create(@Body() dto: CreateAdminDto, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.adminUsersService.create(req.user.sub, dto);
    return successResponse('Admin created successfully', data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAdminDto, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.adminUsersService.update(id, req.user.sub, dto);
    return successResponse('Admin updated successfully', data);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateAdminStatusDto, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.adminUsersService.updateStatus(id, req.user.sub, dto);
    return successResponse('Admin status updated successfully', data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    await this.checkSuperAdmin(req);
    const data = await this.adminUsersService.delete(id, req.user.sub);
    return successResponse(data.message);
  }
}
