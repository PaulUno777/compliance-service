import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const configService = app.get(ConfigService);
  //Open API Documentation
  const config = new DocumentBuilder()
    .setTitle('KAMIX Compliance Service')
    .setDescription('Compliance Rest API Docs')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  //Cross-origin Configurations
  app.enableCors();

  //start server
  const PORT = configService.get('PORT') || 3000;
  await app.listen(PORT);
  console.log(`Server listening on port: ${PORT}`);
}
bootstrap();
