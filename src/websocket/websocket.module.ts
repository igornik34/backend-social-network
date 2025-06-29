import { Module } from '@nestjs/common';
import { WebsocketService } from './websocket.service';
import { WebsocketGateway } from './websocket.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getJwtConfig } from 'src/config/jwt.config';
import { UsersModule } from 'src/users/users.module';
import {MessagesModule} from "../messages/messages.module";
import {NotificationsModule} from "../notifications/notifications.module";

@Module({
  imports: [
    UsersModule,
    MessagesModule,
    NotificationsModule,
    JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: getJwtConfig,
          inject: [ConfigService]
        })
  ],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
