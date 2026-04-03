import Utils from "../config/utils.js";

function fallbackOrgFromSession() {
  const u = Utils.getStore("user");
  if (u?.role === "superadmin" && u.actingOrganizationId != null && u.actingOrganizationId !== "") {
    return Number(u.actingOrganizationId);
  }
  if (u?.organizationId != null && u.organizationId !== "") {
    return Number(u.organizationId);
  }
  return null;
}

/** Add Client: scope list values to the intake location's org, then session. */
export function organizationIdForAddClientLookups(intakeLocationId, intakeLocations) {
  if (intakeLocationId != null && Array.isArray(intakeLocations)) {
    const loc = intakeLocations.find((l) => l.id === intakeLocationId);
    if (loc?.organizationId != null && loc.organizationId !== "") {
      return Number(loc.organizationId);
    }
  }
  return fallbackOrgFromSession();
}

/** Edit / view client: use the client's org (lookup FKs belong there), then fallbacks. */
export function organizationIdForClientRecordLookups(client, intakeLocations) {
  if (client?.organizationId != null && client.organizationId !== "") {
    return Number(client.organizationId);
  }
  if (client?.intakeLocationId != null && Array.isArray(intakeLocations)) {
    const loc = intakeLocations.find((l) => l.id === client.intakeLocationId);
    if (loc?.organizationId != null && loc.organizationId !== "") {
      return Number(loc.organizationId);
    }
  }
  return fallbackOrgFromSession();
}

export function lookupQueryOpts(orgId) {
  if (orgId != null && !Number.isNaN(orgId)) {
    return { organizationId: orgId };
  }
  return {};
}
