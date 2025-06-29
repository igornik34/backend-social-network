import {Injectable} from '@nestjs/common';
import {PrismaService} from "../prisma/prisma.service";

@Injectable()
export class MetricsService {
    constructor(private prisma: PrismaService) { }

    async getMetrics() {
        return await this.prisma.$metrics.prometheus()
    }
}
