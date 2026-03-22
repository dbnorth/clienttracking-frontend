<script setup>
import { ref, onMounted, watch } from "vue";
import Utils from "../config/utils";
import AuthServices from "../services/authServices";
import OrganizationServices from "../services/organizationServices";
import UserServices from "../services/userServices";
import { useRouter } from "vue-router";

const router = useRouter();
const user = ref(null);
const title = ref("Client Tracking");
const orgLogoUrl = ref(null);
const initials = ref("");
const name = ref("");
const showUserUpdateDialog = ref(false);
const userUpdateForm = ref({ fName: "", lName: "", email: "", username: "", password: "", organizationId: null });
const organizations = ref([]);
const userUpdateMessage = ref("");
const userUpdateSaving = ref(false);

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

const openUserUpdate = () => {
  const u = user.value;
  userUpdateForm.value = {
    fName: u?.fName || "",
    lName: u?.lName || "",
    email: u?.email || "",
    username: u?.username || "",
    password: "",
    organizationId: u?.organizationId ?? u?.organization?.id ?? null,
  };
  userUpdateMessage.value = "";
  showUserUpdateDialog.value = true;
};

const saveUserUpdate = () => {
  const f = userUpdateForm.value;
  if (!f.fName?.trim() || !f.lName?.trim() || !f.email?.trim() || !f.username?.trim()) {
    userUpdateMessage.value = "First name, last name, email, and username are required.";
    return;
  }
  if (f.password && f.password.length < 8) {
    userUpdateMessage.value = "Password must be at least 8 characters.";
    return;
  }
  const uid = user.value?.userId ?? user.value?.id;
  if (!uid) {
    userUpdateMessage.value = "User ID not found.";
    return;
  }
  userUpdateSaving.value = true;
  userUpdateMessage.value = "";
  const data = {
    fName: f.fName.trim(),
    lName: f.lName.trim(),
    email: f.email.trim(),
    username: f.username.trim(),
    organizationId: f.organizationId || null,
  };
  if (f.password) data.password = f.password;
  UserServices.update(uid, data)
    .then((res) => {
      const updated = res.data;
      Utils.setStore("user", { ...user.value, ...updated });
      resetMenu();
      showUserUpdateDialog.value = false;
      window.dispatchEvent(new CustomEvent("user-updated"));
    })
    .catch((e) => {
      userUpdateMessage.value = e.response?.data?.message || "Error updating profile.";
    })
    .finally(() => {
      userUpdateSaving.value = false;
    });
};

const loadTitle = () => {
  OrganizationServices.getAll()
    .then((r) => {
      const orgs = r.data || [];
      const org = orgs[0];
      title.value = org?.name || "Client Tracking";
      const userOrgId = user.value?.organizationId ?? user.value?.organization?.id;
      const userOrg = userOrgId ? orgs.find((o) => o.id === userOrgId) : org;
      orgLogoUrl.value = userOrg?.logoUrl ? OrganizationServices.getLogoUrl(userOrg.logoUrl) : null;
    })
    .catch(() => {});
};

watch(showUserUpdateDialog, (open) => {
  if (open) {
    OrganizationServices.getAll()
      .then((r) => (organizations.value = r.data || []))
      .catch(() => (organizations.value = []));
  }
});

onMounted(() => {
  resetMenu();
  loadTitle();
});

watch(user, () => loadTitle(), { deep: true });
</script>

<template>
  <div>
    <v-app-bar app class="menu-bar-primary-shadow">
      <router-link
        v-if="user && orgLogoUrl"
        :to="{ name: 'home' }"
        class="d-flex align-center mr-3"
        style="text-decoration: none"
      >
        <img :src="orgLogoUrl" alt="Organization logo" style="max-height: 40px; max-width: 120px; object-fit: contain" />
      </router-link>
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
              <v-btn depressed rounded text block class="mb-2" @click="openUserUpdate">Update Profile</v-btn>
              <v-btn depressed rounded text block @click="logout">Logout</v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-menu>

      <v-dialog v-model="showUserUpdateDialog" max-width="480" persistent>
        <v-card>
          <v-card-title>Update Profile</v-card-title>
          <v-card-text>
            <v-alert v-if="userUpdateMessage" type="error" density="compact" class="mb-3">{{ userUpdateMessage }}</v-alert>
            <v-text-field v-model="userUpdateForm.fName" label="First Name" density="compact" />
            <v-text-field v-model="userUpdateForm.lName" label="Last Name" density="compact" />
            <v-text-field v-model="userUpdateForm.email" label="Email" type="email" density="compact" />
            <v-text-field v-model="userUpdateForm.username" label="Username" density="compact" />
            <v-text-field
              v-model="userUpdateForm.password"
              label="New Password (leave blank to keep current)"
              type="password"
              density="compact"
              hint="Min 8 characters"
              persistent-hint
            />
            <v-select
              v-model="userUpdateForm.organizationId"
              :items="organizations"
              item-title="name"
              item-value="id"
              label="Organization"
              clearable
              density="compact"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="showUserUpdateDialog = false">Cancel</v-btn>
            <v-btn color="primary" :loading="userUpdateSaving" @click="saveUserUpdate">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-app-bar>
  </div>
</template>

<style scoped>
.menu-bar-primary-shadow {
  box-shadow: 0 4px 6px -1px rgba(var(--v-theme-primary), 0.2), 0 2px 4px -2px rgba(var(--v-theme-primary), 0.1) !important;
}
</style>
