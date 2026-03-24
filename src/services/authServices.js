import apiClient from "./services.js";
import Utils from "../config/utils.js";

export default {
  loginUser(credentials) {
    return apiClient.post("login", credentials);
  },
  resetPassword(username, newPassword) {
    return apiClient.post("reset-password", { username, newPassword });
  },
  logoutUser(user) {
    const token = user?.token ?? Utils.getStore("user")?.token;
    return apiClient.post("logout", { token: token || "" });
  },
};
