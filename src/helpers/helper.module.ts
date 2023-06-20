import { Global, Module } from '@nestjs/common';
import { Tools } from './tools';
import { SanctionProvider } from './sanction.provider';
import { HttpModule } from '@nestjs/axios';
import { IatSanctionedProvider } from './iat-sanctioned.provider';


@Global()
@Module({
  imports: [HttpModule],
  providers: [Tools, SanctionProvider, IatSanctionedProvider],
  exports: [Tools, SanctionProvider, IatSanctionedProvider],
})
export class HelperModule {}
