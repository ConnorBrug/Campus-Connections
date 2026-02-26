// Centralized university configuration.
// Add new universities here — the rest of the app reads from this config.

export interface UniversityConfig {
  name: string;
  emailDomain: string;
  /** If set, users must select a campus area from this list. */
  campusAreas?: string[];
}

export const UNIVERSITIES: UniversityConfig[] = [
  {
    name: 'Boston College',
    emailDomain: '@bc.edu',
    campusAreas: ['2k', 'Newton', 'CoRo/Upper', 'Lower'],
  },
  {
    name: 'Vanderbilt',
    emailDomain: '@vanderbilt.edu',
  },
];

/** Map email domain to university name. Returns null if not recognized. */
export function emailToUniversityName(email: string): string | null {
  const lower = (email || '').toLowerCase();
  for (const uni of UNIVERSITIES) {
    if (lower.endsWith(uni.emailDomain)) return uni.name;
  }
  if (process.env.NODE_ENV === 'development' && lower.endsWith('@gmail.com')) {
    return 'CollegeU';
  }
  return null;
}

/** Returns the config for a given university name, or undefined. */
export function getUniversityConfig(name: string): UniversityConfig | undefined {
  return UNIVERSITIES.find((u) => u.name === name);
}

/** Returns true if the given university requires a campus area selection. */
export function requiresCampusArea(universityName: string): boolean {
  const config = getUniversityConfig(universityName);
  return !!config?.campusAreas?.length;
}

/** All university names as a tuple for Zod enums. */
export const UNIVERSITY_NAMES = UNIVERSITIES.map((u) => u.name) as [string, ...string[]];
