<script setup>
import { ref, onMounted, computed } from "vue";
import AuthServices from "../services/authServices";
import LocationServices from "../services/locationServices";
import Utils from "../config/utils.js";
import { useRouter } from "vue-router";

const router = useRouter();
const organizations = ref([]);
const locations = ref([]);
const selectedLocationId = ref(null);
const showLocationDialog = ref(false);
const loginResponse = ref(null);

const username = ref("");
const password = ref("");
const loginError = ref("");
const successMessage = ref("");
const loading = ref(false);

const showAddUser = ref(false);
const showResetPassword = ref(false);
const registerLoading = ref(false);
const registerMessage = ref("");
const resetUsername = ref("");
const resetPassword = ref("");
const resetConfirm = ref("");
const resetLoading = ref(false);
const resetMessage = ref("");
const newUser = ref({
  fName: "",
  lName: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
  organizationId: null,
});

const login = () => {
  loginError.value = "";
  successMessage.value = "";
  loginResponse.value = null;
  loading.value = true;
  AuthServices.loginUser({
    username: username.value,
    password: password.value,
  })
    .then((res) => {
      Utils.setStore("user", res.data);
      loginResponse.value = res.data;
      return LocationServices.getAll();
    })
    .then((locRes) => {
      locations.value = locRes.data || [];
      if (locations.value.length > 0) {
        selectedLocationId.value = Utils.getStore("user")?.currentLocationId || locations.value[0]?.id || null;
        showLocationDialog.value = true;
      } else {
        router.push({ name: "home" });
      }
    })
    .catch((e) => {
      if (!loginResponse.value) {
        loginError.value = e.response?.data?.message || "Login failed.";
      } else {
        router.push({ name: "home" });
      }
    })
    .finally(() => {
      loading.value = false;
    });
};

const confirmLocation = () => {
  const user = Utils.getStore("user");
  Utils.setStore("user", { ...user, currentLocationId: selectedLocationId.value || null });
  showLocationDialog.value = false;
  router.push({ name: "home" });
};

const locationsWithLabel = computed(() =>
  locations.value.map((loc) => ({
    ...loc,
    displayName: loc.organization ? `${loc.organization.name} – ${loc.name}` : loc.name,
  }))
);

const loadOrganizations = () => {
  AuthServices.getOrganizationsForRegistration()
    .then((r) => (organizations.value = r.data))
    .catch(() => (organizations.value = []));
};

const openAddUser = () => {
  registerMessage.value = "";
  newUser.value = {
    fName: "",
    lName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    organizationId: null,
  };
  showAddUser.value = true;
};

const register = () => {
  registerMessage.value = "";
  const u = newUser.value;
  if (!u.fName?.trim() || !u.lName?.trim() || !u.email?.trim() || !u.username?.trim() || !u.password) {
    registerMessage.value = "All fields are required.";
    return;
  }
  if (u.password !== u.confirmPassword) {
    registerMessage.value = "Passwords do not match.";
    return;
  }
  if (u.password.length < 8) {
    registerMessage.value = "Password must be at least 8 characters.";
    return;
  }
  registerLoading.value = true;
  AuthServices.registerUser({
    fName: u.fName.trim(),
    lName: u.lName.trim(),
    email: u.email.trim(),
    username: u.username.trim(),
    password: u.password,
    organizationId: u.organizationId || null,
  })
    .then(() => {
      showAddUser.value = false;
      successMessage.value = "Account created. You can sign in now.";
      loginError.value = "";
    })
    .catch((e) => {
      registerMessage.value = e.response?.data?.message || "Could not create user.";
    })
    .finally(() => {
      registerLoading.value = false;
    });
};

const doResetPassword = () => {
  resetMessage.value = "";
  if (!resetUsername.value?.trim() || !resetPassword.value || !resetConfirm.value) {
    resetMessage.value = "All fields are required.";
    return;
  }
  if (resetPassword.value !== resetConfirm.value) {
    resetMessage.value = "Passwords do not match.";
    return;
  }
  if (resetPassword.value.length < 8) {
    resetMessage.value = "Password must be at least 8 characters.";
    return;
  }
  resetLoading.value = true;
  AuthServices.resetPassword(resetUsername.value.trim(), resetPassword.value)
    .then(() => {
      showResetPassword.value = false;
      successMessage.value = "Password updated. You can sign in now.";
      loginError.value = "";
    })
    .catch((e) => {
      resetMessage.value = e.response?.data?.message || "Reset failed.";
    })
    .finally(() => {
      resetLoading.value = false;
    });
};

onMounted(() => loadOrganizations());
</script>

<template>
  <v-container class="fill-height" style="max-width: 480px">
    <v-toolbar>
      <v-toolbar-title>Client Tracking</v-toolbar-title>
    </v-toolbar>
    <v-card class="mt-4 pa-4" elevation="2">
      <v-card-title class="text-h6">Sign in</v-card-title>
      <v-card-text>
        <v-alert v-if="successMessage" type="success" density="compact" class="mb-3">{{ successMessage }}</v-alert>
        <v-alert v-if="loginError" type="error" density="compact" class="mb-3">{{ loginError }}</v-alert>

        <v-text-field v-model="username" label="Username" autocomplete="username" density="comfortable" class="mb-2" />
        <v-text-field
          v-model="password"
          label="Password"
          type="password"
          autocomplete="current-password"
          density="comfortable"
          @keyup.enter="login"
        />
      </v-card-text>
      <v-card-actions class="flex-wrap">
        <v-btn color="primary" :loading="loading" @click="login">Sign in</v-btn>
        <v-btn variant="text" @click="openAddUser">Add user</v-btn>
        <v-btn variant="text" color="grey" @click="showResetPassword = true">Reset password</v-btn>
      </v-card-actions>
    </v-card>

    <v-dialog v-model="showAddUser" max-width="520" persistent>
      <v-card>
        <v-card-title class="text-h6">Add user</v-card-title>
        <v-card-text>
          <v-alert v-if="registerMessage" type="error" density="compact" class="mb-3">{{ registerMessage }}</v-alert>
          <v-select
            v-model="newUser.organizationId"
            :items="organizations"
            item-title="name"
            item-value="id"
            label="Organization"
            clearable
            density="comfortable"
          />
          <v-text-field v-model="newUser.fName" label="First name" density="comfortable" />
          <v-text-field v-model="newUser.lName" label="Last name" density="comfortable" />
          <v-text-field v-model="newUser.email" label="Email" type="email" autocomplete="off" density="comfortable" />
          <v-text-field v-model="newUser.username" label="Username" autocomplete="off" density="comfortable" />
          <v-text-field
            v-model="newUser.password"
            label="Password"
            type="password"
            autocomplete="new-password"
            density="comfortable"
            hint="At least 8 characters"
            persistent-hint
          />
          <v-text-field v-model="newUser.confirmPassword" label="Confirm password" type="password" density="comfortable" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddUser = false">Cancel</v-btn>
          <v-btn color="primary" :loading="registerLoading" @click="register">Create account</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showLocationDialog" max-width="480" persistent>
      <v-card>
        <v-card-title class="text-h6">Select your location</v-card-title>
        <v-card-text>
          <p class="text-caption mb-3">Choose your default intake location for adding new clients.</p>
          <v-select
            v-model="selectedLocationId"
            :items="locationsWithLabel"
            item-title="displayName"
            item-value="id"
            label="Location"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" :disabled="!selectedLocationId" @click="confirmLocation">Continue</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showResetPassword" max-width="420" persistent>
      <v-card>
        <v-card-title class="text-h6">Reset password</v-card-title>
        <v-card-text>
          <p class="text-caption mb-2">Enter your username and a new password. (Only available in development.)</p>
          <v-alert v-if="resetMessage" type="error" density="compact" class="mb-3">{{ resetMessage }}</v-alert>
          <v-text-field v-model="resetUsername" label="Username" density="comfortable" />
          <v-text-field v-model="resetPassword" label="New password" type="password" density="comfortable" hint="Min 8 characters" persistent-hint />
          <v-text-field v-model="resetConfirm" label="Confirm new password" type="password" density="comfortable" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showResetPassword = false">Cancel</v-btn>
          <v-btn color="primary" :loading="resetLoading" @click="doResetPassword">Reset</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
