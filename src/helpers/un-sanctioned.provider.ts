import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import { Tools } from './tools';
import { getAlpha2Code, getName } from 'i18n-iso-countries';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UnSanctionedProvider {
  private readonly logger = new Logger();
  constructor(
    private config: ConfigService,
    private tools: Tools,
    private prisma: PrismaService,
  ) {}

  // International Trade Administration sanction source
  async getSanctioned() {
    this.logger.log('====== Getting Sanstion From UN Source...');
    const url = this.config.get('UN_SOURCE');
    //request
    await this.tools.saveJsonFromJson(url, 'liste_UN');
  }

  async mapSanctioned() {
    this.logger.log('====== Mapping Cleaning & Saving data From UN Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataUn = await this.tools.downloadData('liste_UN.json');

    const list = [
      {
        id: this.tools.transformId(11),
        name: 'UN List (UN) - United Nations Security Council',
        sourceUrl:
          'https://www.un.org/securitycouncil/fr/content/un-sc-consolidated-list',
        importRate: 'Hourly',
      },
    ];

    const sources: any = dataUn.consolidated_list.individuals;
    const sources2: any = dataUn.consolidated_list.entities;
    //=====---- Map Individuals ----=========
    const individuals = sources.individual;
    const cleanIndividual = individuals.map((item) => {
      const entity = {
        id: this.tools.transformId(item.dataid),
        type: 'Individual',
        listId: list[0].id,
        othersInfos: [],
        references: [],
      };

      let othersInfos = [];
      //====names
      let defaultName = '';
      if (item.third_name) {
        defaultName = item.third_name;
      }
      if (item.second_name) {
        entity['lastName'] = item.second_name;
        defaultName = (defaultName + ' ' + entity['lastName']).trim();
      }
      if (item.first_name) {
        entity['firstName'] = item.first_name;
        defaultName = (defaultName + ' ' + entity['firstName']).trim();
      }
      entity['defaultName'] = defaultName;

      //===gender
      if (item.gender && item.gender !== 'Unknown' && item.gender !== '') {
        entity['gender'] = item.gender;
      }
      //====akas
      const akas = [];
      if (item.individual_alias) {
        if (item.individual_alias instanceof Array) {
          item.individual_alias.forEach((aka) => {
            if (aka.alias_name !== '') akas.push(aka.alias_name);
          });
        } else {
          if (item.individual_alias.alias_name !== '')
            akas.push(item.individual_alias.alias_name);
        }
      }
      if (item.name_original_script) akas.push(item.name_original_script);
      entity['akas'] = akas;
      //====remarks
      if (item.comments1 && item.comments1 !== '')
        entity['remarks'] = item.comments1;

      //====dateOfBirth
      if (
        item.individual_date_of_birth &&
        item.individual_date_of_birth !== ''
      ) {
        const dates = this.tools.toArray(item.individual_date_of_birth);

        const cleandates = dates.map((date) => {
          if (date.year) return { year: date.year };
          if (date.date) {
            return this.tools.transformDate(date.date);
          }
        });

        if (cleandates.length > 0) entity['datesOfBirth'] = cleandates;
      }
      //======placeOfBirth
      if (
        item.individual_place_of_birth &&
        item.individual_place_of_birth !== ''
      ) {
        const places = this.tools.toArray(item.individual_place_of_birth);

        const cleanPlaces = places.map((place) => {
          const country = {
            name: place.country,
          };
          const isoCode = getAlpha2Code(place.country, 'en');
          if (isoCode) country['isoCode'] = isoCode;
          const placeData = {
            country: country,
          };

          if (place.note) placeData['place'] = place.note;
          if (place.state_province)
            placeData['stateOrProvince'] = place.state_province;
          if (place.city) placeData['place'] = place.city;

          return placeData;
        });

        if (cleanPlaces.length > 0) entity['placesOfBirth'] = cleanPlaces;
      }
      //==== title
      if (item.designation && item.designation !== '') {
        const titles = item.designation.value;
        if (titles instanceof Array) {
          //others infos
          const cleantitles = [];
          titles.forEach((elt) => {
            cleantitles.push({ value: elt, type: 'otherTitle' });
          });
          othersInfos = othersInfos.concat(cleantitles);
          // set title
          entity['title'] = titles[0];
        } else {
          entity['title'] = titles;
        }
      }
      if (item.title && item.title !== '') {
        const titles = item.title.value;
        if (titles instanceof Array) {
          //others infos
          const cleantitles = [];
          titles.forEach((elt) => {
            cleantitles.push({ value: elt, type: 'otherTitle' });
          });
          othersInfos = othersInfos.concat(cleantitles);
        } else {
          othersInfos.push({ value: titles, type: 'otherTitle' });
        }
      }
      //==== programs
      const programs = [];
      if (item.un_list_type && item.un_list_type !== '')
        programs.push(item.un_list_type);
      if (item.reference_number && item.reference_number !== '')
        programs.push(item.reference_number);
      entity['programs'] = programs;
      //==== references
      const references = [];
      if (item.comments1 !== '' && item.comments1) {
        references.push(item.comments1);
      }
      entity['references'] = references;
      //==== addresses
      if (item.individual_address && item.individual_address !== '') {
        const addresses = this.tools.toArray(item.individual_address);

        const cleanAddresses = addresses
          .map((place) => {
            const address = {};

            if (place.country && place.country !== '') {
              const country = {
                name: place.country,
              };
              const isoCode = getAlpha2Code(place.country, 'en');
              if (isoCode) country['isoCode'] = isoCode;
              address['country'] = country;
            }
            if (place.note && place.note !== '') address['place'] = place.note;

            if (place.city && place.city !== '') address['place'] = place.city;

            if (place.street && place.street !== '')
              address['place'] = `${address['place']}  ${place.street}`.trim();

            if (place.state_province && place.state_province !== '')
              address['stateOrProvince'] = place.state_province;

            if (
              address['place'] ||
              address['stateOrProvince'] ||
              address['country']
            )
              return address;
            return null;
          })
          .filter((address) => address !== null);

        if (cleanAddresses.length > 0) entity['addresses'] = cleanAddresses;
      }
      //nationalities
      if (item.nationality) {
        const nationalities = this.tools.toArray(item.nationality.value);

        const cleanNationalities = nationalities
          .map((elt) => {
            if (elt !== '') {
              const data = { name: elt };

              const iso = getAlpha2Code(elt, 'en');
              if (iso) data['isoCode'] = iso;
              return data;
            }
            return null;
          })
          .filter((data) => data !== null);

        if (cleanNationalities.length > 0)
          entity['nationalities'] = cleanNationalities;
      }

      //othersInfos
      if (item.individual_document && item.individual_document !== '') {
        const infos = item.individual_document;
        if (infos instanceof Array) {
          infos.forEach((elt) => {
            const data = {};
            let comments = '';
            if (elt.type_of_document && elt.type_of_document !== '')
              data['type'] = elt.type_of_document;
            if (elt.number && elt.number !== '') data['value'] = elt.number;
            if (elt.country_of_issue && elt.country_of_issue !== '')
              comments = `${comments}  ${elt.country_of_issue}`;
            if (elt.issuing_country && elt.issuing_country !== '')
              comments = `${comments}  ${elt.issuing_country}`;
            if (elt.note && elt.note !== '')
              comments = `${comments}  ${elt.note}`;
            if (elt.type_of_document2 && elt.type_of_document2 !== '')
              comments = `${comments}  ${elt.type_of_document2}`;

            data['comment'] = comments.trim();

            othersInfos.push(data);
          });
        } else {
          const data = {};
          let comments = '';
          if (infos.type_of_document && infos.type_of_document !== '')
            data['type'] = infos.type_of_document;
          if (infos.number && infos.number !== '') data['value'] = infos.number;
          if (infos.country_of_issue && infos.country_of_issue !== '')
            comments = `${comments}  ${infos.country_of_issue}`;
          if (infos.issuing_country && infos.issuing_country !== '')
            comments = `${comments}  ${infos.issuing_country}`;
          if (infos.note && infos.note !== '')
            comments = `${comments}  ${infos.note}`;
          if (infos.type_of_document2 && infos.type_of_document2 !== '')
            comments = `${comments}  ${infos.type_of_document2}`;

          data['comment'] = comments.trim();

          othersInfos.push(data);
        }
      }
      entity['othersInfos'] = othersInfos;
      return entity;
    });

    //=====---- Map Entities ----=========
    const entities = sources2.entity;
    const cleanEntities = entities.map((item) => {
      const entity = {
        id: this.tools.transformId(item.dataid),
        type: 'Entity',
        listId: list[0].id,
        defaultName: item.first_name,
        othersInfos: [],
        references: [],
        addresses: [],
      };
      //====akas
      const akas = [];
      if (item.entity_alias) {
        if (item.entity_alias instanceof Array) {
          item.entity_alias.forEach((aka) => {
            if (aka.alias_name !== '') akas.push(aka.alias_name);
          });
        } else {
          if (item.entity_alias.alias_name !== '')
            akas.push(item.entity_alias.alias_name);
        }
      }
      if (item.name_original_script) akas.push(item.name_original_script);
      entity['akas'] = akas;
      //====remarks
      if (item.comments1 && item.comments1 !== '')
        entity['remarks'] = item.comments1;
      //programs
      const programs = [];
      if (item.un_list_type && item.un_list_type !== '')
        programs.push(item.un_list_type);
      if (item.reference_number && item.reference_number !== '')
        programs.push(item.reference_number);
      entity['programs'] = programs;
      //references
      const references = [];
      if (item.comments1 !== '' && item.comments1) {
        references.push(item.comments1);
      }
      entity['references'] = references;
      //addresses
      if (item.entity_address && item.entity_address !== '') {
        const addresses = this.tools.toArray(item.entity_address);
        const cleanAddresses = addresses
          .map((place) => {
            const address = {};

            if (place.country && place.country !== '') {
              const country = {
                name: place.country,
              };
              const isoCode = getAlpha2Code(place.country, 'en');
              if (isoCode) country['isoCode'] = isoCode;
              address['country'] = country;
            }
            if (place.note && place.note !== '') address['place'] = place.note;

            if (place.city && place.city !== '') address['place'] = place.city;

            if (place.street && place.street !== '')
              address['place'] = `${address['place']}  ${place.street}`.trim();

            if (place.state_province && place.state_province !== '')
              address['stateOrProvince'] = place.state_province;

            if (
              address['place'] ||
              address['stateOrProvince'] ||
              address['country']
            )
              return address;
            return null;
          })
          .filter((address) => address !== null);

        if (cleanAddresses.length > 0) entity['addresses'] = cleanAddresses;
      }

      return entity;
    });

    const cleanData = cleanEntities.concat(cleanIndividual);
    const finalData = {
      lists: list,
      results: cleanData,
      total: cleanData.length,
    };
    if (finalData.lists && finalData.results)
      this.logger.log('(success !) all is well');

    const sourceLinkFile = `${SOURCE_DIR}clean_UN.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(finalData));
    writeStream.end();
  }

  async migrateSanctioned() {
    this.logger.log('migrationg ITA sanctioned Collection...');
    //Get the data from source file
    const { results } = await this.tools.downloadData('clean_UN.json');
    //migrate all to MongoDB

    //const list = results.slice(300, 350);

    return await this.tools.migrate(results);
  }
}
