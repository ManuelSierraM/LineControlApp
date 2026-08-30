import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ITU country calling codes (E.164). Sorted longest-first so partial matches
// (e.g. "1" vs "1-268") are resolved in favour of the most specific code.
const COUNTRY_CODES = [
  "1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49",
  "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90",
  "91", "92", "93", "94", "95", "98", "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226",
  "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243",
  "244", "245", "246", "247", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261",
  "262", "263", "264", "265", "266", "267", "268", "269", "290", "291", "297", "298", "299", "350", "351", "352", "353",
  "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375", "376", "377", "378", "380", "381",
  "382", "383", "385", "386", "387", "389", "420", "421", "423", "500", "501", "502", "503", "504", "505", "506", "507",
  "508", "509", "590", "591", "592", "593", "594", "595", "596", "597", "598", "599", "670", "672", "673", "674", "675",
  "676", "677", "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692", "850",
  "852", "853", "855", "856", "880", "886", "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971",
  "972", "973", "974", "975", "976", "977", "992", "993", "994", "995", "996"
];

const SORTED_CODES = [...COUNTRY_CODES].sort((a, b) => b.length - a.length || Number(b) - Number(a));

const NATIONAL_MIN = 7;
const NATIONAL_MAX = 12;

/**
 * Normaliza un número de teléfono quitando prefijos internacionales y
 * el indicativo de país de cualquier país. Devuelve solo los dígitos del
 * número nacional. Si el valor contiene letras o no tiene dígitos, devuelve "".
 */
export function normalizePhone(p?: string | null): string {
  if (p == null) return "";
  const raw = String(p).trim();
  if (!raw) return "";
  if (/[a-zA-Z]/.test(raw)) return "";
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";

  // Detecta prefijo internacional explícito: +XX o 00XX
  const hasPlus = raw.startsWith("+");
  const hasDoubleZero = raw.startsWith("00");
  const explicito = hasPlus || hasDoubleZero;

  if (hasDoubleZero) digits = digits.slice(2);

  // Solo se quita el indicativo si el número viene con prefijo internacional
  // explícito (+ / 00) o si es más largo que un número nacional (>10 dígitos).
  if (!explicito && digits.length <= 10) return digits;

  for (const code of SORTED_CODES) {
    if (digits.startsWith(code) && digits.length > code.length) {
      const rest = digits.slice(code.length);
      if (rest.length >= NATIONAL_MIN && rest.length <= NATIONAL_MAX) {
        return rest;
      }
    }
  }

  // Si venía con "+" pero no logramos identificar un indicativo conocido,
  // devolvemos los dígitos tal cual (ya se quitó el "+").
  return digits;

}

/**
 * Versión de normalización para el cargue masivo: si el valor contiene letras
 * o caracteres inválidos, conserva el original para que las alertas de
 * "Líneas POPS Inconsistentes" puedan detectarlos; de lo contrario devuelve
 * los dígitos nacionales sin indicativo de país.
 */
export function coercePhone(p?: string | null): string | null {
  if (p == null) return null;
  const raw = String(p).trim();
  if (!raw) return null;
  if (/[a-zA-Z]/.test(raw)) return raw;
  const normalized = normalizePhone(raw);
  return normalized || raw;
}

/** Indica si una cadena de solo dígitos corresponde a un indicativo de país. */
export function isCountryCode(digits: string): boolean {
  return COUNTRY_CODES.includes(digits);
}
