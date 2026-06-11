import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import * as express from 'express';

@Controller('delivery')
export class PublicDeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('pathao/webhook')
  async handleWebhook(
    @Req() req: express.Request,
    @Res() res: express.Response,
    @Body() data: any,
  ) {
    // Pathao sends X-PATHAO-Signature header — echo it back as X-Pathao-Merchant-Webhook-Integration-Secret
    const signature = Object.entries(req.headers).find(
      ([key]) => key.toLowerCase() === 'x-pathao-signature',
    )?.[1];

    if (data?.event === 'webhook_integration') {
      // Pathao requires: status 202 + header X-Pathao-Merchant-Webhook-Integration-Secret = exact secret value
      return res
        .status(202)
        .set('X-Pathao-Merchant-Webhook-Integration-Secret', signature as string ?? '')
        .send();
    }

    const result = await this.deliveryService.handleWebhook(data);
    return res.status(200).json(result);
  }
}
