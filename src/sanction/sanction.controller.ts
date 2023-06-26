import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SanctionService } from './sanction.service';

@ApiTags('Sanction')
@Controller('sanction')
export class SanctionController {
  constructor(private readonly sanctionService: SanctionService) {}

  @Get()
  findAll() {
    return this.sanctionService.findAll();
  }
  
}
