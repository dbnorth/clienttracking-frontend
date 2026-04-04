import apiClient from "./services.js";

export default {
  getServiceStatusTimeseries(params) {
    return apiClient.get("/stats/service-status-timeseries", { params });
  },
};
