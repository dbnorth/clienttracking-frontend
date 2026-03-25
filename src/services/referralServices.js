import apiClient from "./services.js";

export default {
  getAll(params = {}) {
    return apiClient.get("/referrals", { params });
  },
};
