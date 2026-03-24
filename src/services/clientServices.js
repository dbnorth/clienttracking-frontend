import apiClient from "./services.js";
import Utils from "../config/utils.js";

const getBaseUrl = () => (import.meta.env.DEV ? "http://localhost:3200/clienttracking/" : "/clienttracking/");

export default {
  getAll(params = {}) {
    const { userId, organizationId, name, phone, intakeLocationId, housingLocationId } = params;
    const queryParams = {};
    if (organizationId) queryParams.organizationId = organizationId;
    else if (userId) queryParams.userId = userId;
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
  uploadPhoto(id, file) {
    const formData = new FormData();
    formData.append("photo", file);
    return apiClient.put(`/clients/${id}/photo`, formData, {
      transformRequest: [(data, headers) => {
        const user = Utils.getStore("user");
        if (user?.token) headers["Authorization"] = "Bearer " + user.token;
        if (data instanceof FormData) {
          delete headers["Content-Type"];
          return data;
        }
        return data ? JSON.stringify(data) : data;
      }],
    });
  },
  removePhoto(id) {
    return apiClient.delete(`/clients/${id}/photo`);
  },
  getPhotoUrl(photoUrl) {
    if (!photoUrl) return null;
    const base = getBaseUrl();
    return photoUrl.startsWith("http") ? photoUrl : `${base}uploads/${photoUrl}`;
  },
};
