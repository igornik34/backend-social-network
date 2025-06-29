import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { LikesModule } from './likes/likes.module';
import { CommentsModule } from './comments/comments.module';
import { FollowersModule } from './followers/followers.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CacheModule } from '@nestjs/cache-manager';
import { WebsocketModule } from './websocket/websocket.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagesModule } from './messages/messages.module';
import {ServeStaticModule} from "@nestjs/serve-static";
import { join } from 'path';
import { UploaderModule } from './uploader/uploader.module';
import { MetricsModule } from './metrics/metrics.module';
import { RedisModule } from './redis/redis.module';
import { ChatModule } from './chat/chat.module';
import { CallsModule } from './calls/calls.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    RedisModule,
    EventEmitterModule.forRoot(),
    CacheModule.register(),
    PrismaModule,
    UsersModule,
    PostsModule,
    LikesModule,
    CommentsModule,
    FollowersModule,
    NotificationsModule,
    WebsocketModule,
    MessagesModule,
    UploaderModule,
    MetricsModule,
    RedisModule,
    ChatModule,
    CallsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
