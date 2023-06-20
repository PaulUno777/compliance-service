import { Global, Module } from '@nestjs/common';
import { Tools } from './tools';
import { SanctionProvider } from './sanction.provider';
import { HttpModule } from '@nestjs/axios';
import { IatSanctionedProvider } from './iat-sanctioned.provider';
import { DgtSanctionedProvider } from './dgt-sanctioned.provider';
import { UnSanctionedProvider } from './un-sanctioned.provider';

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    Tools,
    SanctionProvider,
    IatSanctionedProvider,
    DgtSanctionedProvider,
    UnSanctionedProvider,
  ],
  exports: [
    Tools,
    SanctionProvider,
    IatSanctionedProvider,
    DgtSanctionedProvider,
    UnSanctionedProvider,
  ],
})
export class HelperModule {}
