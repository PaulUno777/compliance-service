import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExposedService } from './exposed.service';
import { ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('PoliticallyExposed')
@Controller('exposed')
export class ExposedController {
  constructor(private readonly exposedService: ExposedService) {}

  @ApiQuery({
    name: 'page',
    description: 'The page number',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    description: 'The max elements per page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'orderBy',
    description: "order criteria, possibles values are 'asc' or 'desc'",
    required: false,
    type: String,
  })
  @Get()
  findAll(@Query() query: Record<string, any>) {
    return this.exposedService.findAll(
      Number(query.page),
      Number(query.limit),
      query.orderBy,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.exposedService.findOne(id);
  }
}
