export default class Utils {
  static formatDate = (dateStr) => {
    if (!dateStr) return "–";
    try {
      const d = new Date(dateStr + "T12:00:00");
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const y = d.getFullYear();
      return `${m}-${day}-${y}`;
    } catch {
      return dateStr;
    }
  };

  static setStore = (name, content) => {
    if (!name) return;
    if (typeof content !== "string") content = JSON.stringify(content);
    return window.localStorage.setItem(name, content);
  };
  static getStore = (name) => {
    if (!name) return;
    return JSON.parse(window.localStorage.getItem(name));
  };
  static removeItem = (name) => {
    if (!name) return;
    return window.localStorage.removeItem(name);
  };

  /** Tenant org id: superadmin uses acting org when set; otherwise user's org. */
  static effectiveOrganizationId = (user) => {
    if (!user) return null;
    if (user.role === "superadmin") {
      if (user.actingOrganizationId === undefined) {
        return user.organizationId ?? user.organization?.id ?? null;
      }
      if (user.actingOrganizationId === null || user.actingOrganizationId === "") {
        return null;
      }
      return user.actingOrganizationId;
    }
    return user.organizationId ?? user.organization?.id ?? null;
  };

  /** Query params for GET clients (matches backend tenant scope + superadmin acting org). */
  static getClientListQueryParams = (user) => {
    if (!user) return {};
    if (user.role === "superadmin") {
      if (user.actingOrganizationId === null || user.actingOrganizationId === "") {
        return {};
      }
      if (user.actingOrganizationId !== undefined && user.actingOrganizationId != null) {
        return { organizationId: user.actingOrganizationId };
      }
    }
    const orgId = user.organizationId ?? user.organization?.id;
    return orgId ? { organizationId: orgId } : { userId: user.userId ?? user.id };
  };
}
