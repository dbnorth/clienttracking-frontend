import apiClient from "./services.js";

export default {
  getServiceStatusTimeseries(params) {
    return apiClient.get("/stats/service-status-timeseries", { params });
  },
  getClientsAddedTimeseries(params) {
    return apiClient.get("/stats/clients-added-timeseries", { params });
  },
  getServiceCountsTimeseries(params) {
    return apiClient.get("/stats/service-counts-timeseries", { params });
  },
};
