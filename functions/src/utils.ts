// functions/src/utils.ts
import { TripRequest, BAG_CAPACITY } from './types';

const toMs = (iso: string) => new Date(iso).getTime();

export const withinOneHour = (a: TripRequest, b: TripRequest) =>
  Math.abs(toMs(a.flightDateTime) - toMs(b.flightDateTime)) <= 60 * 60 * 1000;

export const sameCampusAirport = (a: TripRequest, b: TripRequest) => {
  if (a.university !== b.university) return false;
  if (a.campusArea && b.campusArea && a.campusArea !== b.campusArea) return false;
  return a.departingAirport === b.departingAirport;
};

export function genderCompatible(a: TripRequest, b: TripRequest): boolean {
  const aPref = a.userPreferences;
  const bPref = b.userPreferences;
  const aGender = a.userGender;
  const bGender = b.userGender;

  const aWants = aPref === 'No preference' || (!!bGender && aPref === bGender);
  const bWants = bPref === 'No preference' || (!!aGender && bPref === aGender);

  if (aPref !== 'No preference' && bPref !== 'No preference' && !!aGender && !!bGender) {
    return aPref === bGender && bPref === aGender;
  }
  return aWants && bWants;
}

export const fitsCapacity = (pair: TripRequest[]) => {
  const checked = pair.reduce((s, t) => s + (t.numberOfCheckedBags || 0), 0);
  const carry   = pair.reduce((s, t) => s + (t.numberOfCarryons || 0), 0);
  return BAG_CAPACITY.some((rule: { checked: number; carry: number }) => checked <= rule.checked && carry <= rule.carry);
};
