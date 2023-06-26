import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);

  //create my folder
  const SOURCE_DIR = './sanctions_source/';
  const PUBLIC_DIR = './public/';

  //manage source directory
  if (!existsSync(join(process.cwd(), PUBLIC_DIR))) {
    mkdirSync(join(process.cwd(), PUBLIC_DIR));
    console.log('public directory created');
  }
  if (!existsSync(join(process.cwd(), SOURCE_DIR))) {
    mkdirSync(join(process.cwd(), SOURCE_DIR));
    console.log('sanction source directory created');
  }

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
