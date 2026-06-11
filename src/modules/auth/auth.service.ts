import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { successResponse } from '../../common/responses/api-response';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CheckAccountDto } from './dto/check-account.dto';
import { AdminLoginDto } from './dto/admin-login.dto';

function isEmail(value: string) {
  return value.includes('@');
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, '').trim();
}

function sha256Like(input: string) {
  // bcrypt is used for stored hashes; for request tokens we store bcrypt too.
  // This function name is legacy; keeping deterministic helper out for later if needed.
  return input;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private async signAccessToken(payload: {
    sub: string;
    scope: 'customer' | 'admin';
  }) {
    const key =
      payload.scope === 'admin'
        ? 'ADMIN_JWT_ACCESS_EXPIRES_IN'
        : 'JWT_ACCESS_EXPIRES_IN';
    const expiresIn =
      this.config.get<string>(key) ||
      (payload.scope === 'admin' ? '30d' : '15m');
    const secret =
      this.config.get<string>('JWT_ACCESS_SECRET') ?? 'access_secret';
    return this.jwt.signAsync(payload, { secret, expiresIn: expiresIn as any });
  }

  private async signRefreshToken(payload: {
    sub: string;
    scope: 'customer' | 'admin';
  }) {
    const key =
      payload.scope === 'admin'
        ? 'ADMIN_JWT_REFRESH_EXPIRES_IN'
        : 'JWT_REFRESH_EXPIRES_IN';
    const expiresIn =
      this.config.get<string>(key) ||
      (payload.scope === 'admin' ? '365d' : '7d');
    const secret =
      this.config.get<string>('JWT_REFRESH_SECRET') ?? 'refresh_secret';
    return this.jwt.signAsync(payload, { secret, expiresIn: expiresIn as any });
  }

  private async saveRefreshToken(args: {
    rawToken: string;
    scope: 'customer' | 'admin';
    userId?: string;
    adminUserId?: string;
  }) {
    const key =
      args.scope === 'admin'
        ? 'ADMIN_JWT_REFRESH_EXPIRES_IN'
        : 'JWT_REFRESH_EXPIRES_IN';
    const expiresIn =
      this.config.get<string>(key) || (args.scope === 'admin' ? '365d' : '7d');
    const expiresAt = this.parseExpiresToDate(expiresIn);
    const tokenHash = await bcrypt.hash(args.rawToken, 10);

    await this.prisma.refreshToken.create({
      data: {
        token_hash: tokenHash,
        scope: args.scope === 'customer' ? 'customer' : 'admin',
        user_id: args.userId,
        admin_user_id: args.adminUserId,
        expires_at: expiresAt,
      },
    });
  }

  private parseExpiresToDate(expiresIn: string) {
    const now = new Date();
    const m = expiresIn.match(/^(\d+)([smhd])$/);
    if (!m) return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const value = Number(m[1]);
    const unit = m[2];
    const mult =
      unit === 's'
        ? 1000
        : unit === 'm'
          ? 60 * 1000
          : unit === 'h'
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;
    return new Date(now.getTime() + value * mult);
  }

  async login(dto: LoginDto) {
    const contact = dto.contact.trim();
    const user = await this.prisma.user.findFirst({
      where: isEmail(contact)
        ? { email: contact.toLowerCase(), deleted_at: null }
        : { phone: normalizePhone(contact), deleted_at: null },
    });

    if (!user) throw new UnauthorizedException('Account not found');

    if (user.status !== 'active')
      throw new ForbiddenException('Account blocked/inactive');

    if (!user.is_password_set || !user.password_hash) {
      throw new ForbiddenException('Password not set');
    }

    const ok = await bcrypt.compare(dto.password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Wrong password');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const access_token = await this.signAccessToken({
      sub: user.id,
      scope: 'customer',
    });
    const refresh_token = await this.signRefreshToken({
      sub: user.id,
      scope: 'customer',
    });
    await this.saveRefreshToken({
      rawToken: refresh_token,
      scope: 'customer',
      userId: user.id,
    });

    return successResponse('Login successful', {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        account_type: user.account_type,
        is_password_set: user.is_password_set,
      },
    });
  }

  async signup(dto: SignupDto) {
    const contact = dto.contact.trim();
    const email = isEmail(contact)
      ? contact.toLowerCase()
      : dto.email?.toLowerCase();
    const phone = !isEmail(contact)
      ? normalizePhone(contact)
      : dto.phone
        ? normalizePhone(dto.phone)
        : undefined;

    if (!email && !phone)
      throw new BadRequestException('Phone or email required');

    const existing = await this.prisma.user.findFirst({
      where: {
        deleted_at: null,
        OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
      },
    });
    if (existing) throw new BadRequestException('Already registered');

    const password_hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        phone,
        password_hash,
        account_type: 'normal',
        is_password_set: true,
        status: 'active',
      },
    });

    await this.prisma.customer.create({
      data: {
        user_id: user.id,
        name: dto.name,
        email,
        phone,
        source_type: 'normal_signup',
      },
    });

    const access_token = await this.signAccessToken({
      sub: user.id,
      scope: 'customer',
    });
    const refresh_token = await this.signRefreshToken({
      sub: user.id,
      scope: 'customer',
    });
    await this.saveRefreshToken({
      rawToken: refresh_token,
      scope: 'customer',
      userId: user.id,
    });

    return successResponse('Signup successful', {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        account_type: user.account_type,
        is_password_set: user.is_password_set,
      },
    });
  }

  async googleLogin(token: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');

    let payload: any;
    try {
      // Try verifying as ID Token first (default)
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (e) {
      // If it fails, treat as Access Token and fetch from Google UserInfo API
      try {
        const response = await fetch(
          `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`,
        );
        if (!response.ok)
          throw new Error('Failed to fetch user info from Google');
        payload = await response.json();
      } catch (err) {
        throw new UnauthorizedException('Invalid Google token');
      }
    }

    if (!payload || !payload.email)
      throw new UnauthorizedException('Invalid Google token');

    const email = payload.email.toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: { email, deleted_at: null },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: payload.name,
          email,
          google_id: payload.sub,
          avatar_url: payload.picture,
          account_type: 'google',
          is_password_set: false,
          status: 'active',
        },
      });

      await this.prisma.customer.create({
        data: {
          user_id: user.id,
          name: payload.name,
          email,
          source_type: 'google_signup',
        },
      });
    } else if (!user.google_id) {
      // link google id to existing account
      await this.prisma.user.update({
        where: { id: user.id },
        data: { google_id: payload.sub, avatar_url: payload.picture },
      });
    }

    const access_token = await this.signAccessToken({
      sub: user.id,
      scope: 'customer',
    });
    const refresh_token = await this.signRefreshToken({
      sub: user.id,
      scope: 'customer',
    });
    await this.saveRefreshToken({
      rawToken: refresh_token,
      scope: 'customer',
      userId: user.id,
    });

    return successResponse('Google login successful', {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        account_type: user.account_type,
        is_password_set: user.is_password_set,
      },
    });
  }

  async adminLogin(dto: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findFirst({
      where: { email: dto.email.toLowerCase(), deleted_at: null },
      include: {
        role: {
          include: { role_permissions: { include: { permission: true } } },
        },
      },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');
    if (admin.status !== 'active')
      throw new ForbiddenException('Admin disabled');

    const ok = await bcrypt.compare(dto.password, admin.password_hash);
    if (!ok) throw new UnauthorizedException('Wrong password');

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { last_login_at: new Date() },
    });

    const access_token = await this.signAccessToken({
      sub: admin.id,
      scope: 'admin',
    });
    const refresh_token = await this.signRefreshToken({
      sub: admin.id,
      scope: 'admin',
    });
    await this.saveRefreshToken({
      rawToken: refresh_token,
      scope: 'admin',
      adminUserId: admin.id,
    });

    const permissions =
      admin.role?.role_permissions?.map((rp) => rp.permission.code) ?? [];

    return successResponse('Admin login successful', {
      access_token,
      refresh_token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role?.name ?? null,
        permissions,
      },
    });
  }

  async me(userId: string, scope: 'customer' | 'admin') {
    if (scope === 'admin') {
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: { role_permissions: { include: { permission: true } } },
          },
        },
      });
      if (!admin || admin.deleted_at)
        throw new UnauthorizedException('Unauthorized');
      return successResponse('OK', {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role?.name ?? null,
        permissions:
          admin.role?.role_permissions?.map((rp) => rp.permission.code) ?? [],
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });
    if (!user || user.deleted_at)
      throw new UnauthorizedException('Unauthorized');
    const pendingOrders = await this.prisma.order.aggregate({
      where: { user_id: userId, order_status: 'pending' },
      _sum: { total_amount: true },
    });

    return successResponse('OK', {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      account_type: user.account_type,
      is_password_set: user.is_password_set,
      customer: user.customer,
      pending_amount: Number(pendingOrders._sum.total_amount || 0),
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deleted_at)
      throw new UnauthorizedException('Unauthorized');
    if (!user.password_hash) throw new BadRequestException('Password not set');

    const ok = await bcrypt.compare(dto.current_password, user.password_hash);
    if (!ok) throw new UnauthorizedException('Wrong password');

    const password_hash = await bcrypt.hash(dto.new_password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash, is_password_set: true },
    });

    return successResponse('Password changed successfully');
  }

  async logout(userId: string, scope: 'customer' | 'admin') {
    // best-effort revoke all refresh tokens for that actor
    if (scope === 'admin') {
      await this.prisma.refreshToken.updateMany({
        where: { admin_user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
    return successResponse('Logged out');
  }

  async checkAccount(dto: CheckAccountDto) {
    const contact = dto.contact.trim();
    const user = await this.prisma.user.findFirst({
      where: isEmail(contact)
        ? { email: contact.toLowerCase(), deleted_at: null }
        : { phone: normalizePhone(contact), deleted_at: null },
    });

    if (!user) {
      return successResponse('OK', {
        exists: false,
      });
    }

    return successResponse('OK', {
      exists: true,
      user_id: user.id,
      account_type: user.account_type,
      is_password_set: user.is_password_set,
    });
  }

  async passwordStatus(contact?: string, userId?: string) {
    let user;
    if (userId) {
      user = await this.prisma.user.findUnique({ where: { id: userId } });
    } else if (contact) {
      user = await this.prisma.user.findFirst({
        where: isEmail(contact)
          ? { email: contact.toLowerCase(), deleted_at: null }
          : { phone: normalizePhone(contact), deleted_at: null },
      });
    }

    if (!user) throw new BadRequestException('Account not found');

    return successResponse('OK', {
      user_id: user.id,
      account_type: user.account_type,
      is_password_set: user.is_password_set,
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const contact = dto.contact.trim();
    const user = await this.prisma.user.findFirst({
      where: isEmail(contact)
        ? { email: contact.toLowerCase(), deleted_at: null }
        : { phone: normalizePhone(contact), deleted_at: null },
    });
    if (!user) throw new BadRequestException('Account not found');

    const rawToken =
      globalThis.crypto?.randomUUID?.() ?? require('crypto').randomUUID();
    const tokenHash = await bcrypt.hash(sha256Like(rawToken), 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: { user_id: user.id, token_hash: tokenHash, expires_at: expiresAt },
    });

    // For now: return token in response (dev). In production, send OTP/email/SMS via queue.
    return successResponse('Reset token generated', {
      token: rawToken,
      expires_at: expiresAt.toISOString(),
      is_guest_auto:
        user.account_type === 'guest_auto' && !user.is_password_set,
    });
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.findValidPasswordReset(dto.token);
    const password_hash = await bcrypt.hash(dto.new_password, 10);
    await this.prisma.user.update({
      where: { id: record.user_id },
      data: { password_hash, is_password_set: true },
    });
    await this.prisma.passwordReset.update({
      where: { id: record.id },
      data: { used_at: new Date() },
    });
    return successResponse('Password reset successfully');
  }

  async setPassword(dto: SetPasswordDto) {
    // same as reset-password, but intended for guest_auto completion flow
    const record = await this.findValidPasswordReset(dto.token);
    const user = await this.prisma.user.findUnique({
      where: { id: record.user_id },
      include: { customer: true },
    });
    if (!user) throw new BadRequestException('Account not found');

    const password_hash = await bcrypt.hash(dto.new_password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password_hash, is_password_set: true },
    });
    await this.prisma.passwordReset.update({
      where: { id: record.id },
      data: { used_at: new Date() },
    });
    if (user.customer) {
      await this.prisma.customer.update({
        where: { id: user.customer.id },
        data: { account_completed_at: new Date() },
      });
    }

    return successResponse('Password set successfully');
  }

  async setGuestPassword(userId: string, new_password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });
    if (!user) throw new BadRequestException('Account not found');
    if (user.is_password_set)
      throw new BadRequestException('Password is already set for this account');
    if (user.account_type !== 'guest_auto')
      throw new BadRequestException('Not a guest auto-created account');

    const password_hash = await bcrypt.hash(new_password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password_hash, is_password_set: true },
    });

    if (user.customer) {
      await this.prisma.customer.update({
        where: { id: user.customer.id },
        data: { account_completed_at: new Date() },
      });
    }

    const access_token = await this.signAccessToken({
      sub: user.id,
      scope: 'customer',
    });
    const refresh_token = await this.signRefreshToken({
      sub: user.id,
      scope: 'customer',
    });
    await this.saveRefreshToken({
      rawToken: refresh_token,
      scope: 'customer',
      userId: user.id,
    });

    return successResponse('Password set successfully', {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        account_type: user.account_type,
        is_password_set: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { address, ...userData } = dto;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userData,
        });
      }

      if (address !== undefined) {
        // Find customer and update
        const customer = await tx.customer.findFirst({
          where: { user_id: userId },
        });
        if (customer) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { address },
          });
        }
      }
    });

    const user = await this.me(userId, 'customer');
    return successResponse('Profile updated successfully', user.data);
  }

  private async findValidPasswordReset(rawToken: string) {
    const records = await this.prisma.passwordReset.findMany({
      where: { used_at: null, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    for (const r of records) {
      const ok = await bcrypt.compare(sha256Like(rawToken), r.token_hash);
      if (ok) return r;
    }
    throw new BadRequestException('Invalid or expired token');
  }
}
