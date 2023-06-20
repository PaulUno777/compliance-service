import { Injectable, Logger } from '@nestjs/common';
import { DgtSanctionedProvider } from 'src/helpers/dgt-sanctioned.provider';
import { IatSanctionedProvider } from 'src/helpers/iat-sanctioned.provider';
import { SanctionProvider } from 'src/helpers/sanction.provider';
import { Tools } from 'src/helpers/tools';
import { UnSanctionedProvider } from 'src/helpers/un-sanctioned.provider';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private sactionProvider: SanctionProvider,
    private iatSanctionedProvider: IatSanctionedProvider,
    private dgtSanctionedProvider: DgtSanctionedProvider,
    private unSanctionedProvider: UnSanctionedProvider,
    private tools: Tools,
  ) {}

  async updateAllToMongo() {
    //= = = = = delete all elements in collection
    const client = this.tools.getMongoClient();
    await this.tools
      .mongoDeleteMany('Sanctioned', client)
      .finally(() => client.close());

    const result = await Promise.all([
      await this.sactionProvider.migrateSanctionList(),
      await this.iatSanctionedProvider.migrateSanctioned(),
      await this.dgtSanctionedProvider.migrateSanctioned(),
      await this.unSanctionedProvider.migrateSanctioned(),
    ]);
    this.logger.log('All is well !'); 
    return result;
  }

  async test() {
    //= = = = = get and clean sanctioned
    await this.iatSanctionedProvider.getSanctioned();
    await this.iatSanctionedProvider.mapSanctioned();
  
    await this.dgtSanctionedProvider.getSanctioned();
    await this.dgtSanctionedProvider.mapSanctioned();

    await this.unSanctionedProvider.getSanctioned;
    await this.unSanctionedProvider.mapSanctioned();

    //map & write sanction list
    await this.sactionProvider.mapSanction();
  }
}
