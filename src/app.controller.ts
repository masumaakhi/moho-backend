import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    return {
      success: true,
      message: 'Mohul Backend API is running',
    };
  }

  @Get('health')
  health() {
    return {
      success: true,
      message: 'Mohul Backend health check OK',
    };
  }
}
