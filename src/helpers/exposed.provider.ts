import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Tools } from './tools';
import { createReadStream, createWriteStream } from 'fs';
import { getName, getAlpha2Code } from 'i18n-iso-countries';
import { PrismaService } from 'src/prisma/prisma.service';
import { createInterface } from 'readline';

@Injectable()
export class ExposedProvider {
  private readonly logger = new Logger(ExposedProvider.name);
  constructor(
    private config: ConfigService,
    private tools: Tools,
    private prisma: PrismaService,
  ) {}

  // International Trade Administration sanction source
  async getExposed() {
    this.logger.log(
      '====== Getting Politically Exposed Persons From Source...',
    );
    const url = this.config.get('PEP_SOURCE');
    //request
    await this.tools.saveJsonFromJsonSpecial(url, 'liste_PEP');
  }

  //==== ---- map and save sanction into file ---- ====
  async mapExposed() {
    this.logger.log(
      '====== Getting & Mapping Politically Exposed Persons From Saved File...',
    );
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const fileName = 'liste_PEP';

    const stream = createReadStream(`${SOURCE_DIR}${fileName}.json`, {
      encoding: 'utf8',
    });
    const reader = createInterface({ input: stream, crlfDelay: Infinity });

    let dataArray = [];
    let count = 0;
    for await (const line of reader) {
      const obj = JSON.parse(line);

      let alias = [];
      let otherInfos = [];
      let relations = [];

      const entity = {
        defaultName: obj.caption,
        type: obj.schema,
      };

      if (obj && obj.properties) {
        const prop = obj.properties;
        //firstName
        if (prop.firstName) entity['firstName'] = prop.firstName[0];

        //lastName
        if (prop.lastName) entity['lastName'] = prop.lastName[0];

        if (prop.lastName) entity['lastName'] = prop.lastName[0];

        //alias
        if (prop.alias) alias = prop.alias;

        if (prop.fatherName) alias.concat(prop.fatherName);

        if (prop.name) {
          const names = [...new Set([...prop.name, ...alias])];
          alias.concat(names);
        }
        entity['alias'] = alias;

        //gender
        if (prop.gender) entity['gender'] = prop.gender[0];

        //position
        if (prop.position) entity['positions'] = prop.position;

        if (prop.status) {
          if (entity['positions']) {
            const tempArray = [
              ...new Set([...entity['positions'], ...prop.status]),
            ];
            entity['positions'] = tempArray;
          }

          entity['positions'] = prop.status;
        }

        //notes
        if (prop.notes) entity['notes'] = prop.notes;
        if (prop.summary) {
          if (entity['notes']) {
            const tempArray = [
              ...new Set([...entity['notes'], ...prop.summary]),
            ];
            entity['notes'] = tempArray;
          }
          entity['notes'] = prop.summary;
        }

        //dateOfBirth
        if (prop.birthDate) {
          const birthDates = prop.birthDate;
          entity['datesOfBirth'] = birthDates.map((date) => {
            return this.tools.transformDate(date);
          });
        }
        //placeOfBirth
        if (prop.birthPlace) {
          const birthPlaces = prop.birthPlace;
          entity['placesOfBirth'] = birthPlaces.map((place) => {
            return { place: place };
          });
        }
        //title
        if (prop.title) entity['title'] = prop.title;

        //publicationUrl
        if (prop.sourceUrl) entity['publicationUrl'] = prop.sourceUrl[0];

        //addresses
        if (prop.addressEntity) {
          const addresses = prop.addressEntity;
          entity['addresses'] = addresses.map((address) => {
            const place = {
              place: address.caption,
            };
            if (address.properties.city)
              place['stateOrProvince'] = address.properties.city[0];
            if (address.properties.country) {
              const country = {
                isoCode: address.properties.country[0],
              };
              const name = getName(country.isoCode, 'en');
              if (name) country['name'] = name;
              place['country'] = country;
            }
            return place;
          });
        }

        //citizenships
        if (prop.country) {
          const inputCountries = this.tools.toArray(prop.country);

          const countries = inputCountries
            .map((country) => {
              const place = {
                isoCode: country,
              };
              const name = getName(place.isoCode, 'en');
              if (name) place['name'] = name;

              return place;
            })
            .filter((country) => country['name']);

          if (countries.length > 0) entity['citizenships'] = countries;
        }

        //nationalities
        if (prop.nationality) {
          const inputCountries = this.tools.toArray(prop.nationality);

          const countries = inputCountries
            .map((country) => {
              const place = {
                isoCode: country,
              };
              const name = getName(place.isoCode, 'en');
              if (name) place['name'] = name;

              return place;
            })
            .filter((country) => country['name']);

          if (countries.length > 0) entity['nationalities'] = countries;
        }

        //othersInfos
        if (prop.modifiedAt) {
          otherInfos.push({
            type: 'modifiedAt',
            value: prop.modifiedAt[0],
          });
        }

        if (prop.website)
          otherInfos.push({
            type: 'Websites',
            value: prop.website,
          });

        if (prop.keywords) {
          otherInfos.push({
            type: 'Keywords',
            value: prop.keywords,
          });
        }

        if (prop.sector) {
          otherInfos.push({
            type: 'sector',
            value: prop.sector,
          });
        }

        if (prop.email) {
          otherInfos.push({
            type: 'email',
            value: prop.email,
          });
        }
        if (prop.phone) {
          otherInfos.push({
            type: 'phone',
            value: prop.phone,
          });
        }

        if (otherInfos.length > 0) entity['othersInfos'] = otherInfos;

        // = = = = relations
        if (prop.unknownLinkTo) {
          const links = prop.unknownLinkTo;
          const cleanLinks = links.map((elt) => {
            const eltProps = elt.properties;
            let names = [];
            const link = {
              nature: 'Unknown Link',
              defaultName: eltProps.object[0].caption,
              type: eltProps.object[0].schema,
            };

            if (eltProps.object[0].properties) {
              //alias
              const linkProp = eltProps.object[0].properties;
              if (linkProp.alias)
                names = [...new Set([...linkProp.alias, ...names])];

              if (linkProp.name)
                names = [...new Set([...linkProp.name, ...names])];

              if (names.length > 0) link['alias'] = names;

              //links
              if (linkProp.relationship) {
                link['links'] = linkProp.relationship;
              }

              //gender
              if (linkProp.gender) link['gender'] = linkProp.gender[0];

              //position
              if (linkProp.position) link['positions'] = linkProp.position;
              if (linkProp.role) {
                if (link['positions']) {
                  link['positions'] = [
                    ...new Set([...link['positions'], ...linkProp.role]),
                  ];
                  link['positions'] = linkProp.role;
                }
              }

              //notes
              if (linkProp.notes) {
                link['notes'] = linkProp.notes;
              }
              if (linkProp.summary) {
                if (link['notes']) {
                  link['notes'] = [
                    ...new Set([...link['notes'], ...linkProp.summary]),
                  ];
                }
                link['notes'] = linkProp.summary;
              }

              //incorporationDate
              if (linkProp.incorporationDate) {
                const dates = linkProp.incorporationDate.map((date) => {
                  return this.tools.transformDate(date);
                });
                link['incorporationDate'] = dates;
              }

              if (linkProp.country) {
                let countries = linkProp.country
                  .map((country) => {
                    const place = {
                      isoCode: country,
                    };

                    const name = getName(country, 'en');
                    if (name) {
                      place['name'] = name;
                      return place;
                    }

                    return null;
                  })
                  .filter((country) => country !== null);

                if (countries.length > 0) link['citizenships'] = countries;
              }
            }

            return link;
          });

          relations = relations.concat(cleanLinks);

          //console.log(prop.unknownLinkTo[0].properties.object[0].properties);
          //console.log(prop);
        }

        if (prop.associations) {
          const links = prop.associations;
          const cleanLinks = links.map((elt) => {
            const eltProps = elt.properties.person[0];
            let names = [];
            const link = {
              nature: 'Associate',
              defaultName: eltProps.caption,
              type: eltProps.schema,
            };
            if (eltProps.properties) {
              const linkProp = eltProps.properties;
              // alias
              if (linkProp.alias) names = [...linkProp.alias, ...names];
              if (linkProp.name)
                names = [...new Set([...linkProp.name, ...names])];

              if (names.length > 0) link['alias'] = names;

              //links
              if (linkProp.relationship) {
                link['links'] = linkProp.relationship;
              }

              //gender
              if (linkProp.gender) link['gender'] = linkProp.gender[0];

              //position
              if (linkProp.position) link['positions'] = linkProp.position;

              //notes
              if (linkProp.notes) link['notes'] = linkProp.notes;

              //datesOfBirth
              if (linkProp.birthDate)
                link['datesOfBirth'] = linkProp.birthDate.map((date) => {
                  return this.tools.transformDate(date);
                });

              //placesOfBirth
              if (linkProp.birthPlace)
                link['placesOfBirth'] = linkProp.birthPlace.map((place) => {
                  {
                    place: place;
                  }
                });

              //citizenships
              if (linkProp.country) {
                let countries = linkProp.country
                  .map((country) => {
                    const place = {
                      isoCode: country,
                    };

                    const name = getName(country, 'en');
                    if (name) {
                      place['name'] = name;
                      return place;
                    }

                    return null;
                  })
                  .filter((country) => country !== null);

                if (countries.length > 0) link['citizenships'] = countries;
              }

              //nationalities
              if (linkProp.nationality) {
                let countries = linkProp.nationality
                  .map((country) => {
                    const place = {
                      isoCode: country,
                    };

                    const name = getName(country, 'en');
                    if (name) {
                      place['name'] = name;
                      return place;
                    }

                    return null;
                  })
                  .filter((country) => country !== null);

                if (countries.length > 0) link['nationalities'] = countries;
              }
            }
            return link;
          });

          relations = relations.concat(cleanLinks);
        }

        if (prop.familyPerson) {
          const links = prop.familyPerson;
          const cleanLinks = links.map((elt) => {
            const eltProps = elt.properties.relative[0];
            let names = [];
            const link = {
              nature: 'Family',
              defaultName: eltProps.caption,
              type: eltProps.schema,
            };

            if (eltProps.properties) {
              const linkProp = eltProps.properties;
              //alias
              if (linkProp.alias) names = [...linkProp.alias, ...names];
              if (linkProp.name)
                names = [...new Set([...linkProp.name, ...names])];

              if (names.length > 0) link['alias'] = names;

              //links
              if (linkProp.relationship) {
                link['links'] = linkProp.relationship;
              }

              //gender
              if (linkProp.gender) link['gender'] = linkProp.gender[0];

              //positions
              if (linkProp.status) link['positions'] = linkProp.status;

              if (linkProp.notes) link['notes'] = linkProp.notes;

              //datesOfBirth
              if (linkProp.birthDate)
                link['datesOfBirth'] = linkProp.birthDate.map((date) => {
                  return this.tools.transformDate(date);
                });

              //placesOfBirth
              if (linkProp.birthPlace)
                link['placesOfBirth'] = linkProp.birthPlace.map((place) => {
                  {
                    place: place;
                  }
                });

              //citizenships
              if (linkProp.country) {
                let countries = linkProp.country
                  .map((country) => {
                    const place = {
                      isoCode: country,
                    };

                    const name = getName(country, 'en');
                    if (name) {
                      place['name'] = name;
                      return place;
                    }

                    return null;
                  })
                  .filter((country) => country !== null);

                if (countries.length > 0) link['citizenships'] = countries;
              }

              //nationalities
              if (linkProp.nationality) {
                let countries = linkProp.nationality
                  .map((country) => {
                    const place = {
                      isoCode: country,
                    };

                    const name = getName(country, 'en');
                    if (name) {
                      place['name'] = name;
                      return place;
                    }

                    return null;
                  })
                  .filter((country) => country !== null);

                if (countries.length > 0) link['nationalities'] = countries;
              }
            }
            return link;
          });

          relations = relations.concat(cleanLinks);
        }

        if (relations.length > 0) entity['relationships'] = relations;

        //createdAt
        if (prop.first_seen) entity['createdAt'] = prop.first_seen;

        //updatedAt
        if (prop.last_seen) entity['updatedAt'] = prop.last_seen;
      }

      dataArray.push(entity);
      if (dataArray.length >= 2500) {
        const result = await this.prisma.politicallyExposed.createMany({
          data: dataArray,
        });
        count += result.count;

        dataArray = [];
        console.log(count);
      }
    }

    this.logger.log({
      message: `${Number(count)} element(s) finally migrated`,
    });
    //return dataArray;
  }

  // //======= Method for sanctionList migration =========
  async migrateExposed() {
    this.logger.log('migrating Politically Exposed Persons List...');
    
    const data = await this.mapExposed();
    //const list = data.slice(0, 3)

    return data;
  }
}
