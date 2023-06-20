import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Tools } from './tools';
import { createWriteStream } from 'fs';
import { getName, getAlpha2Code } from 'i18n-iso-countries';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SanctionProvider {
  private readonly logger = new Logger();
  constructor(private config: ConfigService, private tools: Tools, private prisma: PrismaService) {}

  //==== ---- map and save sanction into file ---- ====
  async mapSanction() {
    this.logger.log('====== Geting & Saving all sanction lists...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    //---- list file
    let lists = [];
    //---- ITA
    const listIta = await this.tools.readJsonFile('clean_ITA.json');
    lists = lists.concat(listIta.lists);

    const sourceLinkFile = `${SOURCE_DIR}clean_list.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(lists));
    writeStream.end();
  }

  // //======= Method for sanctionList migration =========
  async migrateSanctionList() {
    this.logger.log('migrating sanction List');
    const data = await this.tools.readJsonFile('clean_list.json');
    //init MongoDB collection
    const { id, ...oneData } = data[0];
    await this.prisma.sanctionList.create({
      data: oneData,
    });
    //delete all elements in collection
    const client = this.tools.getMongoClient();
    await this.tools.mongoDeleteMany('SanctionList', client).finally(() =>
      client.close(),
    );
    // Apply updates
    const result = await this.prisma.sanctionList.createMany({
      data: data,
    });
    this.logger.log({
      message: `${Number(result.count)} element(s) migrated to SanctionList`,
    });
    return {
      message: `${Number(result.count)} element(s) migrated to SanctionList`,
    };
  }
}
