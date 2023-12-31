import { Global, Module } from '@nestjs/common';
import { Tools } from './tools';
import { SanctionProvider } from './sanction.provider';
import { HttpModule } from '@nestjs/axios';
import { IatSanctionedProvider } from './iat-sanctioned.provider';
import { DgtSanctionedProvider } from './dgt-sanctioned.provider';
import { UnSanctionedProvider } from './un-sanctioned.provider';
import { UeSanctionedProvider } from './ue-sanctioned.provider';
import { ExposedProvider } from './exposed.provider';
import { SearchTools } from './search-tools';

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    Tools,
    SanctionProvider,
    IatSanctionedProvider,
    DgtSanctionedProvider,
    UnSanctionedProvider,
    UeSanctionedProvider,
    ExposedProvider,
    SearchTools,
  ],
  exports: [
    Tools,
    SanctionProvider,
    IatSanctionedProvider,
    DgtSanctionedProvider,
    UnSanctionedProvider,
    UeSanctionedProvider,
    ExposedProvider,
    SearchTools,
  ],
})
export class HelperModule {}
