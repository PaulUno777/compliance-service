import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { ExposedProvider } from './providers/exposed.provider';
import { SanctionedProvider } from './providers/sanctioned.provider';


@Module({
  controllers: [SearchController],
  providers: [SearchService, SanctionedProvider, ExposedProvider],
})
export class SearchModule {}
