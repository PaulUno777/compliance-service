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
  Query,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { ApiExcludeEndpoint, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { join } from 'path';
import { SearchParam } from './dtos/search-param';

@ApiTags('Search')
@Controller('search')
export class SearchController {

  constructor(
    private readonly searchService: SearchService,
    private config: ConfigService,
  ) {}

  @ApiQuery({
    name: 'text',
    description: 'text to search',
    required: true,
    type: 'string',
  })
  @Get('/exposed')
  searchExposedSimple(@Query() query: Record<string, any>) {
    return this.searchService.searchSimpleExposed(String(query.text));
  }

  @Post('/exposed')
  searchExposedFiltered(@Body() body: SearchParam) {
    //Check all body parameters
    const regex = /[0-9]{4}/g;
    if (body.fullName.length <= 3 || regex.test(body.fullName))
      throw new BadRequestException(
        'Invalid parameter(!) You must provide real fullname to search',
      );

    if (body.dob) {
      if (
        (body.dob.length != 4 && body.dob.length != 7) ||
        !regex.test(body.dob)
      )
        throw new BadRequestException(
          'Invalid parameter ! dob must be a YYYY-MM or YYYY',
        );
    }

    if (body.sanction) {
      if (body.sanction.length <= 0 || Array.isArray(body.sanction) == false)
        throw new BadRequestException(
          'Invalid parameter ! sanction must be unempty list of sanction ids',
        );
    }

    return this.searchService.searchFilteredExposed(body);
  }

  @ApiQuery({
    name: 'text',
    description: 'text to search',
    required: true,
    type: 'string',
  })
  @Get('/sanctioned')
  searchSanctionedSimple(@Query() query: Record<string, any>) {
    return this.searchService.searchSimpleSanctioned(String(query.text));
  }

  @Post('/sanctioned')
  searchSanctionedFiltered(@Body() body: SearchParam) {
    //Check all body parameters
    const regex = /[0-9]{4}/g;
    if (body.fullName.length <= 3 || regex.test(body.fullName))
      throw new BadRequestException(
        'Invalid parameter(!) You must provide real fullname to search',
      );

    if (body.dob) {
      if (
        (body.dob.length != 4 && body.dob.length != 7) ||
        !regex.test(body.dob)
      )
        throw new BadRequestException(
          'Invalid parameter ! dob must be a YYYY-MM or YYYY',
        );
    }

    if (body.sanction) {
      if (body.sanction.length <= 0 || Array.isArray(body.sanction) == false)
        throw new BadRequestException(
          'Invalid parameter ! sanction must be unempty list of sanction ids',
        );
    }

    return this.searchService.searchFilteredSanctioned(body);
  }





  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'application/xlsx')
  @Get('download/:file')
  download(
    @Param('file') fileName,
    @Response({ passthrough: true }) res,
  ): StreamableFile {
    res.set({
      'Content-Type': 'application/xlsx',
      'Content-Disposition': 'attachment; filename="seach-result.xlsx',
    });
    const dir = this.config.get('FILE_LOCATION');
    const file: any = createReadStream(join(process.cwd(), dir + fileName));
    if (!file)
      throw new NotFoundException('the file for this search does not exist');
    return new StreamableFile(file);
  }
}
