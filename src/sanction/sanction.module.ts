import { Module } from '@nestjs/common';
import { SanctionService } from './sanction.service';
import { SanctionController } from './sanction.controller';

@Module({
  providers: [SanctionService],
  controllers: [SanctionController]
})
export class SanctionModule {}
