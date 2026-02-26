import { describe, it, expect } from 'vitest';
import { computePairs, computeFallbacks, findBestMatchForTrip } from './matching';
import {
  withinOneHour, withinTwoHours,
  sameCampusAirport, sameUniversityAirport,
  genderCompatible, fitsCapacity,
  isLightBags, fitsGroupCapacity,
} from './utils';
import type { TripRequest } from './types';

// Helper to create a minimal TripRequest for testing
function makeTripRequest(overrides: Partial<TripRequest> & { id: string; userId: string }): TripRequest {
  return {
    university: 'Boston College',
    campusArea: 'Lower',
    departingAirport: 'BOS',
    flightCode: 'UA100',
    flightDateTime: '2026-03-01T10:00:00.000Z',
    numberOfCarryons: 1,
    numberOfCheckedBags: 1,
    userPreferences: 'No preference',
    userGender: 'Male',
    status: 'pending',
    matchId: null,
    matchedUserId: null,
    ...overrides,
  };
}

describe('withinOneHour', () => {
  it('returns true for flights 30 min apart', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', flightDateTime: '2026-03-01T10:00:00Z' });
    const b = makeTripRequest({ id: '2', userId: 'u2', flightDateTime: '2026-03-01T10:30:00Z' });
    expect(withinOneHour(a, b)).toBe(true);
  });

  it('returns true for flights exactly 1 hour apart', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', flightDateTime: '2026-03-01T10:00:00Z' });
    const b = makeTripRequest({ id: '2', userId: 'u2', flightDateTime: '2026-03-01T11:00:00Z' });
    expect(withinOneHour(a, b)).toBe(true);
  });

  it('returns false for flights 1h1m apart', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', flightDateTime: '2026-03-01T10:00:00Z' });
    const b = makeTripRequest({ id: '2', userId: 'u2', flightDateTime: '2026-03-01T11:01:00Z' });
    expect(withinOneHour(a, b)).toBe(false);
  });
});

describe('sameCampusAirport', () => {
  it('returns true for same university, campus, and airport', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', university: 'BC', campusArea: 'Lower', departingAirport: 'BOS' });
    const b = makeTripRequest({ id: '2', userId: 'u2', university: 'BC', campusArea: 'Lower', departingAirport: 'BOS' });
    expect(sameCampusAirport(a, b)).toBe(true);
  });

  it('returns false for different universities', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', university: 'BC' });
    const b = makeTripRequest({ id: '2', userId: 'u2', university: 'Vanderbilt' });
    expect(sameCampusAirport(a, b)).toBe(false);
  });

  it('returns false for different campus areas at same university', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', campusArea: 'Lower' });
    const b = makeTripRequest({ id: '2', userId: 'u2', campusArea: 'Newton' });
    expect(sameCampusAirport(a, b)).toBe(false);
  });

  it('returns false for different airports', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', departingAirport: 'BOS' });
    const b = makeTripRequest({ id: '2', userId: 'u2', departingAirport: 'JFK' });
    expect(sameCampusAirport(a, b)).toBe(false);
  });

  it('matches when one campus area is null', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', campusArea: 'Lower' });
    const b = makeTripRequest({ id: '2', userId: 'u2', campusArea: null });
    expect(sameCampusAirport(a, b)).toBe(true);
  });
});

describe('genderCompatible', () => {
  it('matches when both have no preference', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', userPreferences: 'No preference', userGender: 'Male' });
    const b = makeTripRequest({ id: '2', userId: 'u2', userPreferences: 'No preference', userGender: 'Female' });
    expect(genderCompatible(a, b)).toBe(true);
  });

  it('matches when preferences align', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', userPreferences: 'Female', userGender: 'Male' });
    const b = makeTripRequest({ id: '2', userId: 'u2', userPreferences: 'Male', userGender: 'Female' });
    expect(genderCompatible(a, b)).toBe(true);
  });

  it('rejects when preferences conflict', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', userPreferences: 'Female', userGender: 'Male' });
    const b = makeTripRequest({ id: '2', userId: 'u2', userPreferences: 'Female', userGender: 'Female' });
    expect(genderCompatible(a, b)).toBe(false);
  });

  it('matches when one has preference and other has no preference', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', userPreferences: 'Female', userGender: 'Male' });
    const b = makeTripRequest({ id: '2', userId: 'u2', userPreferences: 'No preference', userGender: 'Female' });
    expect(genderCompatible(a, b)).toBe(true);
  });
});

describe('fitsCapacity', () => {
  it('accepts 1+1 checked, 1+1 carry', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 1, numberOfCarryons: 1 });
    const b = makeTripRequest({ id: '2', userId: 'u2', numberOfCheckedBags: 1, numberOfCarryons: 1 });
    expect(fitsCapacity([a, b])).toBe(true);
  });

  it('accepts 2+1 checked, 0+1 carry (3 checked, 1 carry)', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 2, numberOfCarryons: 0 });
    const b = makeTripRequest({ id: '2', userId: 'u2', numberOfCheckedBags: 1, numberOfCarryons: 1 });
    expect(fitsCapacity([a, b])).toBe(true);
  });

  it('rejects 2+2 checked, 1+1 carry (4 checked exceeds all rules)', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 2, numberOfCarryons: 1 });
    const b = makeTripRequest({ id: '2', userId: 'u2', numberOfCheckedBags: 2, numberOfCarryons: 1 });
    expect(fitsCapacity([a, b])).toBe(false);
  });

  it('accepts 0+0 bags (well under capacity)', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 0, numberOfCarryons: 0 });
    const b = makeTripRequest({ id: '2', userId: 'u2', numberOfCheckedBags: 0, numberOfCarryons: 0 });
    expect(fitsCapacity([a, b])).toBe(true);
  });
});

describe('computePairs', () => {
  it('pairs two compatible riders', () => {
    const trips = [
      makeTripRequest({ id: '1', userId: 'u1' }),
      makeTripRequest({ id: '2', userId: 'u2' }),
    ];
    const { pairs, unmatched } = computePairs(trips);
    expect(pairs).toHaveLength(1);
    expect(unmatched).toHaveLength(0);
  });

  it('leaves a rider unmatched when no compatible partner exists', () => {
    const trips = [
      makeTripRequest({ id: '1', userId: 'u1', departingAirport: 'BOS' }),
      makeTripRequest({ id: '2', userId: 'u2', departingAirport: 'JFK' }),
      makeTripRequest({ id: '3', userId: 'u3', departingAirport: 'BOS' }),
    ];
    const { pairs, unmatched } = computePairs(trips);
    expect(pairs).toHaveLength(1);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].departingAirport).toBe('JFK');
  });

  it('handles empty input', () => {
    const { pairs, unmatched } = computePairs([]);
    expect(pairs).toHaveLength(0);
    expect(unmatched).toHaveLength(0);
  });

  it('handles single rider (no match possible)', () => {
    const trips = [makeTripRequest({ id: '1', userId: 'u1' })];
    const { pairs, unmatched } = computePairs(trips);
    expect(pairs).toHaveLength(0);
    expect(unmatched).toHaveLength(1);
  });

  it('prefers same flight code over different', () => {
    const trips = [
      makeTripRequest({ id: '1', userId: 'u1', flightCode: 'UA100' }),
      makeTripRequest({ id: '2', userId: 'u2', flightCode: 'UA100' }),
      makeTripRequest({ id: '3', userId: 'u3', flightCode: 'DL200' }),
    ];
    const { pairs } = computePairs(trips);
    expect(pairs).toHaveLength(1);
    // Both riders in the pair should have the same flight code
    const [a, b] = pairs[0];
    expect(a.flightCode).toBe('UA100');
    expect(b.flightCode).toBe('UA100');
  });

  it('respects baggage limits when pairing', () => {
    const trips = [
      makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 3, numberOfCarryons: 2 }),
      makeTripRequest({ id: '2', userId: 'u2', numberOfCheckedBags: 3, numberOfCarryons: 2 }),
    ];
    const { pairs, unmatched } = computePairs(trips);
    expect(pairs).toHaveLength(0);
    expect(unmatched).toHaveLength(2);
  });

  it('pairs riders from different campus areas separately', () => {
    const trips = [
      makeTripRequest({ id: '1', userId: 'u1', campusArea: 'Lower' }),
      makeTripRequest({ id: '2', userId: 'u2', campusArea: 'Newton' }),
      makeTripRequest({ id: '3', userId: 'u3', campusArea: 'Lower' }),
      makeTripRequest({ id: '4', userId: 'u4', campusArea: 'Newton' }),
    ];
    const { pairs } = computePairs(trips);
    expect(pairs).toHaveLength(2);
    for (const [a, b] of pairs) {
      expect(a.campusArea).toBe(b.campusArea);
    }
  });
});

// ==================== New utility tests ====================

describe('withinTwoHours', () => {
  it('returns true for flights 90 min apart', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', flightDateTime: '2026-03-01T10:00:00Z' });
    const b = makeTripRequest({ id: '2', userId: 'u2', flightDateTime: '2026-03-01T11:30:00Z' });
    expect(withinTwoHours(a, b)).toBe(true);
  });

  it('returns true for flights exactly 2 hours apart', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', flightDateTime: '2026-03-01T10:00:00Z' });
    const b = makeTripRequest({ id: '2', userId: 'u2', flightDateTime: '2026-03-01T12:00:00Z' });
    expect(withinTwoHours(a, b)).toBe(true);
  });

  it('returns false for flights 2h1m apart', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', flightDateTime: '2026-03-01T10:00:00Z' });
    const b = makeTripRequest({ id: '2', userId: 'u2', flightDateTime: '2026-03-01T12:01:00Z' });
    expect(withinTwoHours(a, b)).toBe(false);
  });
});

describe('sameUniversityAirport', () => {
  it('returns true for same university and airport, different campus', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', university: 'BC', campusArea: 'Lower', departingAirport: 'BOS' });
    const b = makeTripRequest({ id: '2', userId: 'u2', university: 'BC', campusArea: 'Newton', departingAirport: 'BOS' });
    expect(sameUniversityAirport(a, b)).toBe(true);
  });

  it('returns false for different universities', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', university: 'BC' });
    const b = makeTripRequest({ id: '2', userId: 'u2', university: 'Vanderbilt' });
    expect(sameUniversityAirport(a, b)).toBe(false);
  });

  it('returns false for different airports', () => {
    const a = makeTripRequest({ id: '1', userId: 'u1', departingAirport: 'BOS' });
    const b = makeTripRequest({ id: '2', userId: 'u2', departingAirport: 'JFK' });
    expect(sameUniversityAirport(a, b)).toBe(false);
  });
});

describe('isLightBags', () => {
  it('returns true for 1 checked, 1 carry', () => {
    const t = makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 1, numberOfCarryons: 1 });
    expect(isLightBags(t)).toBe(true);
  });

  it('returns true for 0 bags', () => {
    const t = makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 0, numberOfCarryons: 0 });
    expect(isLightBags(t)).toBe(true);
  });

  it('returns false for 2 checked bags', () => {
    const t = makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 2, numberOfCarryons: 0 });
    expect(isLightBags(t)).toBe(false);
  });

  it('returns false for 2 carry-ons', () => {
    const t = makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 0, numberOfCarryons: 2 });
    expect(isLightBags(t)).toBe(false);
  });
});

describe('fitsGroupCapacity', () => {
  it('accepts 3 riders with 1 checked each, 1 carry each', () => {
    const riders = [
      makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
      makeTripRequest({ id: '2', userId: 'u2', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
      makeTripRequest({ id: '3', userId: 'u3', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
    ];
    expect(fitsGroupCapacity(riders)).toBe(true);
  });

  it('rejects group exceeding capacity', () => {
    const riders = [
      makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 2, numberOfCarryons: 1 }),
      makeTripRequest({ id: '2', userId: 'u2', numberOfCheckedBags: 2, numberOfCarryons: 1 }),
      makeTripRequest({ id: '3', userId: 'u3', numberOfCheckedBags: 2, numberOfCarryons: 1 }),
    ];
    expect(fitsGroupCapacity(riders)).toBe(false);
  });
});

// ==================== computeFallbacks tests ====================

describe('computeFallbacks', () => {
  it('Tier 1: groups 3 light-bag riders together', () => {
    const riders = [
      makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
      makeTripRequest({ id: '2', userId: 'u2', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
      makeTripRequest({ id: '3', userId: 'u3', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
    ];
    const result = computeFallbacks(riders, riders);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toHaveLength(3);
  });

  it('Tier 2: suggests XL for heavy-bag riders', () => {
    const riders = [
      makeTripRequest({ id: '1', userId: 'u1', numberOfCheckedBags: 3, numberOfCarryons: 2 }),
    ];
    const result = computeFallbacks(riders, riders);
    expect(result.xlSuggested).toHaveLength(1);
    expect(result.xlSuggested[0].id).toBe('1');
  });

  it('Tier 3: matches across campus areas', () => {
    const riders = [
      makeTripRequest({ id: '1', userId: 'u1', campusArea: 'Lower', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
      makeTripRequest({ id: '2', userId: 'u2', campusArea: 'Newton', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
    ];
    const result = computeFallbacks(riders, riders);
    expect(result.relaxedCampusPairs).toHaveLength(1);
  });

  it('Tier 4: matches with 2-hour time window', () => {
    const riders = [
      makeTripRequest({ id: '1', userId: 'u1', flightDateTime: '2026-03-01T10:00:00Z', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
      makeTripRequest({ id: '2', userId: 'u2', flightDateTime: '2026-03-01T11:30:00Z', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
    ];
    const result = computeFallbacks(riders, riders);
    expect(result.relaxedTimePairs).toHaveLength(1);
  });

  it('Tier 5: warns riders with flight <3h away', () => {
    const soon = new Date(Date.now() + 2 * 3600_000).toISOString(); // 2h from now
    const riders = [
      makeTripRequest({ id: '1', userId: 'u1', flightDateTime: soon, departingAirport: 'JFK', numberOfCheckedBags: 1, numberOfCarryons: 1 }),
    ];
    const result = computeFallbacks(riders, riders);
    expect(result.noMatchWarnings).toHaveLength(1);
  });
});

// ==================== findBestMatchForTrip tests ====================

describe('findBestMatchForTrip', () => {
  it('finds a compatible match from the pool', () => {
    const trip = makeTripRequest({ id: '1', userId: 'u1' });
    const pool = [
      makeTripRequest({ id: '2', userId: 'u2' }),
      makeTripRequest({ id: '3', userId: 'u3', departingAirport: 'JFK' }),
    ];
    const result = findBestMatchForTrip(trip, pool);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('2');
  });

  it('returns null when no compatible match exists', () => {
    const trip = makeTripRequest({ id: '1', userId: 'u1', departingAirport: 'BOS' });
    const pool = [
      makeTripRequest({ id: '2', userId: 'u2', departingAirport: 'JFK' }),
    ];
    const result = findBestMatchForTrip(trip, pool);
    expect(result).toBeNull();
  });

  it('skips self in pool', () => {
    const trip = makeTripRequest({ id: '1', userId: 'u1' });
    const pool = [trip];
    const result = findBestMatchForTrip(trip, pool);
    expect(result).toBeNull();
  });

  it('prefers same flight code', () => {
    const trip = makeTripRequest({ id: '1', userId: 'u1', flightCode: 'UA100' });
    const pool = [
      makeTripRequest({ id: '2', userId: 'u2', flightCode: 'DL200' }),
      makeTripRequest({ id: '3', userId: 'u3', flightCode: 'UA100' }),
    ];
    const result = findBestMatchForTrip(trip, pool);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('3');
  });
});
