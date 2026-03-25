export interface Region {
  code: string;
  name: string;
}

export const REGIONS: Record<string, Region> = {
  kyiv: { code: "kyiv", name: "Київ" },
  "kyiv-region": { code: "kyiv-region", name: "Київщина" },
  dnipro: { code: "dnipro", name: "Дніпропетровщина" },
  odesa: { code: "odesa", name: "Одещина" },
};

// Standard queues for all regions
export const STANDARD_QUEUES = [
  "1.1", "1.2",
  "2.1", "2.2",
  "3.1", "3.2",
  "4.1", "4.2",
  "5.1", "5.2",
  "6.1", "6.2",
] as const;

// Additional queues for Kyiv only
export const KYIV_EXTRA_QUEUES = [
  "7.1", "8.1", "9.1", "10.1", "11.1", "12.1",
  "13.1", "14.1", "15.1", "16.1", "17.1", "18.1",
  "19.1", "20.1", "21.1", "22.1", "23.1", "24.1",
  "25.1", "26.1", "27.1", "28.1", "29.1", "30.1",
  "31.1", "32.1", "33.1", "34.1", "35.1", "36.1",
  "37.1", "38.1", "39.1", "40.1", "41.1", "42.1",
  "43.1", "44.1", "45.1", "46.1", "47.1", "48.1",
  "49.1", "50.1", "51.1", "52.1", "53.1", "54.1",
  "55.1", "56.1", "57.1", "58.1", "59.1", "60.1",
] as const;

export function getQueuesForRegion(regionCode: string): string[] {
  const standard = [...STANDARD_QUEUES];
  if (regionCode === "kyiv") {
    return [...standard, ...KYIV_EXTRA_QUEUES];
  }
  return standard;
}

export function getRegionName(regionCode: string): string {
  return REGIONS[regionCode]?.name ?? regionCode;
}

export function isValidRegion(regionCode: string): boolean {
  return regionCode in REGIONS;
}

export function isValidQueue(regionCode: string, queue: string): boolean {
  const queues = getQueuesForRegion(regionCode);
  return queues.includes(queue);
}
