import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LogStoreService } from './common/log-store.service';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  /* import LogStoreService */
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
