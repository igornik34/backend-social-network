import {forwardRef, Module} from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsGateway } from './calls.gateway';
import {JwtModule} from "@nestjs/jwt";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {getJwtConfig} from "../config/jwt.config";
import {MessagesModule} from "../messages/messages.module";
import {WebsocketModule} from "../websocket/websocket.module";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getJwtConfig,
      inject: [ConfigService]
    }),
    MessagesModule,
    WebsocketModule
  ],
  providers: [CallsGateway, CallsService],
})
export class CallsModule {}
