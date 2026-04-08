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
    if (options.currentSituationId !== undefined) body.currentSituationId = options.currentSituationId;
    if (options.currentlyTakingDrugs !== undefined) body.currentlyTakingDrugs = options.currentlyTakingDrugs;
    if (options.housingTypeId !== undefined) body.housingTypeId = options.housingTypeId;
    if (options.housingRedGreen !== undefined) body.housingRedGreen = options.housingRedGreen;
    if (options.housingLocationId !== undefined) body.housingLocationId = options.housingLocationId;
    if (options.daytimeLocationId !== undefined) body.daytimeLocationId = options.daytimeLocationId;
    if (options.phone !== undefined) body.phone = options.phone;
    if (options.housingStreet !== undefined) body.housingStreet = options.housingStreet;
    if (options.housingApt !== undefined) body.housingApt = options.housingApt;
    if (options.housingCity !== undefined) body.housingCity = options.housingCity;
    if (options.housingState !== undefined) body.housingState = options.housingState;
    if (options.housingZip !== undefined) body.housingZip = options.housingZip;
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
