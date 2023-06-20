import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { parseStringPromise } from 'xml2js';
import { catchError, firstValueFrom } from 'rxjs';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  unlink,
} from 'fs';
import { join } from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoClient } from 'mongodb';

@Injectable()
export class Tools {
  private readonly logger = new Logger();

  constructor(
    private config: ConfigService,
    private readonly httpService: HttpService,
    private prisma : PrismaService,
  ) {}

  // tranform dat into { day?: string; month?: string; year?: string }
  transformDate(inputDate: string): { day?: string; month?: string; year?: string } {
    const message = `${inputDate} is Invalid date`;
    if (inputDate.length < 4) {
      throw message;
    }

    const date = this.extractDate(inputDate);

    const reg = /[-/\\]/;
    if (date.includes('\\') || date.includes('/') || date.includes('-')) {
      const arrayDate = date.split(reg);
      if (arrayDate.length < 3) {
        if (arrayDate[0].length > 3) {
          return {
            month: arrayDate[1],
            year: arrayDate[0],
          };
        } else {
          return {
            month: arrayDate[0],
            year: arrayDate[1],
          };
        }
      } else {
        if (arrayDate[0].length > 3) {
          return {
            day: arrayDate[2],
            month: arrayDate[1],
            year: arrayDate[0],
          };
        } else {
          return {
            day: arrayDate[0],
            month: arrayDate[1],
            year: arrayDate[2],
          };
        }
      }
    }
    return { year: date };
  }

  async saveJsonFromXml(downloadLink: string, fileName: string): Promise<any> {
    const SOURCE_DIR = this.config.get('SOURCE_DIR');

    if (!existsSync(join(process.cwd(), SOURCE_DIR))) {
      mkdirSync(join(process.cwd(), SOURCE_DIR));
      console.log('sanction source directory created');
    }

    const response = await firstValueFrom(
      this.httpService.get(downloadLink).pipe(
        catchError((error) => {
          this.logger.error(error);
          throw `An error happened with ${fileName} source!`;
        }),
      ),
    );
    const xmlData = response.data;
    const options = {
      normalizeTags: true,
      explicitArray: false,
      attrkey: 'value',
    };
    const jsonData = await parseStringPromise(xmlData, options);
    const jsonFilePath = `${SOURCE_DIR}${fileName}.json`;
    const writeStream = createWriteStream(jsonFilePath);
    await unlink(jsonFilePath, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log('Successfully deleted the file.');
      }
    });
    writeStream.write(JSON.stringify(jsonData));
    this.logger.log(
      `Successfully get and write data to ${SOURCE_DIR}${fileName}.json`,
    );
    writeStream.end();
  }

  async saveJsonFromJson(downloadLink: string, fileName: string): Promise<any> {
    const SOURCE_DIR = this.config.get('SOURCE_DIR');

    if (!existsSync(join(process.cwd(), SOURCE_DIR))) {
      mkdirSync(join(process.cwd(), SOURCE_DIR));
      console.log('sanction source directory created');
    }

    const response = await firstValueFrom(
      this.httpService.get(downloadLink).pipe(
        catchError((error) => {
          this.logger.error(error);
          throw `An error happened with ${fileName} source!`;
        }),
      ),
    );
    const jsonData = response.data;
    const jsonFilePath = `${SOURCE_DIR}${fileName}.json`;
    const writeStream = createWriteStream(jsonFilePath);
    writeStream.write(JSON.stringify(jsonData));
    this.logger.log(
      `Successfully get and write data to ${SOURCE_DIR}${fileName}.json`,
    );
    writeStream.end();
  }

  readJsonFile(fileName: string) {
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const rawData = readFileSync(
      join(process.cwd(), SOURCE_DIR + fileName),
      'utf-8',
    );
    const jsonData = JSON.parse(rawData);
    return jsonData;
  }

  transformId(id: number): string {
    if (!id) return '';
    let tempId: string;
    let count = 0;

    tempId = id.toString();
    if (tempId.length < 24) {
      const length = 24 - tempId.length;

      for (let i = 0; i < length; i++) {
        if (count > 9) count = 0;
        tempId += count;
        count++;
      }
      return tempId;
    } else {
      return tempId.slice(0, 24);
    }
  }

  getUniqueItem(data: string | Array<string>) {
    if (data instanceof Array) return data[0];
    return data;
  }

  toArray(element: any){
    if (element instanceof Array) return element
    return [element];
  }
  extractDate(stringDate: string) {
    const date = new Date(stringDate);
    const day: any = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('default', { month: '2-digit' });
    const year = date.getFullYear();
    if (stringDate.length < 5) {
      return `${year}`;
    }
    if (stringDate.length < 8) {
      return `${month}-${year}`;
    }
    return `${day}-${month}-${year}`;
  }

  convertDateRange(dates: string[]): string[] {
    let clean: string[] = [];

    for (const date of dates) {
      if (date.includes('to')) {
        const tempDates = date.split(' to ');
        clean = clean.concat(tempDates);
        continue;
      }
      clean.push(date);
    }
    return clean;
  }

  async migrateSanctioned(list: any[]) {
    //==== migrate all to MongoDB
    //push data in data in batches of 1000 to avoid errors and timeouts
    let data: any[];
    let result;
    let count = 0;
    //ITA
    if (list.length <= 2000) {
      result = await this.prisma.sanctioned.createMany({ data: list });
      count += result.count;
    } else {
      for (let i = 0; i <= list.length; i += 1000) {
        if (i >= list.length) i = list.length;
        data = list.slice(i, i + 1000);
        if (data.length > 0) {
          result = await this.prisma.sanctioned.createMany({ data: data });
        }


        count += result.count;
      }
    }
    return {
      message: `${Number(count)} element(s) migrated`,
    };
  }

  getMongoClient() {
    const url = this.config.get('DATABASE_URL');
    const client = new MongoClient(url);
    return client;
  }

  async mongoDeleteMany(collection: string, client: MongoClient) {
    await client.connect();
    const database = client.db('compliance_db');
    const col = database.collection(collection);
    const deleted = (await col.deleteMany({})).deletedCount;
    console.log(`${Number(deleted)} element(s) deleted`);
  }
  
}
