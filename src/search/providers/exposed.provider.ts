import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SearchTools } from 'src/helpers/search-tools';
import { ExposedSearchOutput } from '../dtos/exposed-search-output';
import { ConfigService } from '@nestjs/config';
import { Workbook } from 'exceljs';
import { existsSync, mkdirSync, unlink } from 'fs';
import { join } from 'path';
import { Country } from '@prisma/client';
import { SearchParam } from '../dtos/search-param';

@Injectable()
export class ExposedProvider {
  private readonly logger = new Logger(ExposedProvider.name);
  private readonly FILE_PATH;

  constructor(
    private searchProvider: SearchTools,
    private config: ConfigService,
  ) {
    this.FILE_PATH = this.config.get('FILE_LOCATION');
  }

  mapSearchResult(result: any, fullName: string): ExposedSearchOutput {
    const entity = {
      id: result.entity.id,
      defaultName: result.entity.defaultName,
      type: result.entity.type,
      positions: result.entity.positions,
    };

    if (result.datesOfBirth && result.datesOfBirth != null) {
      entity['datesOfBirth'] = result.datesOfBirth;
    }

    if (result.placesOfBirth && result.placesOfBirth != null) {
      entity['placesOfBirth'] = result.placesOfBirth;
    }

    if (result.nationalities && result.nationalities.length > 0) {
      entity['nationalities'] = result.nationalities;
    }

    if (result.citizenships && result.citizenships.length > 0) {
      entity['citizenships'] = result.citizenships;
    }

    const names = this.searchProvider.getAllNames(result);
    const score = this.searchProvider.setPercentage(names, fullName);
    return { entity, score };
  }

  cleanSearch(searchResult: any[], fullName?: string): any[] {
    //remove duplicate
    const cleanData = searchResult.map((item) => {
      return this.mapSearchResult(item, fullName);
    });
    cleanData.sort((a, b) => b.score - a.score);
    console.log({ searchResult: searchResult.length });
    return cleanData;
  }

  //Apply nationality and date of birth filters to retrieved data
  filteredSearch(response: any[], body: SearchParam) {
    let filteredData = response;

    //filter by score if needed
    if (body.matchRate) {
      this.logger.log('====== Filtering by score...');
      filteredData = filteredData.filter((value) => {
        return value.score >= body.matchRate;
      });
    }

    //filter by date of birth
    if (body.dob) {
      this.logger.log('====== Filtering by date of birth...');
      if (body.dob.length != 4 && body.dob.length != 7)
        throw new BadRequestException('dob value must be YYYY-MM or YYYY');

      const tempData = filteredData.filter((value: any) => {
        if (value.entity.datesOfBirth) {
          return this.searchProvider.checkDate(value.entity.datesOfBirth, body.dob);
        }
      });
      filteredData = tempData;
      console.log({ DOBfilteredCount: filteredData.length });
    }

    //filter by nationalities
    if (body.nationality) {
      this.logger.log('====== Filtering by natinality...');
      const tempData = filteredData.filter((value: any) => {
        if (value.entity.nationalities) {
          for (const isoCode of body.nationality) {
            if (this.searchProvider.checkNationality(value.entity.nationalities, isoCode))
              return true;
          }
        }
        if (value.entity.citizenships) {
          for (const isoCode of body.nationality) {
            if (this.searchProvider.checkNationality(value.entity.citizenships, isoCode))
              return true;
          }
        }
        if (value.entity.placesOfBirth) {
          for (const isoCode of body.nationality) {
            if (this.searchProvider.checkPlaceOfBirth(value.entity.placesOfBirth, isoCode))
              return true;
          }
        }
      });
      filteredData = tempData;
      console.log({ nationalityfiltered: filteredData.length });
    }

    return filteredData;
  }


  mapExcelData(array: any[], searchInput: string): any[] {
    this.logger.log('----- Mapping data for Excel');
    const cleanData = [];

    if (array.length > 0) {
      let dobString = null;
      let nationality = null;

      cleanData.push({
        style: 1,
        searchInput: searchInput,
        result: 'Potential match detected',
        matchRate: array[0].score + ' %',
      });
      array.forEach((elt, index) => {
        let name = '';
        if (elt.entity.dateOfBirth) {
          const dateOfBirth = elt.entity.dateOfBirth;
          let day = '';
          if (dateOfBirth.day != null) day = `${dateOfBirth.day}/`;
          let month = '';
          if (dateOfBirth.month != null) month = `${dateOfBirth.month}/`;
          let year = '';
          if (dateOfBirth.year != null) year = `${dateOfBirth.year}`;
          //to string date
          dobString = `${day}${month}${year}`;
        }

        if (elt.entity.nationality)
          nationality = elt.entity.nationality[0].country;

        name = elt.entity.defaultName;

        const DETAIL_URL = this.config.get('DETAIL_URL');
        let positions = '';
        if (elt.entity.positions) positions = elt.entity.positions.join(',');

        cleanData.push({
          style: 3,
          result: `${index}. (${elt.score}%) - ${name}`,
          positions: positions,
          dob: dobString,
          nationality: nationality,
          link: `${DETAIL_URL}${elt.entity.id}/information`,
        });
      });
    } else {
      cleanData.push({
        style: 0,
        searchInput: searchInput,
        result: 'No match detected',
        matchRate: '0.00 %',
      });
    }
    return cleanData;
  }

  async generateExcel(searchResult: any[], searchInput: string) {
    this.logger.log('----- generating Excel file');
    const workbook = new Workbook();
    workbook.creator = 'kamix-compliance-service';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Search Result', {
      headerFooter: { firstHeader: 'SCAN REPORT' },
    });
    //create headers
    sheet.columns = [
      { header: 'Search Input', key: 'searchInput', width: 35 },
      { header: 'Results', key: 'result', width: 40 },
      { header: 'Positions', key: 'positions', width: 68 },
      { header: 'Date Of Birth', key: 'dob', width: 12 },
      { header: 'Nationality', key: 'nationality', width: 20 },
      { header: 'Match Rates (%)', key: 'matchRate', width: 15 },
      { header: 'View Links', key: 'link', width: 45 },
      { header: 'Style', key: 'style', hidden: true },
    ];

    sheet.getRow(1).font = {
      name: 'Calibri',
      family: 4,
      size: 11,
      bold: true,
    };

    //add rows
    sheet.addRows(searchResult);

    //styling the worksheet
    sheet.eachRow((row) => {
      row.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      row.getCell('F').alignment = {
        horizontal: 'right',
      };
      // [ 'C', 'G'].map((key) => {
      //   row.getCell(key).alignment = {
      //     horizontal: 'justify',
      //   };
      // });

      if (row.getCell('H').value == 0) {
        ['B', 'C', 'D', 'E', 'F'].forEach((key) => {
          row.getCell(key).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'E2EFDA' },
          };
          row.getCell(key).font = {
            color: { argb: '33B050' },
          };
        });
      }
      if (row.getCell('H').value == 1) {
        ['A', 'G'].map((key) => {
          row.getCell(key).border = {
            left: { style: 'thin' },
            right: { style: 'thin' },
            top: { style: 'thin' },
            bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
          };
        });
        ['B', 'C', 'D', 'E', 'F'].forEach((key) => {
          row.getCell(key).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FCE4D6' },
          };
          row.getCell(key).font = {
            color: { argb: 'FF0056' },
          };
          row.getCell(key).border = {
            left: { style: 'thin' },
            right: { style: 'thin' },
            top: { style: 'thin' },
            bottom: { style: 'thin', color: { argb: 'FCE4D6' } },
          };
        });
      }
      if (row.getCell('H').value == 3) {
        ['A', 'G'].map((key) => {
          row.getCell(key).border = {
            left: { style: 'thin' },
            right: { style: 'thin' },
            top: { style: 'thin', color: { argb: 'FFFFFF' } },
            bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
          };
        });
        ['B', 'C', 'D', 'E', 'F'].map((key) => {
          row.getCell(key).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FCE4D6' },
          };
          row.getCell(key).border = {
            left: { style: 'thin' },
            right: { style: 'thin' },
            top: { style: 'thin', color: { argb: 'FCE4D6' } },
            bottom: { style: 'thin', color: { argb: 'FCE4D6' } },
          };
        });
      }
      row.commit();
    });

    //write the
    const name = `${searchInput}.xlsx`;
    const fileName = name.replace(/\s/g, '');
    const pathToFile = this.FILE_PATH + fileName;

    if (!existsSync(join(process.cwd(), this.FILE_PATH))) {
      mkdirSync(join(process.cwd(), this.FILE_PATH));
      console.log('public directory created');
    }

    await unlink(pathToFile, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log('Successfully deleted the file.');
      }
    });

    await workbook.xlsx.writeFile(pathToFile);

    return fileName;
  }
}
