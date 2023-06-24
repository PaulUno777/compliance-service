import { Module } from '@nestjs/common';
import { ExposedService } from './exposed.service';
import { ExposedController } from './exposed.controller';

@Module({
  controllers: [ExposedController],
  providers: [ExposedService]
})
export class ExposedModule {}
