export type Language = "en" | "de";

/**
 * Default storey names. Ground floor first, then numbered upper floors.
 * The full translation layer arrives with the UI; this is the part the
 * store needs today.
 */
export function defaultStoreyName(index: number, language: Language): string {
  if (language === "de") {
    return index === 0 ? "Erdgeschoss" : `${index}. Obergeschoss`;
  }
  if (index === 0) return "Ground floor";
  return `${ordinal(index)} floor`;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
