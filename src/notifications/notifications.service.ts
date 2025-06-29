import {Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from "../prisma/prisma.service";
import {NotificationType} from "@prisma/client";

@Injectable()
export class NotificationsService {
    constructor(
        private prisma: PrismaService,
    ) {}

    // Получение сообщений с пагинацией
    async getNotifications(
        userId: string,
        limit: number = 20,
        offset: number = 0,
    ) {
        const [notifications, totalCount] = await this.prisma.$transaction([
            this.prisma.notification.findMany({
                where: { recipientId: userId },
                orderBy: { createdAt: 'desc' },
                take: +limit,
                skip: +offset,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatar: true,
                            lastseen: true
                        },
                    },
                },
            }),
            this.prisma.notification.count({
                where: { recipientId: userId }
            })
        ])

        return {
            data: notifications,
            total: totalCount,
            hasMore: offset + limit < totalCount,
        };
    }

    // Отправка сообщения
    async createNotification(
        recipientId: string,
        userId: string,
        type: NotificationType,
        metadata: string
    ) {
        // Проверяем существование получателя
        const recipientExists = await this.prisma.user.findUnique({
            where: { id: recipientId },
        });
        if (!recipientExists) {
            throw new NotFoundException('Recipient not found');
        }

        console.log("NEW NOTIFICATION")

        // Создаем сообщение
        return this.prisma.notification.create({
            data: {
                type,
                metadata,
                read: false,
                userId,
                recipientId,
            },
        });
    }

    async markAsView(
        messageIds: string[]
    ) {
        await this.prisma.notification.updateMany({
            where: {
                id: {in: messageIds},
                read: false,
            },
            data: {
                read: true,
            },
        });

        return messageIds;
    }

    async getUnreadCount(
        userId: string
    ) {
        return this.prisma.notification.count({
            where: {recipientId: userId, read: false}
        });
    }
}
