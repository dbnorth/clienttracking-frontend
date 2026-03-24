import apiClient from "./services.js";

export default {
  getAll(params = {}) {
    const { clientId, serviceProvidedId, date, status, userId, organizationId, encounterId } = params;
    if (clientId && !serviceProvidedId && !date && !status && !encounterId) {
      return apiClient.get(`/clients/${clientId}/clientservices`);
    }
    const queryParams = {};
    if (clientId) queryParams.clientId = clientId;
    if (serviceProvidedId) queryParams.serviceProvidedId = serviceProvidedId;
    if (date) queryParams.date = date;
    if (status) queryParams.status = status;
    if (organizationId) queryParams.organizationId = organizationId;
    else if (userId) queryParams.userId = userId;
    if (encounterId) queryParams.encounterId = encounterId;
    return apiClient.get("/clientservices", { params: queryParams });
  },
  createBulk(clientId, items, options = {}) {
    const body = { items, userId: options.userId };
    if (options.notes != null) body.notes = options.notes;
    if (options.time != null) body.time = options.time;
    if (options.encounterTypeId != null) body.encounterTypeId = options.encounterTypeId;
    return apiClient.post(`/clients/${clientId}/clientservices/bulk`, body);
  },
  create(clientId, data) {
    return apiClient.post(`/clients/${clientId}/clientservices`, data);
  },
  update(clientId, id, data) {
    return apiClient.put(`/clients/${clientId}/clientservices/${id}`, data);
  },
  getOne(clientId, id) {
    return apiClient.get(`/clients/${clientId}/clientservices/${id}`);
  },
  delete(clientId, id) {
    return apiClient.delete(`/clients/${clientId}/clientservices/${id}`);
  },
};
