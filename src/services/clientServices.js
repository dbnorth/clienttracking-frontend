import apiClient from "./services.js";

export default {
  getAll(params = {}) {
    const { userId, name, phone, intakeLocationId, housingLocationId } = params;
    const queryParams = {};
    if (userId) queryParams.userId = userId;
    if (name) queryParams.name = name;
    if (phone) queryParams.phone = phone;
    if (intakeLocationId) queryParams.intakeLocationId = intakeLocationId;
    if (housingLocationId) queryParams.housingLocationId = housingLocationId;
    return apiClient.get("/clients", { params: queryParams });
  },
  get(id) {
    return apiClient.get(`/clients/${id}`);
  },
  create(data) {
    return apiClient.post("/clients", data);
  },
  update(id, data) {
    return apiClient.put(`/clients/${id}`, data);
  },
  delete(id) {
    return apiClient.delete(`/clients/${id}`);
  },
};
