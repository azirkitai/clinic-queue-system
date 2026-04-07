const SEPARATOR_LIST = [
  'BINTI', 'BIN', 'BTE', 'BT', 'B.',
  'A/P', 'A/L', 'A.P', 'A.L',
  'S/O', 'D/O',
];

function findSeparatorIndex(name: string): number {
  const upper = name.toUpperCase();
  const words = upper.split(/\s+/);

  let pos = 0;
  for (let i = 0; i < words.length; i++) {
    if (i > 0) {
      const word = words[i];
      for (const sep of SEPARATOR_LIST) {
        if (word === sep) {
          return pos;
        }
      }
    }
    pos += words[i].length + 1;
  }
  return -1;
}

function shortenName(name: string): string {
  if (!name) return '';
  const upper = name.trim().toUpperCase();

  const sepIndex = findSeparatorIndex(upper);
  if (sepIndex > 0) {
    return upper.substring(0, sepIndex).trim();
  }

  const words = upper.split(/\s+/);
  if (words.length > 2) {
    return words.slice(0, 2).join(' ');
  }

  return upper;
}

export function getDisplayName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  const trimmed = fullName.trim().toUpperCase();

  const boMatch = trimmed.match(/^B\/O\s+(.+)/i);
  if (boMatch) {
    return `B/O ${shortenName(boMatch[1])}`;
  }

  return shortenName(trimmed);
}

export function getTtsName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();

  const boMatch = trimmed.match(/^B\/O\s+(.+)/i);
  if (boMatch) {
    return `Baby off ${boMatch[1].trim()}`;
  }

  return trimmed;
}
