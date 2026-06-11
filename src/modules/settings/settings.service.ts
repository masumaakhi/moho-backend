import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { encrypt, decrypt, maskValue } from '../../common/utils/crypto.util';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  UpdateGeneralSettingsDto,
  UpdateDeliverySettingsDto,
  UpdateEmailSettingsDto,
  UpdateNotificationSettingsDto,
  UpdateReportReceiverDto,
} from './dto/settings.dto';

@Injectable()
export class SettingsService {
  private encryptionKey: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private activityLogs: ActivityLogsService,
  ) {
    this.encryptionKey =
      this.configService.get<string>('SETTINGS_ENCRYPTION_KEY') ||
      'default_secret_key';
  }

  async getAllSettings() {
    const settings = await this.prisma.setting.findMany();
    const receivers = await this.prisma.reportReceiver.findMany();

    const groupedSettings: any = {
      general: {},
      delivery: {},
      email: {},
      notification: {},
      receivers: receivers,
    };

    settings.forEach((s) => {
      let value = s.value;

      // Mask sensitive values
      if (
        [
          'pathao_api_key',
          'pathao_secret',
          'pathao_password',
          'smtp_pass',
        ].includes(s.key)
      ) {
        value = maskValue(decrypt(value, this.encryptionKey));
      }

      if (!groupedSettings[s.group]) {
        groupedSettings[s.group] = {};
      }
      groupedSettings[s.group][s.key] = value;
    });

    return groupedSettings;
  }

  async updateSettings(
    group: string,
    data: any,
    adminUserId: string,
    isSuperAdminCheck?: boolean,
  ) {
    // Fetch admin user to check role
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      include: { role: true },
    });

    const isSuperAdmin = admin?.role?.name === 'Super Admin';

    // Check Super Admin for sensitive groups
    if (['delivery', 'email'].includes(group) && !isSuperAdmin) {
      throw new ForbiddenException(
        'Only Super Admin can update sensitive settings',
      );
    }

    const updates: any[] = [];
    const sensitiveKeys = [
      'pathao_api_key',
      'pathao_secret',
      'pathao_password',
      'smtp_pass',
    ];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;

      let finalValue = String(value);
      if (sensitiveKeys.includes(key)) {
        // If the value is masked (starts with **), don't update it unless it's a new value
        if (finalValue.includes('****')) continue;
        finalValue = encrypt(finalValue, this.encryptionKey);
      }

      updates.push(
        this.prisma.setting.upsert({
          where: { key },
          update: { value: finalValue, group },
          create: { key, value: finalValue, group },
        }),
      );
    }

    await Promise.all(updates);

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'UPDATE_SETTINGS',
      entity_type: 'settings',
      details: { group, fields: Object.keys(data) },
    });

    return { message: `${group} settings updated successfully` };
  }

  async updateReportReceivers(
    receivers: UpdateReportReceiverDto[],
    adminUserId: string,
  ) {
    // For simplicity, we'll replace the existing receivers or update them
    // Here we'll just handle one by one or a batch
    for (const receiver of receivers) {
      await this.prisma.reportReceiver.upsert({
        where: { email: receiver.email },
        update: {
          name: receiver.name,
          is_active: receiver.is_active,
        },
        create: {
          name: receiver.name,
          email: receiver.email,
          is_active: receiver.is_active ?? true,
        },
      });
    }

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'UPDATE_REPORT_RECEIVERS',
      entity_type: 'report_receivers',
      details: { count: receivers.length },
    });

    return { message: 'Report receivers updated successfully' };
  }

  async uploadLogo(logoUrl: string, adminUserId: string) {
    await this.prisma.setting.upsert({
      where: { key: 'business_logo' },
      update: { value: logoUrl, group: 'general' },
      create: { key: 'business_logo', value: logoUrl, group: 'general' },
    });

    await this.activityLogs.create({
      user_id: adminUserId,
      action: 'UPDATE_LOGO',
      entity_type: 'settings',
      details: { logoUrl },
    });

    return { message: 'Logo updated successfully', logoUrl };
  }
}
