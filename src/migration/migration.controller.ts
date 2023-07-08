import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  StreamableFile,
  Response,
  NotFoundException,
} from '@nestjs/common';
import { MigrationService } from './migration.service';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { join } from 'path';

@ApiTags('Migration')
@Controller('migration')
export class MigrationController {
  constructor(
    private readonly migrationService: MigrationService,
    private config: ConfigService,
  ) {}

  @Get('test')
  async test() {
    return this.migrationService.test();
  }

  @Get('update')
  async update() {
    return this.migrationService.updateAllToMongo();
  }

  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/json')
  @Get('download/:file')
  download(
    @Param('file') fileName,
    @Response({ passthrough: true }) res,
  ): StreamableFile {
    res.set({
      'Content-Type': 'application/json',
    });
    const dir = this.config.get('SOURCE_DIR');
    const file: any = createReadStream(join(process.cwd(), dir + fileName));
    if (!file) throw new NotFoundException('the source file does not exist');
    return new StreamableFile(file);
  }
}
