import { Controller, Get } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('migration')
@Controller('migration')
export class MigrationController {
  constructor(
    private readonly migrationService: MigrationService,
    private config: ConfigService,
  ) {}

  @Get('test')
  async test() {
    return await this.migrationService.test();
  }
}
