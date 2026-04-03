<script setup>
import ClientServices from "../services/clientServices";
import LocationServices from "../services/locationServices";
import LookupServices from "../services/lookupServices";
import Utils from "../config/utils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";
import { getClientFullDisplayName } from "../utils/clientNameUtils.js";
import ClientDocumentsDialog from "../components/ClientDocumentsDialog.vue";
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

/** Local calendar date YYYY-MM-DD (matches date picker and typical “today”). */
const todayIsoDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const defaultIntakeLocationFilter = () => {
  const u = Utils.getStore("user");
  const id = u?.currentLocationId;
  if (id == null || id === "") return null;
  const n = Number(id);
  return Number.isNaN(n) ? null : n;
};

const clients = ref([]);
const intakeLocations = ref([]);
const message = ref("Results update when you change filters.");
const filterName = ref("");
const filterDateAdded = ref(todayIsoDate());
/** When true, empty date means "show all dates"; when false, empty UI still filters by today (see retrieveClients). */
const userClearedDateFilter = ref(false);
/** Ignore empty date emits from Vuetify right after mount so the first load keeps today's filter. */
let ignoreEmptyDateFilterUpdates = true;

const filterLocationId = ref(defaultIntakeLocationFilter());
const filterHousingLocationId = ref(null);
const housingLocations = ref([]);
const photoDialogOpen = ref(false);
const photoClient = ref(null);
const photoStream = ref(null);
const photoVideoRef = ref(null);
const photoFileInputRef = ref(null);
const photoUploading = ref(false);
const photoError = ref("");
/** "environment" = rear/back camera (typical for iPad client photos); "user" = front/selfie */
const photoFacingMode = ref("environment");
const photoSwitchingCamera = ref(false);
const docsDialogOpen = ref(false);
const docsClient = ref(null);

const openDocsDialog = (client) => {
  docsClient.value = client;
  docsDialogOpen.value = true;
};

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

const addEncounterForClient = (client) => {
  router.push({ name: "addEncounter", query: { clientId: String(client.id) } });
};

const getClientPhotoUrl = (c) => {
  if (!c?.photoUrl) return null;
  return ClientServices.getPhotoUrl(c.photoUrl);
};

const stopPhotoStream = () => {
  if (photoStream.value) {
    photoStream.value.getTracks().forEach((t) => t.stop());
    photoStream.value = null;
  }
};

const startPhotoStream = async ({ allowFallback = false } = {}) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    photoError.value = "Camera not supported. Use file upload.";
    return;
  }
  stopPhotoStream();
  const tryMode = (mode) =>
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: mode } },
    });
  let stream;
  try {
    stream = await tryMode(photoFacingMode.value);
  } catch (e) {
    if (allowFallback && photoFacingMode.value === "environment") {
      try {
        stream = await tryMode("user");
        photoFacingMode.value = "user";
      } catch (e2) {
        photoError.value = "Camera access denied or unavailable.";
        return;
      }
    } else {
      photoError.value = "Camera access denied or unavailable.";
      return;
    }
  }
  photoStream.value = stream;
  await nextTick();
  await nextTick();
  const video = photoVideoRef.value;
  if (video) video.srcObject = stream;
  photoError.value = "";
};

const openPhotoDialog = async (client) => {
  photoClient.value = client;
  photoDialogOpen.value = true;
  photoError.value = "";
  photoUploading.value = false;
  photoFacingMode.value = "environment";
  await startPhotoStream({ allowFallback: true });
};

const switchPhotoCamera = async () => {
  photoFacingMode.value = photoFacingMode.value === "environment" ? "user" : "environment";
  photoSwitchingCamera.value = true;
  try {
    await startPhotoStream({ allowFallback: false });
  } finally {
    photoSwitchingCamera.value = false;
  }
};

const closePhotoDialog = () => {
  stopPhotoStream();
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
  const params = { ...Utils.getClientListQueryParams(Utils.getStore("user")) };
  if (filterName.value) params.name = filterName.value;
  const dateStr = filterDateAdded.value != null ? String(filterDateAdded.value).trim() : "";
  if (dateStr) {
    params.addedOn = dateStr;
  } else if (!userClearedDateFilter.value) {
    params.addedOn = todayIsoDate();
  }
  if (filterLocationId.value) params.intakeLocationId = filterLocationId.value;
  if (filterHousingLocationId.value) params.housingLocationId = filterHousingLocationId.value;
  ClientServices.getAll(params)
    .then((response) => {
      const rows = Array.isArray(response.data) ? response.data : [];
      clients.value = rows.map((row) => ({
        ...row,
        nickname: row.nickname != null ? String(row.nickname).trim() : "",
      }));
    })
    .catch((e) => (message.value = e.response?.data?.message || "Error loading clients"));
};

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
  userClearedDateFilter.value = false;
  filterDateAdded.value = todayIsoDate();
  filterLocationId.value = defaultIntakeLocationFilter();
  filterHousingLocationId.value = null;
  retrieveClients();
};

const onDateFilterUpdate = (v) => {
  const s = v == null || v === "" ? "" : String(v).trim();
  if (s === "") {
    if (ignoreEmptyDateFilterUpdates) {
      filterDateAdded.value = todayIsoDate();
      return;
    }
    userClearedDateFilter.value = true;
    filterDateAdded.value = "";
    retrieveClients();
    return;
  }
  userClearedDateFilter.value = false;
  filterDateAdded.value = s;
  retrieveClients();
};

watch(filterLocationId, () => retrieveClients());
watch(filterHousingLocationId, () => retrieveClients());

let nameFilterTimeout = null;
watch(filterName, () => {
  if (nameFilterTimeout) clearTimeout(nameFilterTimeout);
  nameFilterTimeout = setTimeout(() => retrieveClients(), 400);
});

const onUserUpdated = () => retrieveClients();

onMounted(async () => {
  userClearedDateFilter.value = false;
  filterDateAdded.value = todayIsoDate();
  loadLocations();
  loadHousingLocations();
  await nextTick();
  await nextTick();
  retrieveClients();
  setTimeout(() => {
    ignoreEmptyDateFilterUpdates = false;
  }, 0);
  window.addEventListener("user-updated", onUserUpdated);
});
onUnmounted(() => {
  window.removeEventListener("user-updated", onUserUpdated);
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
            <v-col cols="12" sm="6" md="2">
              <v-text-field v-model="filterName" label="Filter by Name" placeholder="First, nickname, last, or middle" clearable density="compact" hide-details @keyup.enter="retrieveClients" />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-text-field
                :model-value="filterDateAdded"
                type="date"
                label="Date added"
                clearable
                density="compact"
                hide-details
                @update:model-value="onDateFilterUpdate"
              />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select v-model="filterLocationId" :items="intakeLocationsWithLabel" item-title="displayName" item-value="id"
                label="Intake location" clearable density="compact" hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select v-model="filterHousingLocationId" :items="housingLocations" item-title="value" item-value="id"
                label="Housing location" clearable density="compact" hide-details />
            </v-col>
            <v-col cols="12" md="2" class="d-flex align-center">
              <v-btn type="button" variant="outlined" size="small" @click.prevent="clearFilters">Clear filters</v-btn>
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
                <v-tooltip v-if="getClientPhotoUrl(item)" text="Click to edit client" location="top">
                  <template #activator="{ props: tp }">
                    <div
                      v-bind="tp"
                      class="overflow-hidden cursor-pointer"
                      style="width: 36px; height: 36px; background: rgb(var(--v-theme-surface-variant))"
                      role="button"
                      tabindex="0"
                      @click="editClient(item)"
                      @keydown.enter.prevent="editClient(item)"
                    >
                      <img :src="getClientPhotoUrl(item)" alt="Client photo" style="width: 100%; height: 100%; object-fit: cover" />
                    </div>
                  </template>
                </v-tooltip>
                <v-tooltip v-else text="Click to edit client" location="top">
                  <template #activator="{ props: tp }">
                    <div
                      v-bind="tp"
                      class="d-flex align-center justify-center cursor-pointer"
                      style="width: 36px; height: 36px; background: rgb(var(--v-theme-surface-variant))"
                      role="button"
                      tabindex="0"
                      @click="editClient(item)"
                      @keydown.enter.prevent="editClient(item)"
                    >
                      <v-icon size="20">mdi-account</v-icon>
                    </div>
                  </template>
                </v-tooltip>
              </td>
              <td>
                <router-link
                  class="text-primary text-decoration-none client-list-edit-link"
                  :to="{ name: 'editClient', params: { id: item.id } }"
                >
                  {{ getClientFullDisplayName(item) }}
                </router-link>
              </td>
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
                <v-tooltip text="Documents" location="top">
                  <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" small class="mx-2" @click="openDocsDialog(item)">mdi-file-document-multiple-outline</v-icon>
                  </template>
                </v-tooltip>
                <v-tooltip text="Add encounter" location="top">
                  <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" small class="mx-2" @click="addEncounterForClient(item)">mdi-clipboard-plus-outline</v-icon>
                  </template>
                </v-tooltip>
                <v-tooltip text="Edit client" location="top">
                  <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" small class="mx-2" @click="editClient(item)">mdi-pencil</v-icon>
                  </template>
                </v-tooltip>
                <v-tooltip text="View client" location="top">
                  <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" small class="mx-2" @click="viewClient(item)">mdi-eye</v-icon>
                  </template>
                </v-tooltip>
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
          <v-card-title>{{ getClientFullDisplayName(photoClient) }} – Add Photo</v-card-title>
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
            <div class="d-flex flex-wrap ga-2 align-center">
              <v-btn
                v-if="photoStream && !photoError"
                color="primary"
                :disabled="photoUploading || photoSwitchingCamera"
                :loading="photoUploading"
                @click="capturePhoto"
              >
                Take Photo
              </v-btn>
              <v-btn
                v-if="photoStream && !photoError"
                variant="outlined"
                prepend-icon="mdi-camera-flip"
                :disabled="photoUploading || photoSwitchingCamera"
                :loading="photoSwitchingCamera"
                @click="switchPhotoCamera"
              >
                {{ photoFacingMode === "environment" ? "Front camera" : "Back camera" }}
              </v-btn>
              <v-btn variant="outlined" :disabled="photoUploading || photoSwitchingCamera" @click="photoFileInputRef?.click()">
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

      <ClientDocumentsDialog
        :model-value="docsDialogOpen"
        :client="docsClient"
        @update:model-value="
          (v) => {
            docsDialogOpen = v;
            if (!v) docsClient = null;
          }
        "
      />
    </v-container>
  </div>
</template>

<style scoped>
.client-list-edit-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
