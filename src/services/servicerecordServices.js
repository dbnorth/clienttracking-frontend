import apiClient from "./services.js";

export default {
  getAll(clientId) {
    return apiClient.get(`/clients/${clientId}/servicerecords`);
  },
  create(clientId, data) {
    return apiClient.post(`/clients/${clientId}/servicerecords`, data);
  },
  update(clientId, id, data) {
    return apiClient.put(`/clients/${clientId}/servicerecords/${id}`, data);
  },
  delete(clientId, id) {
    return apiClient.delete(`/clients/${clientId}/servicerecords/${id}`);
  },
};
