export const MS_SEEDED_KEY = "lifepet:demo:ms:seeded:v1";

export function msKey(name: string) {
  return `lifepet:demo:ms:${name}`;
}

export function msSamplesKey(subjectId: string) {
  return msKey(`samples:${subjectId}`);
}

