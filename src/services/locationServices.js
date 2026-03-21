import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get("/locations");
  },
  get(id) {
    return apiClient.get(`/locations/${id}`);
  },
  create(data) {
    return apiClient.post("/locations", data);
  },
  update(id, data) {
    return apiClient.put(`/locations/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/locations/${id}`);
  },
};
