import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { successResponse } from '../../common/responses/api-response';

@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getPublicSettings() {
    const data = await this.settingsService.getAllSettings();
    // Only return public information
    return successResponse('Settings fetched successfully', {
      business_name: data.general.business_name,
      business_logo: data.general.business_logo,
      business_address: data.general.business_address,
      business_phone: data.general.business_phone,
      delivery_charge: {
        inside: data.delivery.delivery_charge_inside,
        outside: data.delivery.delivery_charge_outside,
        default: data.delivery.delivery_charge_default,
      },
    });
  }
}
