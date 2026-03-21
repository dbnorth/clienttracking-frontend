import apiClient from "./services.js";

export default {
  getAll() {
    return apiClient.get("/users");
  },
  get(id) {
    return apiClient.get(`/users/${id}`);
  },
  create(data) {
    return apiClient.post("/users", data);
  },
  update(id, data) {
    return apiClient.put(`/users/${id}`, data);
  },
};
