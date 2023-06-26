import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { MigrationService } from './migration/migration.service';
import { MigrationModule } from './migration/migration.module';
import { HelperModule } from './helpers/helper.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { SanctionModule } from './sanction/sanction.module';
import { SearchModule } from './search/search.module';
import { ExposedModule } from './exposed/exposed.module';
import { SanctionedModule } from './sanctioned/sanctioned.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MigrationModule,
    HelperModule,
    SanctionModule,
    SearchModule,
    ExposedModule,
    SanctionedModule,
  ],
  providers: [MigrationService,],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
