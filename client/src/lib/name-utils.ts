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

function isRealWord(word: string): boolean {
  if (!word) return false;
  if (word === '.') return false;
  if (word.length === 1 && /[A-Z]/i.test(word)) return false;
  if (word.length === 2 && word[1] === '.' && /[A-Z]/i.test(word[0])) return false;
  return true;
}

function shortenName(name: string): string {
  if (!name) return '';
  const upper = name.trim().toUpperCase();

  const sepIndex = findSeparatorIndex(upper);
  if (sepIndex > 0) {
    return upper.substring(0, sepIndex).trim();
  }

  const words = upper.split(/\s+/);
  let realWordCount = 0;
  let cutIndex = words.length;
  for (let i = 0; i < words.length; i++) {
    if (isRealWord(words[i])) {
      realWordCount++;
      if (realWordCount === 2) {
        cutIndex = i + 1;
        while (cutIndex < words.length && !isRealWord(words[cutIndex])) {
          cutIndex++;
        }
        break;
      }
    }
  }

  if (realWordCount >= 2 && cutIndex < words.length) {
    return words.slice(0, cutIndex).join(' ');
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

const TTS_REPLACEMENTS_MS: Record<string, string> = {
  'A/P': 'anak perempuan',
  'A.P': 'anak perempuan',
  'A/L': 'anak lelaki',
  'A.L': 'anak lelaki',
  'S/O': 'anak lelaki',
  'D/O': 'anak perempuan',
};

const TTS_REPLACEMENTS_EN: Record<string, string> = {
  'A/P': 'daughter off',
  'A.P': 'daughter off',
  'A/L': 'son off',
  'A.L': 'son off',
  'S/O': 'son off',
  'D/O': 'daughter off',
};

export function getTtsName(fullName: string | null | undefined, lang?: 'ms-MY' | 'en-US'): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();

  const boMatch = trimmed.match(/^B\/O\s+(.+)/i);
  if (boMatch) {
    return `Baby off ${boMatch[1].trim()}`;
  }

  const replacements = lang === 'en-US' ? TTS_REPLACEMENTS_EN : TTS_REPLACEMENTS_MS;
  const upper = trimmed.toUpperCase();
  const words = upper.split(/\s+/);
  const originalWords = trimmed.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    if (replacements[words[i]]) {
      originalWords[i] = replacements[words[i]];
    }
  }

  return originalWords.join(' ');
}
