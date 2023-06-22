import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'fs';
import { Tools } from './tools';
import { getAlpha2Code, getName } from 'i18n-iso-countries';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DgtSanctionedProvider {
  private readonly logger = new Logger(DgtSanctionedProvider.name);
  constructor(
    private config: ConfigService,
    private tools: Tools,
    private prisma: PrismaService,
  ) {}

  // International Trade Administration sanction source
  async getSanctioned() {
    this.logger.log('====== Getting Sanstion From DGT Source...');
    const url = this.config.get('DGT_SOURCE');
    //request
    await this.tools.saveJsonFromJson(url, 'liste_DGT');
  }

  async mapSanctioned() {
    this.logger.log('====== Mapping Cleaning & Saving data From DGT Source...');
    const SOURCE_DIR = this.config.get('SOURCE_DIR');
    const dataDgt = await this.tools.downloadData('liste_DGT.json');

    const list = [
      {
        id: this.tools.transformId(10),
        name: 'National Register of Gels (DGT) - FR Directorate of the Treasury',
        sourceUrl: 'https://gels-avoirs.dgtresor.gouv.fr/List',
        importRate: 'Hourly',
        lastImported: dataDgt.Publications.DatePublication,
        publicationDate: dataDgt.Publications.DatePublication,
      },
    ];

    const sources: any = dataDgt.Publications.PublicationDetail;

    const cleanSource = sources.map((item) => {
      const entity = {
        defaultName: item.Nom,
        listId: list[0].id,
        othersInfos: [],
        references: [],
        addresses: [],
      };
      let othersInfos = [];
      //==== type
      if (item.Nature) {
        if (item.Nature == 'Personne physique') entity['type'] = 'Individual';
        if (item.Nature == 'Personne morale') entity['type'] = 'Entity';
      }
      const details = item.RegistreDetail;

      details.forEach((detail) => {
        //==== names
        if (detail.TypeChamp == 'PRENOM') {
          entity['lastName'] = item.Nom;
          entity['firstName'] = detail.Valeur[0].Prenom;
          entity['defaultName'] =
            entity['defaultName'] + ' ' + entity['firstName'];
        }
        //==== gender
        if (detail.TypeChamp == 'SEXE') {
          if (detail.Valeur[0].Sexe == 'Masculin') entity['gender'] = 'Male';
          if (detail.Valeur[0].Sexe == 'Féminin') entity['gender'] = 'Female';
        }
        //==== alias
        if (detail.TypeChamp == 'ALIAS') {
          const alias = [];
          detail.Valeur.forEach((aka) => {
            alias.push(aka.Alias);
          });
          entity['alias'] = alias;
        }
        //==== remarks
        if (detail.TypeChamp == 'MOTIFS')
          entity['remarks'] = detail.Valeur[0].Motifs;
        //==== dateOfBirth
        if (detail.TypeChamp == 'DATE_DE_NAISSANCE') {
          const date = {};
          if (detail.Valeur[0].Jour != '') date['day'] = detail.Valeur[0].Jour;
          if (detail.Valeur[0].Mois != '')
            date['month'] = detail.Valeur[0].Mois;
          if (detail.Valeur[0].Annee != '')
            date['year'] = detail.Valeur[0].Annee;
          entity['datesOfBirth'] = [date];
        }
        //==== placeOfBirth
        if (detail.TypeChamp == 'LIEU_DE_NAISSANCE') {
          const data = { place: detail.Valeur[0].Lieu };
          if (detail.Valeur[0].Pays != '')
            data['country'] = {
              name: detail.Valeur[0].Pays,
              isoCode: getAlpha2Code(detail.Valeur[0].Pays, 'fr'),
            };
          entity['placesOfBirth'] = [data];
        }
        //==== title
        if (detail.TypeChamp == 'TITRE') {
          entity['title'] = detail.Valeur[0].Titre;
          if (detail.Valeur.length > 1) {
            const data = detail.Valeur;
            const tmpArray = data.map((elt) => {
              return {
                value: elt.Titre,
                type: 'OtherTitle',
              };
            });
            othersInfos = othersInfos.concat(tmpArray);
          }
        }
        //==== programs
        const programs = [];
        if (detail.TypeChamp == 'REFERENCE_UE') {
          detail.Valeur.forEach((ref) => {
            programs.push(ref.ReferenceUe);
          });
        }
        if (detail.TypeChamp == 'REFERENCE_ONU') {
          detail.Valeur.forEach((ref) => {
            programs.push(ref.ReferenceOnu);
          });
        }
        entity['programs'] = programs;
        //==== references
        const references = [];
        if (detail.TypeChamp == 'FONDEMENT_JURIDIQUE') {
          detail.Valeur.forEach((ref) => {
            references.push(
              `${ref.FondementJuridique} - ${ref.FondementJuridiqueLabel}`,
            );
          });
        }
        entity['references'] = references;

        //==== addresses
        if (detail.TypeChamp == 'ADRESSE_PM') {
          const data = {};
          if (detail.Valeur[0].Adresse != '')
            data['place'] = detail.Valeur[0].Adresse;
          if (detail.Valeur[0].Pays != '')
            data['country'] = {
              name: detail.Valeur[0].Pays,
              isoCode: getAlpha2Code(detail.Valeur[0].Pays, 'fr'),
            };
          entity.addresses = [data];
        }

        //==== nationalities
        if (detail.TypeChamp == 'NATIONALITE') {
          const data = { name: detail.Valeur[0].Pays };
          data['isoCode'] = getAlpha2Code(detail.Valeur[0].Pays, 'fr');
          entity['nationalities'] = [data];
        }
        //==== othersInfos
        if (detail.TypeChamp == 'AUTRE_IDENTITE') {
          const data = {
            value: detail.Valeur[0].NumeroCarte,
            type: 'CardNumber',
          };
          if (detail.Valeur[0].Commentaire != '')
            data['comment'] = detail.Valeur[0].Commentaire;
          othersInfos.push(data);
        }

        if (detail.TypeChamp == 'PASSEPORT') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              comment: elt.Commentaire,
              value: elt.NumeroPasseport,
              type: 'Passport',
            });
          });
        }

        if (detail.TypeChamp == 'TELEPHONE') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              value: elt.Telephone,
              type: 'PhoneNumber',
            });
          });
        }

        if (detail.TypeChamp == 'SITE_INTERNET') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              value: elt.SiteInternet,
              type: 'WebSite',
            });
          });
        }

        if (detail.TypeChamp == 'COURRIEL') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              value: elt.Courriel,
              type: 'Mail',
            });
          });
        }

        if (detail.TypeChamp == 'NUMERO_OMI') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              value: elt.NumeroOMI,
              type: 'OmiNumber',
            });
          });
        }

        if (detail.TypeChamp == 'IDENTIFICATION') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              comment: elt.Commentaire,
              value: elt.Identification,
              type: 'Identification',
            });
          });
        }

        if (detail.TypeChamp == 'CRYPTOMONNAIE') {
          detail.Valeur.forEach((elt) => {
            othersInfos.push({
              comment: elt.Commentaire,
              value: elt.Cryptomonnaie,
              type: 'Crypto',
            });
          });
        }
      });
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

    const sourceLinkFile = `${SOURCE_DIR}clean_DGT.json`;
    const writeStream = createWriteStream(sourceLinkFile);
    writeStream.write(JSON.stringify(finalData));
    writeStream.end();
  }

  async migrateSanctioned() {
    this.logger.log('migrationg DGT sanctioned Collection...');
    //Get the data from source file
    const { results } = await this.tools.downloadData('clean_DGT.json');

    //migrate  to MongoDB
    return await this.tools.migrate(results);
  }
}
