import { Injectable, Logger } from '@nestjs/common';
import { IatSanctionedProvider } from 'src/helpers/iat-sanctioned.provider';
import { SanctionProvider } from 'src/helpers/sanction.provider';
import { Tools } from 'src/helpers/tools';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private sactionProvider: SanctionProvider,
    private iatSanctionedProvider: IatSanctionedProvider,
    private tools: Tools,
  ) {}

  async updateAllToMongo() {
    //delete all elements in collection
    const client = this.tools.getMongoClient();
    await this.tools
      .mongoDeleteMany('Sanctioned', client)
      .finally(() => client.close());

    const result = await Promise.all([
      await this.sactionProvider.migrateSanctionList(),
      await this.iatSanctionedProvider.migrateSanctionedIta(),
    ]);
    this.logger.log('All is well !');
    return result;
  }

  async test() {
    const client = this.tools.getMongoClient();
    await this.tools
      .mongoDeleteMany('Sanctioned', client)
      .finally(() => client.close());

    //get and clean sanctioned
    await this.iatSanctionedProvider.getSanctionedIta();
    await this.iatSanctionedProvider.mapSanctionedIta();

    //map & write sanction list
    await this.sactionProvider.mapSanction();
  }
}
