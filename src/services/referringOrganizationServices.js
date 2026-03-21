import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get("/referring-organizations");
  },
  get(id) {
    return apiClient.get(`/referring-organizations/${id}`);
  },
  create(data) {
    return apiClient.post("/referring-organizations", data);
  },
  update(id, data) {
    return apiClient.put(`/referring-organizations/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/referring-organizations/${id}`);
  },
};
