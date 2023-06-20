import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { MigrationService } from './migration/migration.service';
import { MigrationModule } from './migration/migration.module';
import { HelperModule } from './helpers/helper.module';
import { LoggerMiddleware } from './middleware/logger.middleware';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MigrationModule,
    HelperModule,
  ],
  providers: [MigrationService,],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
