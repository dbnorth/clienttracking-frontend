import apiClient from "./services.js";
import Utils from "../config/utils.js";

const formDataTransform = (data, headers) => {
  const user = Utils.getStore("user");
  if (user?.token) headers["Authorization"] = "Bearer " + user.token;
  if (user?.role === "superadmin" && user.actingOrganizationId != null && user.actingOrganizationId !== "") {
    headers["X-Acting-Organization-Id"] = String(user.actingOrganizationId);
  }
  if (data instanceof FormData) {
    delete headers["Content-Type"];
    return data;
  }
  return data ? JSON.stringify(data) : data;
};

export default {
  list(clientId) {
    return apiClient.get(`/clients/${clientId}/documents`);
  },
  create(clientId, formData) {
    return apiClient.post(`/clients/${clientId}/documents`, formData, {
      transformRequest: [formDataTransform],
    });
  },
  update(clientId, documentId, formData) {
    return apiClient.put(`/clients/${clientId}/documents/${documentId}`, formData, {
      transformRequest: [formDataTransform],
    });
  },
  remove(clientId, documentId) {
    return apiClient.delete(`/clients/${clientId}/documents/${documentId}`);
  },
  /**
   * Decrypted file bytes (auth required). Client documents are encrypted on disk; do not use static /uploads URLs.
   */
  downloadFile(clientId, documentId) {
    return apiClient.get(`/clients/${clientId}/documents/${documentId}/file`, {
      responseType: "blob",
      transformResponse: [(data) => data],
    });
  },
};
