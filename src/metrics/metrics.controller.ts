import {Controller, Get, Query, Res} from '@nestjs/common';
import { MetricsService } from './metrics.service';
import {Response} from "express";

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.header('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics);
  }
}
