/**
 * Phone number utilities for format (xxx) xxx-xxxx
 */

export const PHONE_PATTERN = /^\(\d{3}\) \d{3}-\d{4}$/;

export function parseDigits(value) {
  if (!value || typeof value !== "string") return "";
  return value.replace(/\D/g, "");
}

/** Max digits stored for US-style (xxx) xxx-xxxx */
export const PHONE_MAX_DIGITS = 10;

/** Formatted string length: (555) 555-5555 */
export const PHONE_FORMATTED_MAX_LENGTH = 14;

export function formatPhone(value) {
  const digits = parseDigits(value).slice(0, PHONE_MAX_DIGITS);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, PHONE_MAX_DIGITS)}`;
}

export function isValidPhone(value) {
  const digits = parseDigits(value);
  return digits.length === PHONE_MAX_DIGITS;
}

export function phoneRule(value) {
  if (!value || !value.trim()) return true;
  const digits = parseDigits(value);
  if (digits.length > PHONE_MAX_DIGITS) {
    return "Phone must be (xxx) xxx-xxxx (10 digits)";
  }
  return isValidPhone(value) || "Phone must be (xxx) xxx-xxxx";
}

export function formatPhoneForDisplay(value) {
  if (!value) return "";
  const digits = parseDigits(value);
  if (digits.length === PHONE_MAX_DIGITS) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > PHONE_MAX_DIGITS) {
    const d = digits.slice(0, PHONE_MAX_DIGITS);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return value;
}
