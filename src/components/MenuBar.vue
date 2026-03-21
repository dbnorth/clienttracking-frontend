<script setup>
import { ref, onMounted } from "vue";
import Utils from "../config/utils";
import AuthServices from "../services/authServices";
import OrganizationServices from "../services/organizationServices";
import { useRouter } from "vue-router";

const router = useRouter();
const user = ref(null);
const title = ref("Client Tracking");
const initials = ref("");
const name = ref("");

const resetMenu = () => {
  user.value = Utils.getStore("user");
  if (user.value) {
    initials.value = (user.value.fName?.[0] || "") + (user.value.lName?.[0] || "");
    name.value = (user.value.fName || "") + " " + (user.value.lName || "");
  }
};

const logout = () => {
  AuthServices.logoutUser(user.value)
    .then(() => {
      Utils.removeItem("user");
      router.push({ name: "login" });
    })
    .catch(() => {});
};

const loadTitle = () => {
  OrganizationServices.getAll()
    .then((r) => {
      const org = r.data?.[0];
      title.value = org?.name || "Client Tracking";
    })
    .catch(() => {});
};

onMounted(() => {
  resetMenu();
  loadTitle();
});
</script>

<template>
  <div>
    <v-app-bar app>
      <v-toolbar-title class="title ml-2 font-weight-bold">{{ title }}</v-toolbar-title>
      <v-spacer></v-spacer>
      <div v-if="user">
        <template v-if="user.role !== 'none'">
          <v-btn class="mx-2" :to="{ name: 'home' }">Home</v-btn>
          <v-btn class="mx-2" :to="{ name: 'clients' }">Clients</v-btn>
          <v-btn class="mx-2" :to="{ name: 'encounters' }">Encounters</v-btn>
          <v-btn class="mx-2" :to="{ name: 'services' }">Services</v-btn>
          <v-btn v-if="user.role === 'admin'" class="mx-2" :to="{ name: 'admin' }">Admin</v-btn>
        </template>
      </div>
      <v-menu v-if="user" bottom min-width="200px" rounded offset-y>
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" icon x-large>
            <v-avatar v-if="user" color="secondary">
              <span class="accent--text font-weight-bold">{{ initials }}</span>
            </v-avatar>
          </v-btn>
        </template>
        <v-card>
          <v-card-text>
            <div class="mx-auto text-center">
              <v-avatar color="secondary" class="mt-2 mb-2">
                <span class="accent--text font-weight-bold">{{ initials }}</span>
              </v-avatar>
              <h3>{{ name }}</h3>
              <p class="text-caption mt-1">{{ user?.username }}</p>
              <p class="text-caption">{{ user?.email }}</p>
              <v-divider class="my-3"></v-divider>
              <v-btn depressed rounded text @click="logout">Logout</v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-menu>
    </v-app-bar>
  </div>
</template>
