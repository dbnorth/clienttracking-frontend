<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import ClientServices from "../services/clientServices";
import ClientServiceServices from "../services/clientserviceServices";
import LookupServices from "../services/lookupServices";
import Utils from "../config/utils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";

const router = useRouter();
const message = ref("Select a client and mark services requested or provided.");
const selectedClient = ref(null);
const clients = ref([]);
const searchInput = ref("");
const services = ref([]);
const serviceSelections = ref([]);
const loading = ref(false);
const saving = ref(false);
const searchTimeout = ref(null);
const nowDisplay = ref("");
const encounterNotes = ref("");
const encounterTypeId = ref(null);
const encounterTypes = ref([]);
const clientServiceHistory = ref([]);
const photoDialogOpen = ref(false);
const photoStream = ref(null);
const photoVideoRef = ref(null);
const photoFileInputRef = ref(null);
const photoUploading = ref(false);
const photoError = ref("");

const formatNow = () => {
  const d = new Date();
  const datePart = Utils.formatDate(d.toISOString().slice(0, 10));
  const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart} ${timePart}`;
};

const getClientLabel = (c) => {
  const name = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");
  const phone = c.phone ? ` • ${formatPhoneForDisplay(c.phone)}` : "";
  return name ? `${name}${phone}` : `#${c.id}`;
};

const getClientDisplayName = (c) => {
  if (!c) return "";
  const name = [c.firstName, c.middleName, c.lastName, c.suffix].filter(Boolean).join(" ");
  return name || `Client #${c.id}`;
};

const getClientPhotoUrl = (c) => (c?.photoUrl ? ClientServices.getPhotoUrl(c.photoUrl) : null);

const openPhotoDialog = async () => {
  if (!selectedClient.value) return;
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
      if (!blob || !selectedClient.value) return;
      uploadPhotoBlob(blob);
    },
    "image/jpeg",
    0.9
  );
};

const onPhotoFileSelected = (e) => {
  const file = e.target.files?.[0];
  if (!file || !selectedClient.value) return;
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
  if (!selectedClient.value || photoUploading.value) return;
  photoUploading.value = true;
  photoError.value = "";
  try {
    const res = await ClientServices.uploadPhoto(selectedClient.value.id, blobOrFile);
    const photoUrl = res.data?.photoUrl;
    if (photoUrl) {
      selectedClient.value = { ...selectedClient.value, photoUrl };
    }
    closePhotoDialog();
  } catch (e) {
    photoError.value = e.response?.data?.message || "Upload failed.";
  } finally {
    photoUploading.value = false;
  }
};

const clientsWithLabel = computed(() =>
  clients.value.map((c) => ({ ...c, displayLabel: getClientLabel(c) }))
);

const onSearchInput = (v) => {
  searchInput.value = v;
  searchClients(v);
};

const searchClients = (q) => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value);
  searchTimeout.value = setTimeout(async () => {
    const query = (typeof q === "string" ? q : searchInput.value)?.trim();
    if (!query) {
      clients.value = [];
      return;
    }
    loading.value = true;
    try {
      const u = Utils.getStore("user");
      const params = { ...Utils.getClientListQueryParams(u), name: query, phone: query };
      const res = await ClientServices.getAll(params);
      clients.value = res.data || [];
    } catch {
      clients.value = [];
    } finally {
      loading.value = false;
    }
  }, 300);
};

const selectClient = (c) => {
  selectedClient.value = c;
  clients.value = [];
};

const hasPendingRequest = (serviceProvidedId) => {
  const pending = clientServiceHistory.value.find(
    (r) => r.serviceProvidedId === serviceProvidedId && r.status === "requested" && !r.providedDate
  );
  return !!pending;
};

const getPendingRequestId = (serviceProvidedId) => {
  const records = clientServiceHistory.value
    .filter((r) => r.serviceProvidedId === serviceProvidedId && r.status === "requested" && !r.providedDate)
    .sort((a, b) => (b.requestedDate || "").localeCompare(a.requestedDate || ""));
  return records[0]?.id ?? null;
};

const toDateStr = (v) => {
  if (v == null || v === "") return "";
  const s = typeof v === "string" ? v : v instanceof Date ? v.toISOString() : String(v);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
};

const getLastDateForService = (serviceProvidedId) => {
  const sid = serviceProvidedId != null ? Number(serviceProvidedId) : null;
  const records = clientServiceHistory.value.filter(
    (r) => r != null && (Number(r.serviceProvidedId) === sid || r.serviceProvidedId === serviceProvidedId)
  );
  if (!records.length) return null;
  let lastProvided = null;
  let lastRequested = null;
  let lastCancelled = null;
  records.forEach((r) => {
    const prov = toDateStr(r.providedDate ?? r.encounterProvided?.date);
    if (prov) lastProvided = !lastProvided || prov > lastProvided ? prov : lastProvided;
    const req = toDateStr(r.requestedDate ?? r.encounterRequested?.date);
    if (req) lastRequested = !lastRequested || req > lastRequested ? req : lastRequested;
    if (r.status === "cancelled") {
      const canc = toDateStr(r.cancelledDate);
      if (canc) lastCancelled = !lastCancelled || canc > lastCancelled ? canc : lastCancelled;
    }
  });
  const typeOrder = { provided: 3, requested: 2, cancelled: 1 };
  const candidates = [
    lastProvided && { date: lastProvided, type: "provided", text: `Last provided: ${Utils.formatDate(lastProvided)}` },
    lastRequested && { date: lastRequested, type: "requested", text: `Last requested: ${Utils.formatDate(lastRequested)}` },
    lastCancelled && { date: lastCancelled, type: "cancelled", text: `Request cancelled: ${Utils.formatDate(lastCancelled)}` },
  ].filter(Boolean);
  if (!candidates.length) return null;
  const latest = candidates.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
  }).pop();
  return { text: latest.text, type: latest.type };
};

const showsLastRequested = (serviceProvidedId) => getLastDateForService(serviceProvidedId)?.type === "requested";

const getProvidedCount = (serviceProvidedId) => {
  const sid = serviceProvidedId != null ? Number(serviceProvidedId) : null;
  return clientServiceHistory.value.filter(
    (r) =>
      r != null &&
      (Number(r.serviceProvidedId) === sid || r.serviceProvidedId === serviceProvidedId) &&
      (r.status === "provided" || r.providedDate || r.encounterProvided?.date)
  ).length;
};

watch(
  () => selectedClient.value?.id ?? selectedClient.value?.clientId,
  async (clientId) => {
    if (!clientId) {
      clientServiceHistory.value = [];
      return;
    }
    try {
      const res = await ClientServiceServices.getAll({ clientId });
      clientServiceHistory.value = res.data || [];
    } catch {
      clientServiceHistory.value = [];
    }
  },
  { immediate: true }
);

const setRequested = (idx, val) => {
  const svc = serviceSelections.value[idx];
  if (showsLastRequested(svc?.id)) return;
  const arr = [...serviceSelections.value];
  arr[idx] = { ...arr[idx], requested: !!val };
  serviceSelections.value = arr;
};

const setProvided = (idx, val) => {
  const arr = [...serviceSelections.value];
  const svc = arr[idx];
  const checked = !!val;
  const shouldAutoCheckRequested = checked && !showsLastRequested(svc?.id);
  arr[idx] = {
    ...svc,
    provided: checked,
    requested: shouldAutoCheckRequested ? true : svc.requested,
    cancelled: checked ? false : svc.cancelled,
  };
  serviceSelections.value = arr;
};

const setCancel = (idx, val) => {
  const arr = [...serviceSelections.value];
  const checked = !!val;
  arr[idx] = {
    ...arr[idx],
    cancelled: checked,
    provided: checked ? false : arr[idx].provided,
  };
  serviceSelections.value = arr;
};

const hasSelection = computed(() =>
  serviceSelections.value.some((s) => s.requested || s.provided || s.cancelled)
);

const save = async () => {
  const client = selectedClient.value;
  const clientId = client?.id ?? client?.clientId;
  if (!clientId) {
    message.value = "Please select a client.";
    return;
  }
  if (!hasSelection.value) {
    message.value = "Please mark at least one service as requested, provided, or cancelled.";
    return;
  }
  const currentUser = Utils.getStore("user");
  const uid = currentUser?.userId ?? currentUser?.id;
  if (!uid) {
    message.value = "You must be logged in to save. Please sign in again.";
    return;
  }
  const byService = new Map();
  serviceSelections.value
    .filter((s) => s.requested || s.provided || s.cancelled)
    .forEach((s) => {
      const id = parseInt(s.id, 10);
      if (!id) return;
      const existing = byService.get(id) || { requested: false, provided: false, cancel: false };
      existing.requested = existing.requested || !!s.requested;
      existing.provided = existing.provided || !!s.provided;
      existing.cancel = existing.cancel || !!s.cancelled;
      byService.set(id, existing);
    });
  const items = Array.from(byService.entries()).map(([serviceProvidedId, flags]) => {
    const hasPending = hasPendingRequest(serviceProvidedId);
    const item = {
      serviceProvidedId,
      requested: flags.requested,
      provided: flags.provided,
      cancel: flags.cancel,
    };
    if ((item.provided || item.cancel) && hasPending) {
      item.existingClientServiceId = getPendingRequestId(serviceProvidedId);
    }
    return item;
  });
  saving.value = true;
  message.value = "Saving...";
  try {
    await ClientServiceServices.createBulk(clientId, items, {
      userId: uid,
      notes: encounterNotes.value || null,
      encounterTypeId: encounterTypeId.value || null,
    });
    router.back();
  } catch (e) {
    message.value = e.response?.data?.message || e.message || "Error saving. Check console for details.";
    console.error("Add Encounter save error:", e?.response?.data || e);
  } finally {
    saving.value = false;
  }
};

const cancel = () => router.back();

let nowInterval;
onMounted(async () => {
  nowDisplay.value = formatNow();
  nowInterval = setInterval(() => { nowDisplay.value = formatNow(); }, 1000);
  const [svcRes, typeRes] = await Promise.all([
    LookupServices.getByType("service_provided"),
    LookupServices.getByType("encounter_type"),
  ]);
  services.value = svcRes.data || [];
  encounterTypes.value = typeRes.data || [];
  serviceSelections.value = services.value.map((s) => ({
    id: s.id,
    value: s.value,
    requested: false,
    provided: false,
    cancelled: false,
  }));
});
onUnmounted(() => {
  if (nowInterval) clearInterval(nowInterval);
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Add Encounter</v-toolbar-title>
      </v-toolbar>
      <div class="text-h5 text-center mt-2 mb-2">{{ nowDisplay }}</div>
      <div v-if="selectedClient" class="text-center mb-4">
        <div class="text-h4 font-weight-medium mb-2">{{ getClientDisplayName(selectedClient) }}</div>
        <div class="d-flex justify-center">
          <div
            v-if="getClientPhotoUrl(selectedClient)"
            class="overflow-hidden"
            style="width: 120px; height: 120px; background: rgb(var(--v-theme-surface-variant));"
          >
            <img :src="getClientPhotoUrl(selectedClient)" alt="Client photo" style="width: 100%; height: 100%; object-fit: cover" />
          </div>
          <div v-else class="d-flex flex-column align-center">
            <div class="d-flex align-center justify-center mb-2" style="width: 120px; height: 120px; background: rgb(var(--v-theme-surface-variant));">
              <v-icon size="48">mdi-account</v-icon>
            </div>
            <v-btn color="primary" size="small" variant="tonal" :disabled="photoUploading" :loading="photoUploading" @click="openPhotoDialog">
              <v-icon start size="18">mdi-camera</v-icon>
              Add Photo
            </v-btn>
          </div>
        </div>
      </div>
      <h4>{{ message }}</h4>
      <br />

      <v-sheet class="rounded-lg mb-4 pa-4" border>
        <div class="text-subtitle-1 mb-3 font-weight-medium">Select Client</div>
        <v-autocomplete
          v-model="selectedClient"
          :items="clientsWithLabel"
          :loading="loading"
          item-title="displayLabel"
          return-object
          label="Search by name or phone number"
          placeholder="Type to search..."
          clearable
          hide-no-data
          density="compact"
          no-filter
          @update:search="onSearchInput"
        >
          <template #selection>
            <span v-if="selectedClient">{{ getClientLabel(selectedClient) }}</span>
          </template>
        </v-autocomplete>
        <v-select
          v-model="encounterTypeId"
          :items="encounterTypes"
          item-title="value"
          item-value="id"
          label="Encounter Type"
          clearable
          density="compact"
          class="mt-3"
        />
        <v-textarea
          v-model="encounterNotes"
          label="Notes"
          placeholder="Optional notes for this encounter..."
          density="compact"
          rows="3"
          class="mt-3"
          hide-details
        />
      </v-sheet>

      <v-sheet class="rounded-lg pa-0 overflow-hidden" border>
        <div class="text-subtitle-1 pa-3 bg-grey-lighten-3 font-weight-medium">Services Provided</div>
        <v-table density="compact">
          <thead>
            <tr>
              <th></th>
              <th class="text-center" style="width: 120px">Requested</th>
              <th class="text-center" style="width: 120px">Provided</th>
              <th class="text-center" style="width: 100px">Cancel</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(svc, idx) in serviceSelections" :key="svc.id">
              <td>
                <strong>{{ svc.value }}</strong> <span class="text-medium-emphasis">({{ getProvidedCount(svc.id) }} {{ getProvidedCount(svc.id) === 1 ? 'time' : 'times' }})</span>
                <span v-if="getLastDateForService(svc.id)" class="text-caption text-medium-emphasis d-block">
                  {{ getLastDateForService(svc.id).text }}
                </span>
              </td>
              <td class="text-center">
                <div class="d-flex justify-center">
                  <v-checkbox
                    :model-value="svc.requested"
                  :disabled="showsLastRequested(svc.id)"
                  hide-details
                  density="compact"
                  color="primary"
                  @update:model-value="(v) => setRequested(idx, v)"
                  />
                </div>
              </td>
              <td class="text-center">
                <div class="d-flex justify-center">
                  <v-checkbox
                    :model-value="svc.provided"
                  :disabled="!!svc.cancelled"
                  hide-details
                  density="compact"
                  color="success"
                  @update:model-value="(v) => setProvided(idx, v)"
                  />
                </div>
              </td>
              <td class="text-center">
                <div class="d-flex justify-center">
                  <v-checkbox
                    v-if="hasPendingRequest(svc.id)"
                  :model-value="svc.cancelled"
                  :disabled="!!svc.provided"
                  hide-details
                  density="compact"
                  color="error"
                  @update:model-value="(v) => setCancel(idx, v)"
                  />
                  <span v-else class="text-caption text-disabled">—</span>
                </div>
              </td>
            </tr>
            <tr v-if="!serviceSelections.length">
              <td colspan="4" class="text-center text-medium-emphasis">No services configured. Add them in Admin.</td>
            </tr>
          </tbody>
        </v-table>
      </v-sheet>

      <div class="d-flex align-center mt-4">
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn color="primary" :disabled="!selectedClient || !hasSelection || saving" :loading="saving" @click="save">Save</v-btn>
      </div>

      <v-dialog v-model="photoDialogOpen" max-width="500" persistent @click:outside="closePhotoDialog">
        <v-card v-if="selectedClient">
          <v-card-title>{{ getClientDisplayName(selectedClient) }} – Add Photo</v-card-title>
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
