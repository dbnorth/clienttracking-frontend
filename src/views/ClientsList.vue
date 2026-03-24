<script setup>
import ClientServices from "../services/clientServices";
import LocationServices from "../services/locationServices";
import LookupServices from "../services/lookupServices";
import Utils from "../config/utils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const clients = ref([]);
const intakeLocations = ref([]);
const user = Utils.getStore("user");
const message = ref("Search, Edit or View Clients");
const filterName = ref("");
const filterLocationId = ref(null);
const filterHousingLocationId = ref(null);
const housingLocations = ref([]);
const photoDialogOpen = ref(false);
const photoClient = ref(null);
const photoStream = ref(null);
const photoVideoRef = ref(null);
const photoFileInputRef = ref(null);
const photoUploading = ref(false);
const photoError = ref("");

const intakeLocationsWithLabel = computed(() =>
  intakeLocations.value.map((loc) => ({
    ...loc,
    displayName: loc.organization ? `${loc.organization.name} – ${loc.name}` : loc.name,
  }))
);

const viewClient = (client) => {
  router.push({ name: "viewClient", params: { id: client.id } });
};

const addClient = () => router.push({ name: "addClient" });

const editClient = (client) => {
  router.push({ name: "editClient", params: { id: client.id } });
};

const getClientName = (c) => {
  return [c.firstName, c.middleName, c.lastName, c.suffix].filter(Boolean).join(" ") || `#${c.id}`;
};

const getClientPhotoUrl = (c) => {
  if (!c?.photoUrl) return null;
  return ClientServices.getPhotoUrl(c.photoUrl);
};

const openPhotoDialog = async (client) => {
  photoClient.value = client;
  photoDialogOpen.value = true;
  photoError.value = "";
  photoUploading.value = false;
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      photoStream.value = stream;
      await nextTick();
      await nextTick();
      const video = photoVideoRef.value;
      if (video) video.srcObject = stream;
    } catch (e) {
      photoError.value = "Camera access denied or unavailable.";
    }
  } else {
    photoError.value = "Camera not supported. Use file upload.";
  }
};

const closePhotoDialog = () => {
  if (photoStream.value) {
    photoStream.value.getTracks().forEach((t) => t.stop());
    photoStream.value = null;
  }
  photoDialogOpen.value = false;
  photoClient.value = null;
  photoError.value = "";
};

const capturePhoto = () => {
  const video = photoVideoRef.value;
  if (!video || !video.videoWidth || photoUploading.value) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  canvas.toBlob(
    (blob) => {
      if (!blob || !photoClient.value) return;
      uploadPhotoBlob(blob);
    },
    "image/jpeg",
    0.9
  );
};

const onPhotoFileSelected = (e) => {
  const file = e.target.files?.[0];
  if (!file || !photoClient.value) return;
  if (!file.type.startsWith("image/")) {
    photoError.value = "Please select an image file (PNG, JPEG, or GIF).";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    photoError.value = "Image must be 2MB or smaller.";
    return;
  }
  photoError.value = "";
  uploadPhotoBlob(file);
  e.target.value = "";
};

const uploadPhotoBlob = async (blobOrFile) => {
  if (!photoClient.value || photoUploading.value) return;
  photoUploading.value = true;
  photoError.value = "";
  try {
    const res = await ClientServices.uploadPhoto(photoClient.value.id, blobOrFile);
    const photoUrl = res.data?.photoUrl;
    if (photoUrl) {
      const idx = clients.value.findIndex((c) => c.id === photoClient.value.id);
      if (idx >= 0) clients.value[idx] = { ...clients.value[idx], photoUrl };
    }
    closePhotoDialog();
  } catch (e) {
    photoError.value = e.response?.data?.message || "Upload failed.";
  } finally {
    photoUploading.value = false;
  }
};

const retrieveClients = () => {
  const orgId = user?.organizationId ?? user?.organization?.id;
  const params = orgId ? { organizationId: orgId } : { userId: user?.userId };
  if (filterName.value) params.name = filterName.value;
  if (filterLocationId.value) params.intakeLocationId = filterLocationId.value;
  if (filterHousingLocationId.value) params.housingLocationId = filterHousingLocationId.value;
  ClientServices.getAll(params)
    .then((response) => (clients.value = response.data))
    .catch((e) => (message.value = e.response?.data?.message || "Error loading clients"));
};

const applyFilters = () => retrieveClients();

const loadLocations = () => {
  LocationServices.getAll()
    .then((r) => (intakeLocations.value = r.data))
    .catch(() => {});
};

const loadHousingLocations = () => {
  LookupServices.getByType("housing_location")
    .then((r) => (housingLocations.value = r.data))
    .catch(() => {});
};

const clearFilters = () => {
  filterName.value = "";
  filterLocationId.value = null;
  filterHousingLocationId.value = null;
  retrieveClients();
};

watch(filterLocationId, () => retrieveClients());
watch(filterHousingLocationId, () => retrieveClients());

let nameFilterTimeout = null;
watch(filterName, () => {
  if (nameFilterTimeout) clearTimeout(nameFilterTimeout);
  nameFilterTimeout = setTimeout(() => retrieveClients(), 400);
});

onMounted(() => {
  loadLocations();
  loadHousingLocations();
  retrieveClients();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Client</v-toolbar-title>
        <v-spacer />
        <v-btn color="primary" @click="addClient">Add Client</v-btn>
      </v-toolbar>
      <br /><br />
      <v-card>
        <v-card-text>
          <v-row class="mb-3 align-center">
            <v-col cols="12" md="3">
              <v-text-field v-model="filterName" label="Filter by Name" placeholder="First, last, or middle name" clearable density="compact" hide-details @keyup.enter="applyFilters" />
            </v-col>
            <v-col cols="12" md="3">
              <v-select v-model="filterLocationId" :items="intakeLocationsWithLabel" item-title="displayName" item-value="id"
                label="Filter by Intake Location" clearable density="compact" hide-details />
            </v-col>
            <v-col cols="12" md="3">
              <v-select v-model="filterHousingLocationId" :items="housingLocations" item-title="value" item-value="id"
                label="Filter by Housing Location" clearable density="compact" hide-details />
            </v-col>
            <v-col cols="12" md="3" class="d-flex align-center">
              <v-btn type="button" color="primary" size="small" class="mr-2" @click.prevent="applyFilters">Filter</v-btn>
              <v-btn type="button" variant="outlined" size="small" @click.prevent="clearFilters">Clear</v-btn>
            </v-col>
          </v-row>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table>
          <thead>
            <tr>
              <th class="text-left" style="width: 50px">Photo</th>
              <th class="text-left">Name</th>
              <th class="text-left">Client Phone</th>
              <th class="text-left">Intake Location</th>
              <th class="text-left">Status</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in clients" :key="item.id">
              <td class="pa-1">
                <div
                  v-if="getClientPhotoUrl(item)"
                  class="overflow-hidden"
                  style="width: 36px; height: 36px; background: rgb(var(--v-theme-surface-variant));"
                >
                  <img :src="getClientPhotoUrl(item)" alt="Client photo" style="width: 100%; height: 100%; object-fit: cover" />
                </div>
                <div v-else class="d-flex align-center justify-center" style="width: 36px; height: 36px; background: rgb(var(--v-theme-surface-variant));">
                  <v-icon size="20">mdi-account</v-icon>
                </div>
              </td>
              <td>{{ getClientName(item) }}</td>
              <td>{{ formatPhoneForDisplay(item.phone) || "–" }}</td>
              <td>{{ item.intakeLocation ? (item.intakeLocation.organization ? `${item.intakeLocation.organization.name} – ${item.intakeLocation.name}` : item.intakeLocation.name) : "–" }}</td>
              <td>
                <v-chip :color="item.status === 'Active' ? 'success' : item.status === 'Deceased' ? 'grey' : 'warning'" size="small">
                  {{ item.status }}
                </v-chip>
              </td>
              <td>
                <v-tooltip text="Take/upload photo" location="top">
                  <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" small class="mx-2" @click="openPhotoDialog(item)">mdi-camera</v-icon>
                  </template>
                </v-tooltip>
                <v-icon small class="mx-2" @click="editClient(item)">mdi-pencil</v-icon>
                <v-icon small class="mx-2" @click="viewClient(item)">mdi-eye</v-icon>
              </td>
            </tr>
            <tr v-if="!clients.length">
              <td colspan="6" class="text-center">No clients yet. Add your first client.</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-dialog v-model="photoDialogOpen" max-width="500" persistent @click:outside="closePhotoDialog">
        <v-card v-if="photoClient">
          <v-card-title>{{ getClientName(photoClient) }} – Add Photo</v-card-title>
          <v-card-text>
            <div v-if="photoStream && !photoError" class="d-flex justify-center mb-3">
              <video
                ref="photoVideoRef"
                autoplay
                playsinline
                muted
                style="max-width: 100%; max-height: 300px; background: #000"
              />
            </div>
            <v-alert v-if="photoError" type="warning" density="compact" class="mb-2">{{ photoError }}</v-alert>
            <div class="d-flex flex-wrap ga-2">
              <v-btn
                v-if="photoStream && !photoError"
                color="primary"
                :disabled="photoUploading"
                :loading="photoUploading"
                @click="capturePhoto"
              >
                Take Photo
              </v-btn>
              <v-btn variant="outlined" :disabled="photoUploading" @click="photoFileInputRef?.click()">
                Choose File
              </v-btn>
              <input
                ref="photoFileInputRef"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif"
                class="d-none"
                @change="onPhotoFileSelected"
              />
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="closePhotoDialog">Cancel</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>
