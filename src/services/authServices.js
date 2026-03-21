import apiClient from "./services.js";
import Utils from "../config/utils.js";

export default {
  getOrganizationsForRegistration() {
    return apiClient.get("organizations-for-registration");
  },
  loginUser(credentials) {
    return apiClient.post("login", credentials);
  },
  registerUser(payload) {
    return apiClient.post("register", payload);
  },
  resetPassword(username, newPassword) {
    return apiClient.post("reset-password", { username, newPassword });
  },
  logoutUser(user) {
    const token = user?.token ?? Utils.getStore("user")?.token;
    return apiClient.post("logout", { token: token || "" });
  },
};
