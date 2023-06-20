import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import { Tools } from './tools';
import { getAlpha2Code, getName } from 'i18n-iso-countries';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class IatSanctionedProvider {
  private readonly logger = new Logger();
  constructor(
    private config: ConfigService,
    private tools: Tools,
    private prisma: PrismaService,
  ) {}

  // International Trade Administration sanction source
  async getSanctionedIta() {
    this.logger.log('====== Getting Sanstion From ITA Source...');
    const url = this.config.get('ITA_SOURCE');
    //request
    await this.tools.saveJsonFromJson(url, 'liste_ITA');
  }

  async mapSanctionedIta() {
    this.logger.log('====== Mapping Cleaning & Saving data From ITA Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataIat = await this.tools.readJsonFile('liste_ITA.json');

    //==== ---- Lists ---- ====
    const sourceList = dataIat.sources_used;

    const links = [
      {
        id: 30,
        liste: 'Capta List (CAP) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/list-of-foreign-financial-institutions-subject-to-correspondent-account-or-payable-through-account-sanctions-capta-list',
      },
      {
        id: 31,
        liste:
          'Non-SDN Chinese Military-Industrial Complex Companies List (CMIC) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/ns-cmic-list',
      },
      {
        id: 32,
        liste: 'Denied Persons List (DPL) - Bureau of Industry and Security',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/ns-cmic-list',
      },
      {
        id: 33,
        liste: 'ITAR Debarred (DTC) - State Department',
        link: 'https://www.pmddtc.state.gov/ddtc_public?id=ddtc_kb_article_page&sys_id=c22d1833dbb8d300d0a370131f9619f0',
      },
      {
        id: 34,
        liste: 'Entity List (EL) - Bureau of Industry and Security',
        link: 'https://www.pmddtc.state.gov/ddtc_public?id=ddtc_kb_article_page&sys_id=c22d1833dbb8d300d0a370131f9619f0',
      },
      {
        id: 35,
        liste: 'Foreign Sanctions Evaders (FSE) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/foreign-sanctions-evaders-fse-list',
      },
      {
        id: 36,
        liste: 'Nonproliferation Sanctions (ISN) - State Department',
        link: 'https://www.state.gov/key-topics-bureau-of-international-security-and-nonproliferation/nonproliferation-sanctions/',
      },
      {
        id: 37,
        liste:
          'Non-SDN Menu-Based Sanctions List (NS-MBS List) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/non-sdn-menu-based-sanctions-list-ns-mbs-list',
      },
      {
        id: 38,
        liste: 'Military End User (MEU) List - Bureau of Industry and Security',
        link: 'https://www.bis.doc.gov/index.php/policy-guidance/lists-of-parties-of-concern',
      },
      {
        id: 39,
        liste:
          'Palestinian Legislative Council List (PLC) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list/non-sdn-palestinian-legislative-council-ns-plc-list',
      },
      {
        id: 391,
        liste: 'Specially Designated Nationals (SDN) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists',
      },
      {
        id: 392,
        liste:
          'Sectoral Sanctions Identifications List (SSI) - Treasury Department',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/sectoral-sanctions-identifications-ssi-list',
      },
      {
        id: 393,
        liste: 'Unverified List (UVL) - Bureau of Industry and Security',
        link: 'https://home.treasury.gov/policy-issues/financial-sanctions/consolidated-sanctions-list-non-sdn-lists/sectoral-sanctions-identifications-ssi-list',
      },
    ];

    const lists = sourceList.map((item) => {
      const data = {
        name: item.source,
        importRate: 'Hourly',
        lastImported: item.last_imported,
        publicationDate: item.source_last_updated,
      };
      for (const elt of links) {
        if (elt.liste == item.source) {
          data['id'] = this.tools.transformId(elt.id);
          data['sourceUrl'] = elt.link;
        }
      }
      return data;
    });

    //==== ---- Sanctioned Data ---- ====
    const sourceResult = dataIat.results;
    const cleanSource = sourceResult.map((item) => {
      const entity = {
        defaultName: item.name,
      };
      //==== list id
      lists.forEach((elt) => {
        if (item.source === elt.name) {
          entity['listId'] = elt.id;
        }
      });
      //==== gender
      if (item.ids) {
        item.ids.forEach((elt) => {
          if (elt.type === 'Gender') entity['gender'] = elt.number;
        });
      }
      //==== type
      if (item.type) entity['type'] = item.type;

      //==== akas
      if (item.alt_names) entity['akas'] = item.alt_names;
      //==== date of birth
      if (
        item.dates_of_birth &&
        item.dates_of_birth != null &&
        item.dates_of_birth.length > 0
      ) {
        const dates = this.tools.convertDateRange(
          this.tools.toArray(item.dates_of_birth),
        );

        const cleanDate = dates.map((date) => {
          return this.tools.transformDate(date);
        });
        entity['datesOfBirth'] = cleanDate;
      }
      //==== place of birth
      if (
        item.places_of_birth &&
        item.places_of_birth != null &&
        item.places_of_birth.length > 0
      ) {
        const places = this.tools.toArray(item.places_of_birth);
        entity['placesOfBirth'] = places.map((place) => {
          const name = place.split(',').pop().trim();
          const isoCode = getAlpha2Code(name, 'en');
          if (isoCode) {
            return {
              place: place,
              country: {
                name: name,
                isoCode: isoCode,
              },
            };
          }
          return {
            place: place,
          };
        });
      }

      //==== title
      if (item.title && item.title != null) {
        entity['title'] = item.title;
      }

      //==== remarks
      if (item.remarks && item.remarks != null) {
        entity['remarks'] = item.remarks;
      }

      //==== program
      if (item.programs && item.programs != null && item.programs.length > 0) {
        entity['programs'] = item.programs;
      }

      //==== references
      const references = [];

      //federal register notice
      if (item.federal_register_notice && item.federal_register_notice != null)
        references.push(item.federal_register_notice);

      //license policy
      if (item.license_policy && item.license_policy != null)
        references.push(item.license_policy);

      //gross tonnage
      if (item.gross_tonnage && item.gross_tonnage != null)
        references.push(`gross tonnage - ${item.license_policy}`);

      //license policy
      if (item.license_policy && item.license_policy != null)
        references.push(item.license_policy);

      //license requirement
      if (item.license_requirement && item.license_requirement != null)
        references.push(item.license_requirement);
      entity['references'] = references;

      //==== publication url
      if (item.source_list_url && item.source_list_url != null) {
        entity['publicationUrl'] = item.source_list_url;
      }

      //==== addresses
      if (item.addresses) {
        const addresses = item.addresses.map((address) => {
          return {
            place: address.address,
            stateOrProvince: address.state,
            postalCode: address.postal_code,
            country: {
              isoCode: address.country,
              name: getName(address.country, 'en'),
            },
          };
        });
        entity['addresses'] = addresses;
      }
      //==== nationalities
      if (
        item.nationalities &&
        item.nationalities != null &&
        item.nationalities.length > 0
      ) {
        const natData = this.tools.toArray(item.nationalities);
        const nationalities = natData.map((elt) => {
          const name = getName(elt, 'en');
          const country = {
            isoCode: elt,
          };
          if (name) country['name'] = name;
          return country;
        });

        if (nationalities.length > 0) entity['nationalities'] = nationalities;
      }

      //==== citizenships
      if (
        item.citizenships &&
        item.citizenships != null &&
        item.citizenships.length > 0
      ) {
        const natData = this.tools.toArray(item.citizenships);
        const citizenships = natData.map((elt) => {
          const name = getName(elt, 'en');
          const country = {
            isoCode: elt,
          };
          if (name) country['name'] = name;
          return country;
        });

        if (citizenships.length > 0) entity['citizenships'] = citizenships;
      }

      //==== others infos
      if (item.ids && item.ids != null && item.ids.length > 0) {
        entity['othersInfos'] = item.ids.map((elt) => {
          const data = {
            type: elt.type,
            value: elt.number,
            issueDate: elt.issue_date,
            expirationDate: elt.expiration_date,
          };

          if (elt.country && elt.country != '' && elt.country != null)
            data['comment'] = getName(elt.country, 'en');
          return data;
        });
        //verssel flag
        if (item.vessel_flag && item.vessel_flag != null)
          entity['othersInfos'].push({
            type: 'vesselFlag',
            value: item.vessel_flag,
            issueDate: null,
            expirationDate: null,
          });
        //vessel owner
        if (item.vessel_owner && item.vessel_owner != null)
          entity['othersInfos'].push({
            type: 'vesselOwner',
            value: item.vessel_owner,
            issueDate: null,
            expirationDate: null,
          });
        //vessel type
        if (item.vessel_type && item.vessel_type != null)
          entity['othersInfos'].push({
            type: 'vesselType',
            value: item.vessel_type,
            issueDate: null,
            expirationDate: null,
          });
        //start_date
        if (item.start_date && item.start_date != null)
          entity['othersInfos'].push({
            type: 'startDate',
            value: item.start_date,
            issueDate: null,
            expirationDate: null,
          });
        //end_date
        if (item.end_date && item.end_date != null)
          entity['othersInfos'].push({
            type: 'endDate',
            value: item.end_date,
            issueDate: null,
            expirationDate: null,
          });
        //call sign
        if (item.call_sign && item.call_sign != null)
          entity['othersInfos'].push({
            type: 'callSign',
            value: item.call_sign,
            issueDate: null,
            expirationDate: null,
          });
      }
      return entity;
    });

    const finalData = {
      lists: lists,
      results: cleanSource,
      total: cleanSource.length,
    };

    if (finalData.lists && finalData.results)
      this.logger.log('(success !) all is well');

    const sourceLinkFile = `${SOURCE_DIR}clean_ITA.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(finalData));
    writeStream.end();
  }

  async migrateSanctionedIta() {
    this.logger.log('migrationg ITA sanctioned Collection...');
    //Get the data from source file
    const { results } = await this.tools.readJsonFile('clean_ITA.json');
    //migrate all to MongoDB
    return await this.tools.migrateSanctioned(results);
  }
  
}
