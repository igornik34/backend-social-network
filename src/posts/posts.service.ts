import {ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from 'src/prisma/prisma.service';
import {CreatePostDto} from './dto/create-post.dto';
import {PostDto} from './dto/post.dto';
import {UpdatePostDto} from './dto/update-post.dto';
import {UploaderService} from "../uploader/uploader.service";
import {NotificationsGateway} from "../notifications/notifications.gateway";

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService, private uploader: UploaderService, private notificationGateway: NotificationsGateway) { }

  async findById(postId: string, userId: string): Promise<PostDto> {
    const [post, likesCount, commentsCount, userLike] = await this.prisma.$transaction([
      this.prisma.post.findUnique({
        where: { id: postId },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              lastseen: true,
            },
          },
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  lastseen: true,
                }
              }
            },
            take: 10,
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
      }),
      this.prisma.like.count({
        where: { postId }
      }),
      this.prisma.comment.count({
        where: { postId }
      }),
      this.prisma.like.findFirst({
        where: {
          postId,
          userId
        },
        select: {
          id: true
        }
      })
    ]);

    if (!post) {
      throw new NotFoundException('Пост не найден');
    }

    const online = await this.notificationGateway.isUserOnline(post.author.id)

    return {
      ...post,
      author: {
        ...post.author,
        online
      },
      likesCount,
      commentsCount,
      likedByUser: userId ? !!userLike : undefined
    };
  }

  async createPost(userId: string, dto: CreatePostDto, files: Express.Multer.File[] = []): Promise<PostDto> {
    const pathsImages = await this.uploader.uploadImages('posts', files)
    console.log(files)
    const post = await this.prisma.post.create({
      data: {
        content: dto.content,
        images: pathsImages,
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            lastseen: true,
          },
        }
      },
    })

    const online = await this.notificationGateway.isUserOnline(post.author.id)

    return {
      ...post,
      author: {
        ...post.author,
        online
      },
      ...(await this.getCounts(userId, post.id))
    }
  }

  async updatePost(
    postId: string,
    userId: string,
    dto: UpdatePostDto,
    newFiles: Express.Multer.File[] = [],
  ): Promise<PostDto> {
    const post = await this.findById(postId, userId)

    if (post.authorId !== userId) {
      throw new ForbiddenException('У вас нет прав на этот пост');
    }

    await this.uploader.deleteImages(post.images)
    console.log(newFiles)
    const newImagesPaths = newFiles.length > 0 ? await this.uploader.uploadImages('posts', newFiles) : [];

    const updatedPost = await this.prisma.post.update({
      where: {id: postId},
      data: {
        content: dto.content ?? post.content,
        images: newImagesPaths,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            lastseen: true,
          },
        },
      },
    })

    const online = await this.notificationGateway.isUserOnline(post.author.id)

    return {
      ...updatedPost,
      author: {
        ...post.author,
        online
      },
      ...(await this.getCounts(userId, updatedPost.id))
    }
  }

  async deletePost(postId: string, userId: string): Promise<PostDto['id']> {
    const post = await this.findById(postId, userId)

    if (post.authorId !== userId) {
      throw new ForbiddenException('У вас нет прав на этот пост');
    }

    await this.uploader.deleteImages(post.images)

    await this.prisma.$transaction([
      this.prisma.comment.deleteMany({ where: { postId } }),
      this.prisma.like.deleteMany({ where: { postId } }),
      this.prisma.post.delete({ where: { id: postId } }),
    ])

    return post.id
  }

  private async getCounts(userId: string, postId: string) {
    const userLike = await this.prisma.like.findFirst({
      where: {
        userId,
        postId,
      },
      select: {
        postId: true,
      },
    })

    const [likesCount, commentsCount] = await this.prisma.$transaction([
      this.prisma.like.count({where: {postId: postId}}),
      this.prisma.comment.count({where: {postId: postId}}),
    ]);

    console.log({
      likesCount,
      commentsCount,
      likedByUser: !!userLike,
    })

    return {
      likesCount,
      commentsCount,
      likedByUser: !!userLike,
    };
  }

  async getPosts(
    limit: number = 10,
    offset: number = 0,
    userId: string,
  ) {
    const [posts, counts] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        skip: +offset,
        take: +limit,
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          authorId: userId
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              lastseen: true,
            },
          },
        },
      }),
      this.prisma.post.count(),
    ]);

    console.log(posts)

    const postsWithCounts = await Promise.all(posts.map(async (el) => {
      const counts = await this.getCounts(userId, el.id)
      const online = await this.notificationGateway.isUserOnline(el.author.id)
      return {...el, author: {...el.author, online}, ...counts}
    }))

    console.log(postsWithCounts)

    return {
      data: postsWithCounts,
      hasMore: offset + limit < counts,
      total: counts
    };
  }

  async getFeedPosts(
      userId: string,
      limit: number = 10,
      offset: number = 0
  ): Promise<{
    data: PostDto[];
    total: number
    hasMore: boolean;
  }> {
    // 1. Получаем ID пользователей, на которых подписан текущий пользователь
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);

    // 2. Сначала пытаемся получить популярные посты от подписок
    const [followingPosts, followingTotal] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where: {
          authorId: {
            in: followingIds,
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Последние 30 дней
          },
        },
        orderBy: {
          likes: {
            _count: 'desc',
          },
        },
        skip: +offset,
        take: +limit,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              lastseen: true,
            },
          },
        },
      }),
      this.prisma.post.count({
        where: {
          authorId: {
            in: followingIds,
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // 3. Если постов от подписок достаточно - возвращаем их
    if (followingPosts.length >= limit || offset + followingPosts.length >= followingTotal) {
      const postsWithCounts = await Promise.all(followingPosts.map(async (el) => {
        const counts = await this.getCounts(userId, el.id)
        const online = await this.notificationGateway.isUserOnline(el.author.id)
        return {...el, author: {...el.author, online}, ...counts}
      }))

      return {
        data: postsWithCounts,
        total: followingTotal,
        hasMore: offset + limit < followingTotal,
      };
    }

    // 4. Если постов от подписок недостаточно - добираем популярными постами
    const remainingLimit = limit - followingPosts.length;
    const [popularPosts, popularTotal] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
          authorId: {
            notIn: [...followingIds, userId], // Исключаем посты от подписок и свои
          },
        },
        orderBy: {
          likes: {
            _count: 'desc',
          },
        },
        skip: 0, // Всегда начинаем с начала для популярных постов
        take: remainingLimit,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              lastseen: true,
            },
          },
        },
      }),
      this.prisma.post.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
          authorId: {
            notIn: [...followingIds, userId],
          },
        },
      }),
    ]);

    // 5. Объединяем результаты
    const allPosts = [...followingPosts, ...popularPosts];
    const postsWithCounts = await Promise.all(allPosts.map(async (el) => {
      const counts = await this.getCounts(userId, el.id)
      const online = await this.notificationGateway.isUserOnline(el.author.id)
      return {...el, author: {...el.author, online}, ...counts}
    }))

    return {
      data: postsWithCounts,
      total: followingTotal + popularTotal,
      hasMore: offset + limit < followingTotal + popularTotal,
    };
  }

  async getPostLikes(postId: string, limit: number = 10, offset: number = 0) {
    const [likes, totalCount] = await this.prisma.$transaction([
      this.prisma.like.findMany({
        where: { postId },
        skip: +offset,
        take: +limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              lastseen: true,
            },
          },
        },
      }),
      this.prisma.like.count({ where: { postId } }),
    ]);

    return {
      data: likes,
      total: totalCount,
      hasMore: offset + limit < totalCount,
    };
  }
}
