import apiClient from "./services.js";

export default {
  getAll(params = {}) {
    const { clientId, date, userId } = params;
    const queryParams = {};
    if (clientId) queryParams.clientId = clientId;
    if (date) queryParams.date = date;
    if (userId) queryParams.userId = userId;
    return apiClient.get("/encounters", { params: queryParams });
  },
  getOne(clientId, id) {
    return apiClient.get(`/clients/${clientId}/encounters/${id}`);
  },
  update(clientId, id, data) {
    return apiClient.put(`/clients/${clientId}/encounters/${id}`, data);
  },
};
