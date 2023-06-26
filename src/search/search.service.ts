import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ExposedProvider } from './providers/exposed.provider';
import { SanctionedProvider } from './providers/sanctioned.provider';
import { SearchParam } from './dtos/search-param';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private prisma: PrismaService,
    private exposedProvider: ExposedProvider,
    private sanctionedProvider: SanctionedProvider,
    private config: ConfigService,
  ) {}

  //======== EXPOSED SIMPLE SEARCH =================================
  async searchSimpleExposed(text: string): Promise<any> {
    this.logger.log('= = = = Searching Exposed (Simple) = = = =');

    const regex = /[0-9]{4}/g;
    if (typeof text != 'string' || text.length <= 3 || regex.test(text))
      throw new BadRequestException(
        'Invalid parameter(!) You must provide real fullname to search',
      );

    //Request query to mongoDB
    //----sanctioned
    const pipeline: any = [
      {
        //search
        $search: {
          index: 'sanctionsexplorer_pep_index',
          text: {
            query: text,
            path: ['defaultName', 'alias'],
            fuzzy: {
              maxEdits: 2,
            },
          },
        },
      },
      //limit
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchScoreMax: { $max: '$searchScore' },
          },
        },
      },
      {
        $addFields: {
          normalizedScore: {
            $divide: ['$searchScore', '$searchScoreMax'],
          },
        },
      },
      {
        $match: { normalizedScore: { $gte: 0.25 } },
      },
      {
        $project: {
          _id: 0,
          entity: {
            id: { $toString: '$_id' },
            defaultName: '$defaultName',
            type: '$type',
            positions: '$positions',
            alias: '$alias',
          },
          scoreAtlas: '$normalizedScore',
        },
      },
    ];

    // Request query to mongoDB
    //----- in sanctioned collection
    const result: any = await this.prisma.politicallyExposed.aggregateRaw({
      pipeline: pipeline,
    });

    const cleanedData = await this.exposedProvider.cleanSearch(result, text);

    //check if no results
    if (cleanedData.length <= 0) {
      return {
        resultsCount: cleanedData.length,
        resultsFile: null,
        results: cleanedData,
      };
    }

    // //generate Excel file
    const downloadUrl = this.config.get('DOWNLOAD_URL');
    const excelData = this.exposedProvider.mapExcelData(cleanedData, text);
    const file = await this.exposedProvider.generateExcel(excelData, text);

    this.logger.log('(success !) all is well');

    return {
      resultsCount: cleanedData.length,
      resultsFile: `${downloadUrl}${file}`,
      results: cleanedData,
    };
  }

  //======== EXPOSED FILTERED SEARCH =================================
  async searchFilteredExposed(body: SearchParam) {
    this.logger.log('= = = = Searching Exposed and Filter = = = =');
    console.log(body);
    let maxEdits = 2;
    let matchRate = 0.25;
    if (body.matchRate) {
      if (
        typeof body.matchRate != 'number' ||
        body.matchRate <= 0 ||
        body.matchRate > 100
      ) {
        throw new BadRequestException(
          'Invalid parameter ! matchRate must be a number between 1 and 100',
        );
      } else {
        if (body.matchRate > 80) {
          maxEdits = 1;
        }
        if (body.matchRate < 40) {
          matchRate = body.matchRate / 100;
        }
      }
    }

    const pipeline: any = [
      {
        //search
        $search: {
          index: 'sanctionsexplorer_pep_index',
          text: {
            query: body.fullName,
            path: ['defaultName', 'akas'],
            fuzzy: {
              maxEdits: maxEdits,
            },
          },
        },
      },
      //limit
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchScoreMax: { $max: '$searchScore' },
          },
        },
      },
      {
        $addFields: {
          normalizedScore: {
            $divide: ['$searchScore', '$searchScoreMax'],
          },
        },
      },
      {
        $match: { normalizedScore: { $gte: matchRate } },
      },
    ];

    //check if type is provided in request parameters
    if (typeof body.type == 'string') {
      if (
        body.type.toLowerCase() != 'individual' &&
        body.type.toLowerCase() != 'entity'
      ) {
        throw new BadRequestException(
          'type value must be Individual or Entity',
        );
      }

      pipeline.push({
        $match: {
          $expr: {
            $eq: [
              {
                $regexMatch: {
                  input: '$type',
                  regex: body.type,
                  options: 'i',
                },
              },
              true,
            ],
          },
        },
      });
    }

    pipeline.push({
      $project: {
        _id: 0,
        entity: {
          id: { $toString: '$_id' },
          defaultName: '$defaultName',
          type: '$type',
          positions: '$positions',
          alias: '$akas',
        },
        datesOfBirth: '$datesOfBirth',
        placesOfBirth: '$placesOfBirth',
        nationalities: '$nationalities',
        citizenships: '$citizenships',
        scoreAtlas: '$normalizedScore',
      },
    });

    // Request query to mongoDB
    //----- in sanctioned collection
    const result: any = await this.prisma.politicallyExposed.aggregateRaw({
      pipeline: pipeline,
    });

    // merge akalist and sanctioned  and remove duplicate data and map
    const cleanedData = await this.exposedProvider.cleanSearch(
      result,
      body.fullName,
    );

    // //------ apply filters on results
    const filtered = await this.exposedProvider.filteredSearch(
      cleanedData,
      body,
    );

    //check if no results
    if (filtered.length <= 0) {
      return {
        resultsCount: filtered.length,
        resultsFile: null,
        results: filtered,
      };
    }

    //generate Excel file
    this.logger.log('Generating Excel file ...');
    const downloadUrl = this.config.get('DOWNLOAD_URL');
    const excelData = this.exposedProvider.mapExcelData(
      filtered,
      body.fullName,
    );
    const file = await this.exposedProvider.generateExcel(
      excelData,
      body.fullName,
    );

    this.logger.log('(success !) all is well');
    return {
      resultsCount: filtered.length,
      resultsFile: `${downloadUrl}${file}`,
      results: filtered,
    };
  }

  //======== SANCTIONED SIMPLE SEARCH =================================
  async searchSimpleSanctioned(text: string): Promise<any> {
    this.logger.log('simple searching Sanctioned...');
    const regex = /[0-9]{4}/g;
    if (typeof text != 'string' || text.length <= 3 || regex.test(text))
      throw new BadRequestException(
        'Invalid parameter(!) You must provide real fullname to search',
      );

    //Request query to mongoDB
    //----sanctioned
    const pipeline: any = [
      {
        //search
        $search: {
          index: 'sanctionned_index',
          text: {
            query: text,
            path: ['defaultName', 'akas'],
            fuzzy: {
              maxEdits: 2,
            },
          },
        },
      },
      //sanction
      {
        $lookup: {
          from: 'SanctionList',
          localField: 'listId',
          foreignField: '_id',
          pipeline: [
            { $project: { _id: 0, id: { $toString: '$_id' }, name: 1 } },
          ],
          as: 'sanction',
        },
      },
      //limit
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchScoreMax: { $max: '$searchScore' },
          },
        },
      },
      {
        $addFields: {
          normalizedScore: {
            $divide: ['$searchScore', '$searchScoreMax'],
          },
        },
      },
      {
        $match: { normalizedScore: { $gte: 0.25 } },
      },
      {
        $project: {
          _id: 0,
          entity: {
            id: { $toString: '$_id' },
            listId: { $toString: '$listId' },
            defaultName: '$defaultName',
            type: '$type',
            alias: '$alias',
          },
          sanction: {
            $arrayElemAt: ['$sanction', 0],
          },
          dateOfBirth: '$datesOfBirth',
          placeOfBirth: '$placesOfBirth',
          nationalities: '$nationalities',
          citizenships: '$citizenships',
          scoreAtlas: '$normalizedScore',
        },
      },
    ];

    // Request query to mongoDB
    //----- in sanctioned collection
    const result: any = await this.prisma.sanctioned.aggregateRaw({
      pipeline: pipeline,
    });

    //merge sanctioned and aka result into one array and remove duplicate
    const cleanedData = await this.sanctionedProvider.cleanSearch(result, text);

    //check if no results
    if (cleanedData.length <= 0) {
      return {
        resultsCount: cleanedData.length,
        resultsFile: null,
        results: cleanedData,
      };
    }

    //generate Excel file
    const downloadUrl = this.config.get('DOWNLOAD_URL');
    const excelData = this.sanctionedProvider.mapExcelData(cleanedData, text);
    const file = await this.sanctionedProvider.generateExcel(excelData, text);

    this.logger.log('(success !) all is well');

    return {
      resultsCount: cleanedData.length,
      resultsFile: `${downloadUrl}${file}`,
      results: cleanedData,
    };
  }

  //======== SANCTIONED FILTERED SEARCH =================================
  async searchFilteredSanctioned(body: SearchParam) {
    this.logger.log('Filtered searching ...');
    console.log(body);
    let maxEdits = 2;
    let matchRate = 0.25;
    if (body.matchRate) {
      if (
        typeof body.matchRate != 'number' ||
        body.matchRate <= 0 ||
        body.matchRate > 100
      ) {
        throw new BadRequestException(
          'Invalid parameter ! matchRate must be a number between 1 and 100',
        );
      } else {
        if (body.matchRate > 80) {
          maxEdits = 1;
        }
        if (body.matchRate < 40) {
          matchRate = body.matchRate / 100;
        }
      }
    }

    ////$ $ $ $ $  SANCTIONED $ $ $ $ $ $
    const sanctionedPipeline: any = [
      {
        //search
        $search: {
          index: 'sanctionned_index',
          text: {
            query: body.fullName,
            path: ['defaultName', 'akas'],
            fuzzy: {
              maxEdits: maxEdits,
            },
          },
        },
      },
      //sanction
      {
        $lookup: {
          from: 'SanctionList',
          localField: 'listId',
          foreignField: '_id',
          pipeline: [
            { $project: { _id: 0, id: { $toString: '$_id' }, name: 1 } },
          ],
          as: 'sanction',
        },
      },
      //limit
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
        },
      },
      {
        $setWindowFields: {
          output: {
            searchScoreMax: { $max: '$searchScore' },
          },
        },
      },
      {
        $addFields: {
          normalizedScore: {
            $divide: ['$searchScore', '$searchScoreMax'],
          },
        },
      },
      {
        $match: { normalizedScore: { $gte: matchRate } },
      },
    ];

    //check if type is provided in request parameters
    if (typeof body.type == 'string') {
      if (
        body.type.toLowerCase() != 'individual' &&
        body.type.toLowerCase() != 'entity' &&
        body.type.toLowerCase() != 'vessel'
      ) {
        throw new BadRequestException(
          'type value must be Individual Entity or Vessel',
        );
      }
      sanctionedPipeline.push({
        $match: {
          $expr: {
            $eq: [
              {
                $regexMatch: {
                  input: '$type',
                  regex: body.type,
                  options: 'i',
                },
              },
              true,
            ],
          },
        },
      });
    }

    sanctionedPipeline.push({
      $project: {
        _id: 0,
        entity: {
          id: { $toString: '$_id' },
          listId: { $toString: '$listId' },
          defaultName: '$defaultName',
          type: '$type',
          remarks: '$remarks',
          publicationUrl: '$publicationUrl',
        },
        sanction: {
          $arrayElemAt: ['$sanction', 0],
        },
        alias: '$alias',
        datesOfBirth: '$datesOfBirth',
        placesOfBirth: '$placesOfBirth',
        nationalities: '$nationalities',
        citizenships: '$citizenships',
      },
    });

    // Request query to mongoDB
    //----- in sanctioned collection
    const result: any = await this.prisma.sanctioned.aggregateRaw({
      pipeline: sanctionedPipeline,
    });

    // merge akalist and sanctioned  and remove duplicate data and map
    const cleanedData = await this.sanctionedProvider.cleanSearch(
      result,
      body.fullName,
    );
    // //------ apply filters on results
    const filtered = await this.sanctionedProvider.filteredSearch(
      cleanedData,
      body,
    );

    //check if no results
    if (filtered.length <= 0) {
      return {
        resultsCount: filtered.length,
        resultsFile: null,
        results: filtered,
      };
    }

    //generate Excel file
    this.logger.log('Generating Excel file ...');
    const downloadUrl = this.config.get('DOWNLOAD_URL');
    const excelData = this.sanctionedProvider.mapExcelData(
      filtered,
      body.fullName,
    );
    const file = await this.sanctionedProvider.generateExcel(
      excelData,
      body.fullName,
    );

    this.logger.log('(success !) all is well');
    return {
      resultsCount: filtered.length,
      resultsFile: `${downloadUrl}${file}`,
      results: filtered,
    };
  }

}
