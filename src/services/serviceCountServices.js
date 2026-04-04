import apiClient from "./services.js";

export default {
  getAll(params = {}) {
    return apiClient.get("/service-counts", { params });
  },
  get(id) {
    return apiClient.get(`/service-counts/${id}`);
  },
  create(data) {
    return apiClient.post("/service-counts", data);
  },
  update(id, data) {
    return apiClient.put(`/service-counts/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/service-counts/${id}`);
  },
};
