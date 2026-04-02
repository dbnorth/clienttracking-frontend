/** Shown in place of legal first name when set (nickname / goes by). */
export const clientDisplayFirst = (c) => {
  if (!c) return "";
  const nick = (c.nickname || "").trim();
  if (nick) return nick;
  return (c.firstName || "").trim();
};

/**
 * Full name for lists, autocomplete, headers: uses nickname instead of first name when present.
 */
export const getClientFullDisplayName = (c) => {
  if (!c) return "";
  const first = clientDisplayFirst(c);
  const parts = [first, c.middleName, c.lastName, c.suffix].filter((p) => p && String(p).trim());
  const s = parts.join(" ").trim();
  return s || (c.id != null ? `#${c.id}` : "");
};
