/** One segment: first character upper, rest lower (handles O'Brien-style apostrophes in the tail). */
function capitalizeSegment(seg) {
  if (!seg) return seg;
  return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
}

/** Each whitespace-separated word; hyphenated parts (e.g. Smith-Jones) formatted per segment. */
export function toProperNameCase(s) {
  if (s == null || s === "") return "";
  const str = String(s).trim();
  if (!str) return "";
  return str
    .split(/\s+/)
    .map((w) => w.split("-").map(capitalizeSegment).join("-"))
    .join(" ");
}
