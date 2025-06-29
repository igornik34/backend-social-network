import {ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {CreateCommentDto, UpdateCommentDto} from './dto/comments.dto';
import {NotificationsGateway} from "../notifications/notifications.gateway";

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService, private notificationGateway: NotificationsGateway) {}

  private async findCommentById(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastseen: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Комментарий не найден');
    }

    const online = await this.notificationGateway.isUserOnline(comment.author.id)

    return {
      ...comment,
      author: {
        ...comment.author,
        online
      }
    };
  }

  async createComment(userId: string, dto: CreateCommentDto) {
    // Проверяем существует ли пост
    const postExists = await this.prisma.post.findUnique({
      where: { id: dto.postId },
    });

    if (!postExists) {
      throw new NotFoundException('Пост не найден');
    }

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        authorId: userId,
        postId: dto.postId,
        parentId: dto.parentId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastseen: true,
            lastName: true,
            avatar: true,
          }
        }
      }
    });
    const repliesCount = await this.prisma.comment.count({
      where: { parentId: comment.id },
    });

    // Если это ответ, проверяем родительский комментарий
    if (dto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });

      if (!parentComment) {
        throw new NotFoundException('Родительский комментарий не найден');
      }

      await this.notificationGateway.sendReplyCommentNotification(parentComment.authorId, comment.authorId, comment.content)
    }

    const online = await this.notificationGateway.isUserOnline(comment.author.id)

    if(!dto.parentId) {
      await this.notificationGateway.sendPostCommentNotification(postExists.authorId, comment.authorId, comment.content)
    }

    return {
      ...comment,
      author: {
        ...comment.author,
        online
      },
      repliesCount,
    };
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.findCommentById(commentId);

    if (comment.authorId !== userId) {
      throw new ForbiddenException('Вы не можете редактировать этот комментарий');
    }

    const updatedComment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        editable: true
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastseen: true,
            lastName: true,
            avatar: true,
          }
        }
      }
    });

    const online = await this.notificationGateway.isUserOnline(comment.author.id)

    const repliesCount = await this.prisma.comment.count({
      where: { parentId: updatedComment.id },
    });

    return {
      ...updatedComment,
      author: {
        ...comment.author,
        online
      },
      repliesCount,
    };
  }

  async deleteComment(userId: string, commentId: string): Promise<string> {
    const comment = await this.findCommentById(commentId);

    if (comment.authorId !== userId) {
      throw new ForbiddenException('Вы не можете удалить этот комментарий');
    }

    // Удаляем все ответы на комментарий
    await this.prisma.comment.deleteMany({
      where: { parentId: commentId },
    });

    // Удаляем сам комментарий
    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    return comment.id
  }

  async replyToComment(
    userId: string,
    commentId: string,
    dto: CreateCommentDto,
  ) {
    const parentComment = await this.findCommentById(commentId);

    return await this.createComment(userId, {
       ...dto,
       postId: parentComment.postId,
       parentId: parentComment.id,
     })
  }

  async getPostComments(postId: string, limit: number = 10, offset: number = 0, parentId: string = null) {
    console.log(parentId)
    const [comments, totalCount] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where: { postId, parentId }, // Только корневые комментарии
        skip: +offset,
        take: +limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastseen: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.comment.count({ where: { postId, parentId } }),
    ]);

    // Добавляем счетчики ответов к каждому комментарию
    const commentsWithCounts = await Promise.all(
        comments.map(async comment => {
          const repliesCount = await this.prisma.comment.count({
            where: { parentId: comment.id },
          });
          const online = await this.notificationGateway.isUserOnline(comment.author.id)

          return {
            ...comment,
            author: {
              ...comment.author,
              online
            },
            repliesCount,
          };
        })
    );

    return {
      data: commentsWithCounts,
      total: totalCount,
      hasMore: offset + limit < totalCount,
    };
  }
}