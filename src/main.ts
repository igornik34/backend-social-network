import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { setupSwagger } from './utils/swagger.util';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Получаем экземпляр ConfigService
  const configService = app.get(ConfigService);

  // Безопасное получение переменных окружения
  const frontUrl = configService.get<string>('FRONT_URL', 'http://localhost:5173');
  const port = configService.get<number>('PORT', 3000);

  app.enableCors({
    origin: frontUrl,
    credentials: true
  });

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());

  setupSwagger(app);

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();