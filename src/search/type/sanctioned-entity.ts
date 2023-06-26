import { DateObject } from "@prisma/client";

export type Country = {
  country: string;
  isoCode: string;
};

export type Sanction = {
  id: string;
  name: string;
};

export type PlaceOfBirth = {
  country: Country
};


export class SanctionedEntity {
  id: string;
  defaultName: string;
  type: string;
  sanction: Sanction;
  dateOfBirth?: DateObject[];
  placeOfBirth?: PlaceOfBirth[];
  nationalities?: Country[];
  citizenships?: Country[];
}
