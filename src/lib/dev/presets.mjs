/**
 * Dev-only: scripted matching scenarios for repeatable end-to-end testing.
 *
 * Every preset returns an array of "trip specs" - plain data objects that the
 * seed script or the /api/dev/seed-preset route will turn into real
 * /users/{uid} + /tripRequests/{id} docs (both flagged `synthetic: true`).
 *
 * NOT imported from any production code path. Only the seed script and the
 * dev-only /api/dev/seed-preset route touch this file.
 *
 * Design rules:
 * - Flight times are expressed as **minutes offset from a base Date** so the
 *   same preset can be re-run at any wall clock.
 * - `userId` is left undefined; the seed writer picks one using a known prefix
 *   so cleanup can mass-delete everything synthetic.
 * - Every field matches the TripRequest shape in src/lib/types.ts. Keep this
 *   file in sync if that shape changes.
 */

/**
 * @typedef {object} TripSpec
 * @property {string} userName
 * @property {'Male'|'Female'|'Other'|'Prefer not to say'} userGender
 * @property {'Male'|'Female'|'No preference'} userPreferences
 * @property {string} university
 * @property {string|null} campusArea
 * @property {string} departingAirport
 * @property {string} flightCode
 * @property {number} offsetMinutes
 * @property {number} numberOfCarryons
 * @property {number} numberOfCheckedBags
 * @property {number} [graduationYear]
 */

/** Deterministic id that we can look up / clean up easily. */
function synthId(prefix, i) {
  return `synthetic-${prefix}-${i}`;
}

/** Boston College campus areas (mirrors universities.ts). */
const BC_AREAS = ['2k', 'Newton', 'CoRo/Upper', 'Lower'];

/**
 * Two riders on the same flight, compatible gender prefs, moderate bags.
 * Expected: one `standard` pair.
 */
function sameFlightPair() {
  return [
    {
      userName: 'Alex Ramos',
      userGender: 'Male',
      userPreferences: 'No preference',
      university: 'Boston College',
      campusArea: '2k',
      departingAirport: 'BOS',
      flightCode: 'DL1234',
      offsetMinutes: 0,
      numberOfCarryons: 1,
      numberOfCheckedBags: 1,
    },
    {
      userName: 'Jordan Park',
      userGender: 'Male',
      userPreferences: 'No preference',
      university: 'Boston College',
      campusArea: '2k',
      departingAirport: 'BOS',
      flightCode: 'DL1234',
      offsetMinutes: 0,
      numberOfCarryons: 1,
      numberOfCheckedBags: 1,
    },
  ];
}

/**
 * Four riders, same flight, all light bags, same campus.
 * Expected: one `group` match (tier=group).
 */
function groupOfFourLight() {
  const base = {
    university: 'Boston College',
    campusArea: 'Lower',
    departingAirport: 'BOS',
    flightCode: 'UA456',
    offsetMinutes: 0,
    numberOfCarryons: 1,
    numberOfCheckedBags: 1,
    userPreferences: 'No preference',
  };
  return [
    { ...base, userName: 'Sam Lee',     userGender: 'Female' },
    { ...base, userName: 'Riley Cohen', userGender: 'Female' },
    { ...base, userName: 'Quinn Davis', userGender: 'Female' },
    { ...base, userName: 'Morgan Tan',  userGender: 'Female' },
  ];
}

/**
 * Three riders with too many bags for a standard pair but no XL option.
 * Expected: `xl-suggested` fallback tier - riders get the suggestion email
 * but remain pending.
 */
function xlHeavyTrio() {
  const base = {
    university: 'Boston College',
    campusArea: 'Newton',
    departingAirport: 'BOS',
    flightCode: 'AA789',
    offsetMinutes: 0,
    userPreferences: 'No preference',
  };
  return [
    { ...base, userName: 'Casey Brown',  userGender: 'Male',   numberOfCarryons: 2, numberOfCheckedBags: 2 },
    { ...base, userName: 'Taylor Adams', userGender: 'Female', numberOfCarryons: 2, numberOfCheckedBags: 2 },
    { ...base, userName: 'Drew Khan',    userGender: 'Other',  numberOfCarryons: 2, numberOfCheckedBags: 2 },
  ];
}

/**
 * Two riders, mutually incompatible gender prefs.
 * Expected: fallback to `relaxed-gender` only if no preferred candidate
 * appears within the window.
 */
function genderIncompatible() {
  return [
    {
      userName: 'Blake Singh',
      userGender: 'Male',
      userPreferences: 'Female',
      university: 'Boston College',
      campusArea: '2k',
      departingAirport: 'BOS',
      flightCode: 'B6101',
      offsetMinutes: 0,
      numberOfCarryons: 1,
      numberOfCheckedBags: 1,
    },
    {
      userName: 'Cameron OBrien',
      userGender: 'Male',
      userPreferences: 'No preference',
      university: 'Boston College',
      campusArea: '2k',
      departingAirport: 'BOS',
      flightCode: 'B6101',
      offsetMinutes: 0,
      numberOfCarryons: 1,
      numberOfCheckedBags: 1,
    },
  ];
}

/**
 * Two riders ~90 minutes apart, same campus. Expected: NOT paired under
 * standard rules (withinOneHour fails), but picked up by `relaxed-time`
 * fallback in the 2-hour window.
 */
function twoHourGapFallback() {
  const base = {
    university: 'Boston College',
    campusArea: 'CoRo/Upper',
    departingAirport: 'BOS',
    flightCode: 'WN202',
    userPreferences: 'No preference',
    numberOfCarryons: 0,
    numberOfCheckedBags: 1,
  };
  return [
    { ...base, userName: 'Emerson Rossi', userGender: 'Other',  offsetMinutes: -45 },
    { ...base, userName: 'Finley Garcia', userGender: 'Female', offsetMinutes: +45 },
  ];
}

/**
 * Two riders, same airport, different campuses (2k vs Newton). Standard pairs
 * require same campus; expected: `relaxed-campus` fallback.
 */
function relaxedCampusFallback() {
  const base = {
    university: 'Boston College',
    departingAirport: 'BOS',
    flightCode: 'AS303',
    offsetMinutes: 0,
    userPreferences: 'No preference',
    numberOfCarryons: 1,
    numberOfCheckedBags: 1,
  };
  return [
    { ...base, userName: 'Hayden Smith',  userGender: 'Male',   campusArea: '2k' },
    { ...base, userName: 'Jamie Nguyen',  userGender: 'Female', campusArea: 'Newton' },
  ];
}

/**
 * One lone rider inside the pairing window - nobody to match with.
 * Expected: `noMatchWarningSent: true` flag set after fallback tier 5.
 */
function noMatchWarning() {
  return [
    {
      userName: 'Avery Patel',
      userGender: 'Female',
      userPreferences: 'No preference',
      university: 'Boston College',
      campusArea: '2k',
      departingAirport: 'BOS',
      flightCode: 'DL1234',
      offsetMinutes: 0,
      numberOfCarryons: 1,
      numberOfCheckedBags: 1,
    },
  ];
}

/**
 * One pair compatible in all respects + a lonely heavy-bag third person.
 * Expected: the pair gets a `standard` match; the third gets xl-suggested.
 */
function mixedPairPlusXL() {
  return [
    ...sameFlightPair(),
    {
      userName: 'Reed Martinez',
      userGender: 'Female',
      userPreferences: 'No preference',
      university: 'Boston College',
      campusArea: '2k',
      departingAirport: 'BOS',
      flightCode: 'DL1234',
      offsetMinutes: +15,
      numberOfCarryons: 3,
      numberOfCheckedBags: 3,
    },
  ];
}

/**
 * Registry of all available presets. Keyed by CLI-friendly slugs.
 * Keep this sorted alphabetically by key for UX in the dev dashboard.
 */
export const PRESETS = {
  'gender-incompatible':    { label: 'Gender-incompatible pair',       specs: genderIncompatible },
  'group-of-4-light':       { label: 'Group of 4 (light bags)',        specs: groupOfFourLight },
  'mixed-pair-plus-xl':     { label: 'Pair + one heavy rider (XL)',    specs: mixedPairPlusXL },
  'no-match-warning':       { label: 'Lone rider (no-match warning)',  specs: noMatchWarning },
  'relaxed-campus':         { label: 'Different campus fallback',      specs: relaxedCampusFallback },
  'same-flight-pair':       { label: 'Same-flight standard pair',      specs: sameFlightPair },
  'two-hour-gap':           { label: '90-min gap (relaxed-time)',      specs: twoHourGapFallback },
  'xl-heavy-trio':          { label: 'Heavy trio -> XL-suggested',     specs: xlHeavyTrio },
};

/**
 * Materialize a preset into concrete docs ready to write.
 *
 * @param {keyof typeof PRESETS} key
 * @param {Date} baseTime  The "flight baseline"; specs add offsetMinutes to this.
 * @param {string} runId   A short id that scopes all uids in this seeding (so
 *                          repeated preset runs don't clobber each other).
 * @returns {{
 *   users: Array<Record<string, unknown> & { id: string }>,
 *   trips: Array<Record<string, unknown>>
 * }}
 */
export function materializePreset(key, baseTime, runId) {
  const preset = PRESETS[key];
  if (!preset) throw new Error(`Unknown preset: ${key}`);
  const specs = preset.specs();

  const users = [];
  const trips = [];

  // Stable user IDs per (preset, index): re-seeding the same preset reuses
  // the same synthetic uids so cross-browser chat testing works (both browsers
  // impersonate the same uid from their respective runs). The runId param is
  // kept for signature compatibility with older callers.
  void runId;
  specs.forEach((spec, i) => {
    const userId = synthId(key, i);
    const email = `${userId}@example.test`.toLowerCase();
    const flightDt = new Date(baseTime.getTime() + spec.offsetMinutes * 60_000);

    users.push({
      id: userId,
      synthetic: true,
      name: spec.userName,
      email,
      university: spec.university,
      gender: spec.userGender,
      graduationYear: spec.graduationYear ?? 2027,
      emailVerified: true,
      isBanned: false,
      ...(spec.campusArea ? { campusArea: spec.campusArea } : {}),
    });

    trips.push({
      synthetic: true,
      presetKey: key,
      userId,
      userName: spec.userName,
      userEmail: email,
      userPhotoUrl: null,
      university: spec.university,
      campusArea: spec.campusArea ?? null,
      departingAirport: spec.departingAirport,
      flightCode: spec.flightCode,
      flightDateTime: flightDt.toISOString(),
      flightDate: flightDt.toISOString().slice(0, 10),
      flightTime: flightDt.toTimeString().slice(0, 5),
      numberOfCarryons: spec.numberOfCarryons,
      numberOfCheckedBags: spec.numberOfCheckedBags,
      userPreferences: spec.userPreferences,
      userGender: spec.userGender,
      status: 'pending',
      matchId: null,
      matchedUserId: null,
    });
  });

  return { users, trips };
}
