import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { Sanctioned } from './sanctioned/sanctioned';
import { Exposed } from './exposed/exposed';

@Module({
  controllers: [SearchController],
  providers: [SearchService, Sanctioned, Exposed]
})
export class SearchModule {}
