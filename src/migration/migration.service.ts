/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DgtSanctionedProvider } from 'src/helpers/dgt-sanctioned.provider';
import { ExposedProvider } from 'src/helpers/exposed.provider';
import { IatSanctionedProvider } from 'src/helpers/iat-sanctioned.provider';
import { SanctionProvider } from 'src/helpers/sanction.provider';
import { Tools } from 'src/helpers/tools';
import { UeSanctionedProvider } from 'src/helpers/ue-sanctioned.provider';
import { UnSanctionedProvider } from 'src/helpers/un-sanctioned.provider';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private sactionProvider: SanctionProvider,
    private iatSanctionedProvider: IatSanctionedProvider,
    private dgtSanctionedProvider: DgtSanctionedProvider,
    private unSanctionedProvider: UnSanctionedProvider,
    private ueSanctionedProvider: UeSanctionedProvider,
    private exposedProvider: ExposedProvider,
    private tools: Tools,
    private config: ConfigService,
  ) {}

  //all methods that retrieve data from source every night
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async getUpdate() {
    //= = = = = get and clean sanctioned

    this.logger.log('Downloading And Mapping All Sanctioned!');

    await this.dgtSanctionedProvider.getSanctioned();
    await this.dgtSanctionedProvider.mapSanctioned();

    await this.unSanctionedProvider.getSanctioned();
    await this.unSanctionedProvider.mapSanctioned();

    await this.ueSanctionedProvider.getSanctioned();
    await this.ueSanctionedProvider.mapSanctioned();

    await this.iatSanctionedProvider.getSanctioned();
    await this.iatSanctionedProvider.mapSanctioned();

    //= = = = = map & write sanction list
    await this.sactionProvider.mapSanction();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async updateAllToMongo() {
    //= = = = = delete all elements in collection
    const client = this.tools.getMongoClient();
    await this.tools
      .mongoDeleteMany('Sanctioned', client)
      .finally(() => client.close());

    this.logger.log('Migrating All Sanctioned!');

    const result = await Promise.all([
      await this.sactionProvider.migrateSanctionList(),
      await this.dgtSanctionedProvider.migrateSanctioned(),
      await this.unSanctionedProvider.migrateSanctioned(),
      await this.ueSanctionedProvider.migrateSanctioned(),
      await this.iatSanctionedProvider.migrateSanctioned(),
    ]);
    this.logger.log('All is well !');
    return result;
  }

  //method to retrieve & migrate PEP data every sunday at midnight
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async getPep() {
    this.logger.log('====== Getting PEP From Source...');
    const url = this.config.get('PEP_SOURCE');
    //request
    await this.tools.saveJsonFromJsonSpecial(url, 'liste_PEP');
    await this.exposedProvider.checkPepLength();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async updatePep() {
    const client = this.tools.getMongoClient();
    await this.tools
      .mongoDeleteMany('PoliticallyExposed', client)
      .finally(() => client.close());

    await this.exposedProvider.migrateExposed();
  }
}
