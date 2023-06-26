import { Injectable } from '@nestjs/common';
import { Country } from '@prisma/client';
import * as StringSimilarity from 'string-similarity';

@Injectable()
export class SearchTools {
  // get all entity names rom his definition
  getAllNames(result: any) {
    let names = [];
    names.push(result.entity.defaultName);
    if (result.alias && result.alias.length > 0)
      names = names.concat(result.alias);
    return names;
  }

  //transform score into percentage
  setPercentage(names: string[], fullName: string): number {
    let maxScore = 0;
    for (const name of names) {
      const score = StringSimilarity.compareTwoStrings(
        name.toUpperCase(),
        fullName.toUpperCase(),
      );
      if (score > maxScore) {
        maxScore = score;
      }
    }
    const data = maxScore * 100;
    return Number(data.toFixed(2));
  }

  checkDate(responseDates, bodyDate: string): boolean {
    let check = false;
    if (bodyDate.includes('-')) {
      const [year, month] = bodyDate.trim().split('-');
      for (const date of responseDates) {
        if (date.year == year && date.month == month) check = true;
        break;
      }
    } else {
      for (const date of responseDates) {
        if (date.year.trim() == bodyDate) {
          check = true;
          break;
        }
      }
    }

    return check;
  }

  checkNationality(
    entityNationalities: Country[],
    bodyIsoCode: string,
  ): boolean {
    if (entityNationalities instanceof Array) {
      let test = false;
      for (const name of entityNationalities) {
        let isoCode = '';
        if (name.isoCode) isoCode = name.isoCode.toLowerCase();
        const reqCode = bodyIsoCode.toLowerCase();
        if (isoCode === reqCode) {
          test = true;
          break;
        }
      }
      return test;
    } else {
      return false;
    }
  }

  checkPlaceOfBirth(placeOfBirth, isoCode: string): boolean {
    if (placeOfBirth instanceof Array) {
      let test = false;
      for (const place of placeOfBirth) {
        let code = '';
        if (place.country && place.country.isoCode)
          code = place.country.isoCode.toLowerCase();
        const reqCode = isoCode.toLowerCase();
        if (code === reqCode) {
          test = true;
          break;
        }
      }
      return test;
    } else {
      return false;
    }
  }
}
