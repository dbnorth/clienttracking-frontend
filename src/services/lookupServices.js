import apiClient from "./services.js";

export default {
  getByType(type) {
    return apiClient.get(`/lookups/type/${type}`);
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
};
