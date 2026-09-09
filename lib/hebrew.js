// Hebrew calendar date with traditional letter numerals.
//
// Intl gives us the calendar and the month names, but Chrome ignores the
// "hebr" numbering system and falls back to Latin digits, so the numerals are
// converted here.

const HUNDREDS = [
  [400, "ת"],
  [300, "ש"],
  [200, "ר"],
  [100, "ק"],
];

const TENS = [
  [90, "צ"],
  [80, "פ"],
  [70, "ע"],
  [60, "ס"],
  [50, "נ"],
  [40, "מ"],
  [30, "ל"],
  [20, "כ"],
  [10, "י"],
];

const ONES = [
  [9, "ט"],
  [8, "ח"],
  [7, "ז"],
  [6, "ו"],
  [5, "ה"],
  [4, "ד"],
  [3, "ג"],
  [2, "ב"],
  [1, "א"],
];

const GERESH = "׳"; // ׳ — marks a single letter used as a number
const GERSHAYIM = "״"; // ״ — sits before the last letter of a longer number

function letters(value) {
  let out = "";
  let rest = value;

  while (rest >= 400) {
    out += "ת";
    rest -= 400;
  }

  for (const [amount, letter] of HUNDREDS) {
    if (rest >= amount) {
      out += letter;
      rest -= amount;
    }
  }

  // 15 and 16 are written טו and טז, never with yod, which would spell a
  // divine name.
  if (rest === 15) return `${out}טו`;
  if (rest === 16) return `${out}טז`;

  for (const [amount, letter] of TENS) {
    if (rest >= amount) {
      out += letter;
      rest -= amount;
      break;
    }
  }

  for (const [amount, letter] of ONES) {
    if (rest >= amount) {
      out += letter;
      rest -= amount;
      break;
    }
  }

  return out;
}

export function toHebrewNumeral(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return String(value);

  const text = letters(Math.trunc(number));
  if (!text) return String(value);
  if (text.length === 1) return text + GERESH;

  return text.slice(0, -1) + GERSHAYIM + text.slice(-1);
}

// e.g. "כ״ט בחשוון תשפ״ז"
export function hebrewDate(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat("he-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).formatToParts(date);

    return parts
      .map((part) => {
        if (part.type === "day") return toHebrewNumeral(part.value);
        // Years are written without the thousands, so 5787 becomes תשפ״ז.
        if (part.type === "year") return toHebrewNumeral(Number(part.value) % 1000);
        return part.value;
      })
      .join("");
  } catch {
    return null;
  }
}
