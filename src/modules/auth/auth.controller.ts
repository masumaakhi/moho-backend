import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CheckAccountDto } from './dto/check-account.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CustomerAuthGuard } from './guards/customer-auth.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';

type AuthedReq = Request & {
  user?: { sub: string; scope: 'customer' | 'admin' };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Post('google')
  google(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto.token);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Post('set-password')
  setPassword(@Body() dto: SetPasswordDto) {
    return this.auth.setPassword(dto);
  }

  @Post('set-guest-password')
  setGuestPassword(@Body() dto: { userId: string; password: string }) {
    return this.auth.setGuestPassword(dto.userId, dto.password);
  }

  @Post('check-account')
  checkAccount(@Body() dto: CheckAccountDto) {
    return this.auth.checkAccount(dto);
  }

  @Get('password-status')
  passwordStatus(@Query('contact') contact?: string, @Req() req?: AuthedReq) {
    const userId = req?.user?.scope === 'customer' ? req.user.sub : undefined;
    return this.auth.passwordStatus(contact, userId);
  }

  @Get('me')
  @UseGuards(CustomerAuthGuard)
  me(@Req() req: AuthedReq) {
    return this.auth.me(req.user!.sub, 'customer');
  }

  @Patch('profile')
  @UseGuards(CustomerAuthGuard)
  updateProfile(@Req() req: AuthedReq, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(req.user!.sub, dto);
  }

  @Patch('change-password')
  @UseGuards(CustomerAuthGuard)
  changePassword(@Req() req: AuthedReq, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user!.sub, dto);
  }

  @Post('logout')
  @UseGuards(CustomerAuthGuard)
  logout(@Req() req: AuthedReq) {
    return this.auth.logout(req.user!.sub, 'customer');
  }

  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto);
  }

  @Get('admin/me')
  @UseGuards(AdminAuthGuard)
  adminMe(@Req() req: AuthedReq) {
    return this.auth.me(req.user!.sub, 'admin');
  }

  @Post('admin/logout')
  @UseGuards(AdminAuthGuard)
  adminLogout(@Req() req: AuthedReq) {
    return this.auth.logout(req.user!.sub, 'admin');
  }
}
