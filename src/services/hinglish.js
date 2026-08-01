// Devanagari → Hinglish (romanized Hindi) transliterator.
// Converts Whisper's Hindi output ("क्या कर रहे हो") into the casual Roman
// spelling Indian audiences read every day ("kya kar rahe ho").
// Non-Devanagari text (English words mixed into speech) passes through as-is.

const CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ळ': 'l', 'ऱ': 'r', 'ऩ': 'n',
};

// Consonant + nukta (़) variants — NFC keeps these decomposed, so they are
// looked up as a two-character pair.
const NUKTA_CONSONANTS = {
  'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f', 'य': 'y',
};

const VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e',
};

const MATRAS = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e',
};

const DIGITS = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };

const VIRAMA = '्';
const NUKTA = '़';
const ANUSVARA = 'ं';
const CHANDRABINDU = 'ँ';
const VISARGA = 'ः';
const VOWEL_RE = /[aeiou]/;

function transliterateWord(word) {
  const chars = Array.from(word.normalize('NFC'));
  let out = '';
  let pendingA = false; // consonant awaiting its inherent 'a'

  const flushA = () => {
    if (pendingA) { out += 'a'; pendingA = false; }
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (CONSONANTS[ch]) {
      flushA();
      if (next === NUKTA && NUKTA_CONSONANTS[ch]) {
        out += NUKTA_CONSONANTS[ch];
        i++;
      } else {
        out += CONSONANTS[ch];
      }
      pendingA = true;
    } else if (MATRAS[ch]) {
      out += MATRAS[ch];
      pendingA = false;
    } else if (ch === VIRAMA) {
      pendingA = false;
    } else if (VOWELS[ch]) {
      flushA();
      out += VOWELS[ch];
    } else if (ch === ANUSVARA || ch === CHANDRABINDU) {
      flushA();
      // Word-final में → "mein" (not "men"); mid-word करेंगे → "karenge"
      if (next === undefined && out.endsWith('e') && !out.endsWith('ee')) out += 'in';
      else out += 'n';
    } else if (ch === VISARGA) {
      flushA();
      out += 'h';
    } else if (DIGITS[ch]) {
      flushA();
      out += DIGITS[ch];
    } else if (ch === '।' || ch === '॥') {
      flushA();
      out += '.';
    } else if (ch === NUKTA) {
      // stray nukta — ignore
    } else {
      // Latin letters, punctuation, anything else: pass through
      flushA();
      out += ch;
    }
  }

  // Word-final schwa deletion: कर → "kar" not "kara". Keep it for
  // single-consonant words (न → "na") which would otherwise lose their vowel.
  if (pendingA && !VOWEL_RE.test(out)) out += 'a';

  return out;
}

function toHinglish(text) {
  if (!text) return text;
  const clean = text.replace(/�/g, '');
  return clean.split(/(\s+)/).map(part => (/\s/.test(part) ? part : transliterateWord(part))).join('');
}

module.exports = { toHinglish };
