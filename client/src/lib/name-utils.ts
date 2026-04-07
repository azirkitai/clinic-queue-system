const SEPARATORS = /\b(BIN|BINTI|A\/P|A\/L)\b/i;

function shortenName(name: string): string {
  if (!name) return '';
  const upper = name.trim().toUpperCase();

  const sepIndex = upper.search(SEPARATORS);
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
