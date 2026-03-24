import axios from "axios";
import Utils from "../config/utils.js";
import AuthServices from "./authServices.js";
import Router from "../router.js";

var baseurl = "";
if (import.meta.env.DEV) {
  baseurl = "http://localhost:3200/clienttracking/";
} else {
  baseurl = "/clienttracking/";
}

const apiClient = axios.create({
  baseURL: baseurl,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  transformRequest: (data, headers) => {
    let user = Utils.getStore("user");
    if (user != null && user.token) {
      headers["Authorization"] = "Bearer " + user.token;
    }
    if (
      user?.role === "superadmin" &&
      user.actingOrganizationId != null &&
      user.actingOrganizationId !== ""
    ) {
      headers["X-Acting-Organization-Id"] = String(user.actingOrganizationId);
    }
    return data ? JSON.stringify(data) : data;
  },
  transformResponse: (data) => {
    data = typeof data === "string" ? JSON.parse(data) : data;
    if (data?.message?.includes("Unauthorized")) {
      Utils.removeItem("user");
      Router.push({ name: "login" });
    }
    return data;
  },
});

export default apiClient;
