import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import { Tools } from './tools';
import { getAlpha2Code, getName } from 'i18n-iso-countries';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UeSanctionedProvider {
  private readonly logger = new Logger();
  constructor(
    private config: ConfigService,
    private tools: Tools,
    private prisma: PrismaService,
  ) {}

  // sanction from source
  async getSanctioned() {
    this.logger.log('====== Getting Sanstion From UE Source...');
    const url = this.config.get('UE_SOURCE');
    //request
    await this.tools.saveJsonFromXml(url, 'liste_UE');
  }

  async mapSanctioned() {
    this.logger.log('====== Mapping Cleaning & Saving data From UE Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataUe = await this.tools.downloadData('liste_UE.json');

    const list = [
      {
        id: this.tools.transformId(12),
        name: 'EU financial sanctions (EUFS) - Persons, Groups and Entities subject to EU financial sanctions',
        sourceUrl:
          'https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions?locale=en',
        importRate: 'Hourly',
        lastImported: dataUe.export.value.generationDate,
        publicationDate: dataUe.export.value.generationDate,
      },
    ];

    const sources: any = dataUe.export.sanctionentity;

    const cleanSource = sources.map((item) => {
      const entity = {
        listId: list[0].id,
      };
      const othersInfos = [];

      // ==== names & akas & gender & title
      if (item.namealias) {
        const names = item.namealias;
        const alias = [];
        if (names instanceof Array) {
          //----names
          if (names[0].value.firstName !== '')
            entity['firstName'] = names[0].value.firstName;
          if (names[0].value.middleName !== '')
            entity['middleName'] = names[0].value.middleName;
          if (names[0].value.lastName !== '')
            entity['lastName'] = names[0].value.lastName;
          if (names[0].value.defaultName !== '')
            entity['defaultName'] = names[0].value.wholeName;
          //----gender
          if (names[0].value.gender && names[0].value.gender !== '') {
            if (names[0].value.gender == 'M') entity['gender'] = 'Male';
            if (names[0].value.gender == 'F') entity['gender'] = 'Female';
          }
          //----title
          let title = '';
          if (names[0].value.title !== '') title = names[0].value.title;
          if (names[0].value.function && names[0].value.function !== '')
            title = `${title} ${names[0].value.function}`;

          if (title !== '') entity['title'] = title;
          //----akas
          names.forEach((elt, i) => {
            if (i !== 0) {
              alias.push(elt.value.wholeName);

              let title = '';
              if (elt.value.title !== '') title = elt.value.title;

              if (elt.value.function && elt.value.function !== '')
                title = `${title} ${elt.value.function}`;
              if (title !== '')
                othersInfos.push({
                  value: title,
                  type: 'otherTitle',
                });
            }
          });
          entity['akas'] = alias;
        } else {
          //----names
          if (names.value.firstName !== '')
            entity['firstName'] = names.value.firstName;
          if (names.value.middleName !== '')
            entity['middleName'] = names.value.middleName;
          if (names.value.lastName !== '')
            entity['lastName'] = names.value.lastName;
          if (names.value.defaultName !== '')
            entity['defaultName'] = names.value.wholeName;
          //----gender
          if (names.value.gender && names.value.gender !== '') {
            if (names.value.gender == 'M') entity['gender'] = 'Male';
            if (names.value.gender == 'F') entity['gender'] = 'Female';
          }
        }
      }

      //==== type
      if (item.subjecttype) {
        const types = item.subjecttype;
        if (types.value.classificationCode == 'P')
          entity['type'] = 'Individual';
        if (types.value.classificationCode == 'E') entity['type'] = 'Entity';
      }

      //==== remarks
      if (item.remark && item.remark !== '') {
        if (item.remark instanceof Array) {
          let remark = '';
          item.remark.forEach((elt) => {
            remark = `${remark} ${elt}`;
            entity['remarks'] = remark.trim;
          });
        } else {
          entity['remarks'] = item.remark;
        }
      }

      //==== datesOfBirth & placesOfBirth
      if (item.birthdate) {
        const dates = this.tools.toArray(item.birthdate);
        const cleanDates = [];
        const cleanPlaces = [];

        dates.forEach((date) => {
          const dateData = {};
          const placData = {};

          //---dateOfBirth
          if (date.value.dayOfMonth && date.value.dayOfMonth !== '')
            dateData['day'] = date.value.dayOfMonth;

          if (date.value.monthOfYear && date.value.monthOfYear !== '')
            dateData['month'] = date.value.monthOfYear;

          if (date.value.year && date.value.year !== '')
            dateData['year'] = date.value.year;

          // add date element
          if (dateData['year'] || dateData['month']) cleanDates.push(dateData);

          //---placeOfBirth
          if (date.value.countryIso2Code && date.value.countryIso2Code !== '') {
            const country = {
              isoCode: date.value.countryIso2Code,
              name: getName(date.value.countryIso2, 'en'),
            };
            placData['country'] = country;
          }

          if (date.value.city && date.value.city !== '') {
            placData['place'] = date.value.city;
          }
          if (date.value.zipCode && date.value.zipCode !== '') {
            placData['postalCode'] = date.value.zipCode;
          }
          if (date.value.region && date.value.region !== '') {
            placData['stateOrProvince'] = date.value.region;
          }
          // add place element
          if (placData['place'] || placData['country']) cleanPlaces.push(placData);
        });

        if(cleanDates.length > 0) entity['datesOfBirth'] = cleanDates
        if(cleanPlaces.length > 0) entity['placesOfBirth'] = cleanPlaces
      }

      //==== programs
      if (item.regulation) {
        let programs = '';
        if (item.regulation.value.programme)
          programs = `${programs} ${item.regulation.value.programme}`;
        if (item.regulation.value.regulationType)
          programs = `${programs} ${item.regulation.value.regulationType}`;
        if (item.regulation.value.organisationType)
          programs = `${programs} ${item.regulation.value.organisationType}`;

        entity['programs'] = [programs.trim()];

        if (item.regulation.publicationurl)
          entity['publicationUrl'] = item.regulation.publicationurl;
      }

      //==== references
      let reference = '';
      if (item.value.euReferenceNumber)
        reference = `${reference} ${item.value.euReferenceNumber}`;
      if (item.value.designationDate)
        reference = `${reference} - ${item.value.designationDate}`;
      entity['references'] = [reference.trim()];

      //==== addresses
      if (item.address) {
        const addresses = this.tools.toArray(item.address);

        const cleanAddresses = addresses.map((address) => {
          const data = {};
          let place = '';
          if (address.value.city && address.value.city !== '')
            place = `${place} ${address.value.city}`;

          if (address.value.street && address.value.street !== '')
            place = `${place} ${address.value.street}`;

          if (place !== '') data['place'] = place.trim();

          if (address.value.poBox && address.value.poBox !== '')
            data['postalCode'] = address.value.poBox;

          if (address.value.region && address.value.region !== '')
            data['stateOrProvince'] = address.value.region;

          if (
            address.value.countryIso2Code &&
            address.value.countryIso2Code !== ''
          )
            data['country'] = {
              isoCode: address.value.countryIso2Code,
              name: getName(address.value.countryIso2Code, 'en'),
            };

          //----othersInfos
          if (address.remark && address.remark !== '') {
            othersInfos.push({
              type: 'otherRemark',
              value: address.remark,
            });
          }

          if (address.contactinfo && address.contactinfo !== '') {
            const contactInfo = this.tools.toArray(address.contactinfo);

            for (const elt of contactInfo) {
              const info = { type: '', value: '' };

              if (elt.value.key !== '') info['type'] = elt.value.key;

              if (elt.value.value !== '') info['value'] = elt.value.value;

              if (info.type !== '' && info.value !== '') othersInfos.push(info);
            }
          }

          return data;
        });

        if (cleanAddresses.length > 0) entity['addresses'] = cleanAddresses;
      }

      //==== citizenships
      if (item.citizenship) {
        const citizenship = this.tools.toArray(item.citizenship);

        entity['citizenships'] = citizenship.map((country) => {
          const data = {};

          if (
            country.value.countryIso2Code &&
            country.value.countryIso2Code !== ''
          ) {
            if (country.value.countryIso2Code != '00') {
              data['isoCode'] = country.value.countryIso2Code;
              data['name'] = getName(country.value.countryIso2Code, 'en');
            } else {
              data['isoCode'] = country.value.countryIso2Code;
              data['name'] = country.value.countryDescription;
              
            }
          }

          return data;
        });
      }

      entity['othersInfos'] = othersInfos;
      return entity;
    });

    const finalData = {
      lists: list,
      results: cleanSource,
      total: cleanSource.length,
    };

    if (finalData.lists && finalData.results)
      this.logger.log('(success !) all is well');

    const sourceLinkFile = `${SOURCE_DIR}clean_UE.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(finalData));
    writeStream.end();
  }

  async migrateSanctioned() {
    this.logger.log('migrationg ITA sanctioned Collection...');
    //Get the data from source file
    const { results } = await this.tools.downloadData('clean_UE.json');
    //migrate all to MongoDB

    //const list = results.slice(100, 105);

    return await this.tools.migrate(results);
  }
}
