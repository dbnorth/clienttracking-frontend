import apiClient from "./services.js";

export default {
  getByType(type, opts = {}) {
    const params = {};
    if (opts.organizationId != null && opts.organizationId !== "") {
      params.organizationId = opts.organizationId;
    }
    return apiClient.get(`/lookups/type/${type}`, { params });
  },
  getAll() {
    return apiClient.get("/lookups");
  },
  create(data) {
    return apiClient.post("/lookups", data);
  },
  update(id, data) {
    return apiClient.put(`/lookups/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/lookups/${id}`);
  },
  seedStarterSet(organizationId) {
    return apiClient.post("/lookups/seed-starter-set", organizationId != null ? { organizationId } : {});
  },
};
