/**
 * Phone number utilities for format (xxx) xxx-xxxx
 */

export const PHONE_PATTERN = /^\(\d{3}\) \d{3}-\d{4}$/;

export function parseDigits(value) {
  if (!value || typeof value !== "string") return "";
  return value.replace(/\D/g, "");
}

export function formatPhone(value) {
  const digits = parseDigits(value);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function isValidPhone(value) {
  const digits = parseDigits(value);
  return digits.length === 10;
}

export function phoneRule(value) {
  if (!value || !value.trim()) return true;
  return isValidPhone(value) || "Phone must be (xxx) xxx-xxxx";
}

export function formatPhoneForDisplay(value) {
  if (!value) return "";
  const digits = parseDigits(value);
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
