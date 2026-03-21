import apiClient from "./services.js";

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
};
