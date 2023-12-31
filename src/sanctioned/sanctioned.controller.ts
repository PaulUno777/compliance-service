import { Controller, Get, Param, Query } from '@nestjs/common';
import { SanctionedService } from './sanctioned.service';
import { ApiQuery, ApiTags } from '@nestjs/swagger';


@ApiTags('Sanctioned')
@Controller('Sanctioned')
export class SanctionedController {
  constructor(private readonly sanctionedService: SanctionedService) {}

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
  @ApiQuery({
    name: 'sactionId',
    description: 'filter by sanction category',
    required: false,
    type: String,
  })
  @Get()
  findAll(@Query() query: Record<string, any>) {
    return this.sanctionedService.findAll(
      Number(query.page),
      Number(query.limit),
      query.orderBy,
      query.sactionId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sanctionedService.findOne(id);
  }

  @Get('sanction/:sanctionId')
  findBySanction(
    @Param('sanctionId') sanctionId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.sanctionedService.findBySanction(
      sanctionId,
      Number(query.page),
    );
  }

}
