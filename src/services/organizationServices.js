import apiClient from "./services.js";
import Utils from "../config/utils.js";

const getBaseUrl = () => (import.meta.env.DEV ? "http://localhost:3200/clienttracking/" : "/clienttracking/");

export default {
  getAll() {
    return apiClient.get("/organizations");
  },
  get(id) {
    return apiClient.get(`/organizations/${id}`);
  },
  create(data) {
    return apiClient.post("/organizations", data);
  },
  update(id, data) {
    return apiClient.put(`/organizations/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/organizations/${id}`);
  },
  uploadLogo(id, file) {
    const formData = new FormData();
    formData.append("logo", file);
    return apiClient.put(`/organizations/${id}/logo`, formData, {
      transformRequest: [(data, headers) => {
        const user = Utils.getStore("user");
        if (user?.token) headers["Authorization"] = "Bearer " + user.token;
        if (data instanceof FormData) {
          delete headers["Content-Type"];
          return data;
        }
        return data ? JSON.stringify(data) : data;
      }],
    });
  },
  removeLogo(id) {
    return apiClient.delete(`/organizations/${id}/logo`);
  },
  getLogoUrl(logoUrl) {
    if (!logoUrl) return null;
    const base = getBaseUrl();
    return logoUrl.startsWith("http") ? logoUrl : `${base}uploads/${logoUrl}`;
  },
};
