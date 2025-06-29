import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {NotificationsGateway} from "../notifications/notifications.gateway";

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService, private notificationGateway: NotificationsGateway) {}

  async likePost(postId: string, userId: string): Promise<string> {
    // Проверяем существует ли пост
    const postExists = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    
    if (!postExists) {
      throw new NotFoundException('Пост не найден');
    }

    // Проверяем не лайкнул ли уже пользователь этот пост
    const existingLike = await this.prisma.like.findFirst({
      where: {
        userId,
        postId,
      },
    });

    if (existingLike) {
        throw new ConflictException('Вы уже лайкнули этот пост');
    }

    // Создаем лайк
    const like = await this.prisma.like.create({
      data: {
        userId,
        postId,
      },
    });

    console.log("NEW LIKE NOTIFICATION")
    await this.notificationGateway.sendPostLikeNotification(postExists.authorId, userId, postExists.content)

    return like.id
  }

  async unlikePost(postId: string, userId: string): Promise<string> {
    // Находим лайк для удаления
    const like = await this.prisma.like.findFirst({
      where: {
        userId,
        postId,
      },
    });

    if (!like) {
        throw new NotFoundException('Лайк не найден');
    }

    // Удаляем лайк
    await this.prisma.like.delete({
      where: { id: like.id },
    });

    console.log(like)

    return like.id
  }
}