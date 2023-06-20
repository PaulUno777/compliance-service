import { Injectable } from '@nestjs/common';
import { IatSanctionedProvider } from 'src/helpers/iat-sanctioned.provider';
import { SanctionProvider } from 'src/helpers/sanction.provider';
import { Tools } from 'src/helpers/tools';

@Injectable()
export class MigrationService {
  constructor(
    private sactionProvider: SanctionProvider,
    private iatSanctionedProvider: IatSanctionedProvider,
    private tools: Tools,
  ) {}

  async test() {
    const client = this.tools.getMongoClient();
    await this.tools
      .mongoDeleteMany('Sanctioned', client)
      .finally(() => client.close());
    
    await this.iatSanctionedProvider.mapSanctionedIta();

    await this.iatSanctionedProvider.migrateSanctionedIta();
  }
}
