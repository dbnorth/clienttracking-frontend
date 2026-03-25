import { createRouter, createWebHistory } from "vue-router";
import Utils from "./config/utils.js";
import Login from "./views/Login.vue";
import Home from "./views/Home.vue";
import ClientsList from "./views/ClientsList.vue";
import AddClient from "./views/AddClient.vue";
import EditClient from "./views/EditClient.vue";
import ViewClient from "./views/ViewClient.vue";
import AddEncounter from "./views/AddEncounter.vue";
import EncountersList from "./views/EncountersList.vue";
import EditEncounter from "./views/EditEncounter.vue";
import ViewEncounter from "./views/ViewEncounter.vue";
import ServicesList from "./views/ServicesList.vue";
import ReferralsList from "./views/ReferralsList.vue";
import Admin from "./views/Admin.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", alias: "/login", name: "login", component: Login },
    { path: "/home", name: "home", component: Home },
    { path: "/clients", name: "clients", component: ClientsList },
    { path: "/add", name: "addClient", component: AddClient },
    { path: "/edit/:id", name: "editClient", component: EditClient, props: true },
    { path: "/view/:id", name: "viewClient", component: ViewClient, props: true },
    { path: "/encounters", name: "encounters", component: EncountersList },
    { path: "/services", name: "services", component: ServicesList },
    { path: "/referrals", name: "referrals", component: ReferralsList },
    { path: "/add-encounter", name: "addEncounter", component: AddEncounter },
    { path: "/encounters/view/:clientId/:id", name: "viewEncounter", component: ViewEncounter, props: true },
    { path: "/encounters/edit/:clientId/:id", name: "editEncounter", component: EditEncounter, props: true },
    { path: "/admin", name: "admin", component: Admin },
  ],
});

router.beforeEach((to, _from, next) => {
  const user = Utils.getStore("user");
  if (to.name === "login" && user) {
    next({ name: "home" });
  } else if (to.name !== "login" && !user) {
    next({ name: "login" });
  } else if (user?.role === "none" && to.name !== "home" && to.name !== "login") {
    next({ name: "home" });
  } else if (to.name === "admin" && user?.role !== "admin" && user?.role !== "superadmin") {
    next({ name: "home" });
  } else {
    next();
  }
});

export default router;
