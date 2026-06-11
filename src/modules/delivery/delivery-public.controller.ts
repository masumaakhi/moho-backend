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
    const signature = Object.entries(req.headers).find(
      ([key]) => key.toLowerCase() === 'x-pathao-signature',
    )?.[1];

    if (signature) {
      res.setHeader('X-Pathao-Merchant-Webhook-Integration-Secret', signature);
    }

    if (data?.event === 'webhook_integration') {
      return res
        .status(200)
        .send({ message: 'Webhook integrated successfully' });
    }

    const result = await this.deliveryService.handleWebhook(data);
    return res.status(200).json(result);
  }
}
