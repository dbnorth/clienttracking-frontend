<script setup>
import { ref, computed, watch } from "vue";
import AuthServices from "../services/authServices";
import LocationServices from "../services/locationServices";
import OrganizationServices from "../services/organizationServices";
import Utils from "../config/utils.js";
import { useRouter } from "vue-router";

const router = useRouter();
const locations = ref([]);
const selectedLocationId = ref(null);
const showLocationDialog = ref(false);
const loginResponse = ref(null);
const locationDialogOrg = ref(null);

const username = ref("");
const password = ref("");
const loginError = ref("");
const successMessage = ref("");
const loading = ref(false);

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
  const locId = selectedLocationId.value || null;
  const loc = locationsWithLabel.value.find((l) => l.id === locId);
  const locName = loc?.displayName || loc?.name || null;
  Utils.setStore("user", { ...user, currentLocationId: locId, currentLocationName: locName });
  showLocationDialog.value = false;
  router.push({ name: "home" });
};

const locationsWithLabel = computed(() =>
  locations.value.map((loc) => ({
    ...loc,
    displayName: loc.organization ? `${loc.organization.name} – ${loc.name}` : loc.name,
  }))
);

watch(showLocationDialog, (open) => {
  if (open) {
    locationDialogOrg.value = null;
    const orgId = loginResponse.value?.organizationId ?? loginResponse.value?.organization?.id;
    if (orgId) {
      OrganizationServices.get(orgId)
        .then((r) => (locationDialogOrg.value = r.data))
        .catch(() => {});
    } else {
      OrganizationServices.getAll()
        .then((r) => {
          const orgs = r.data || [];
          locationDialogOrg.value = orgs[0] || null;
        })
        .catch(() => {});
    }
  }
});

const welcomeOrgName = computed(
  () => locationDialogOrg.value?.name || loginResponse.value?.organization?.name || null
);
const welcomeLogoUrl = computed(() => {
  const url = locationDialogOrg.value?.logoUrl || loginResponse.value?.organization?.logoUrl;
  return url ? OrganizationServices.getLogoUrl(url) : null;
});

</script>

<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8" class="d-flex flex-column align-center">
        <v-sheet class="w-100" max-width="720">
          <v-toolbar>
            <v-toolbar-title>Client Tracking</v-toolbar-title>
          </v-toolbar>
          <v-card class="mt-4 pa-4" elevation="2">
          <v-card-title class="text-h6">Sign in</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12">
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
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="justify-center">
        <v-btn color="primary" variant="elevated" size="large" :loading="loading" @click="login">Sign in</v-btn>
      </v-card-actions>
          </v-card>
        </v-sheet>
      </v-col>
    </v-row>

    <v-dialog v-model="showLocationDialog" max-width="720" persistent>
      <v-card>
        <v-card-text class="pt-4">
          <p class="text-h6 text-center mb-2">Welcome to Client Tracking{{ welcomeOrgName ? ` for ${welcomeOrgName}` : "" }}</p>
          <div v-if="welcomeLogoUrl" class="d-flex justify-center align-center w-100 mb-4">
            <img
              :src="welcomeLogoUrl"
              alt="Organization logo"
              class="mx-auto"
              style="max-height: 100px; max-width: 240px; object-fit: contain; display: block"
            />
          </div>
          <p class="text-body-1 mb-3">Choose the location where you are working today.</p>
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
  </v-container>
</template>
