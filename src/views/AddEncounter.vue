<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import ClientServices from "../services/clientServices";
import ClientServiceServices from "../services/clientserviceServices";
import LookupServices from "../services/lookupServices";
import Utils from "../config/utils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";
import { getClientFullDisplayName } from "../utils/clientNameUtils.js";
import { lookupQueryOpts, organizationIdFromClientEmbedded } from "../utils/lookupOrgUtils.js";
import PhoneInput from "../components/PhoneInput.vue";

const router = useRouter();
const route = useRoute();

/** After save or cancel: Home if opened from Add Client; otherwise previous screen. */
const leaveEncounter = () => {
  if (route.query.from === "addClient") {
    router.push({ name: "home" });
    return;
  }
  router.back();
};
const message = ref(
  "Select a client, then update their information if needed and select services requested, provided, or cancelled."
);
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
const initialSituations = ref([]);
const housingTypes = ref([]);
const housingLocations = ref([]);
const daytimeLocations = ref([]);
const encounterCurrentSituationId = ref(null);
const encounterCurrentlyTakingDrugs = ref(false);
const encounterHousingTypeId = ref(null);
const encounterHousingRedGreen = ref(null);
const encounterHousingLocationId = ref(null);
const encounterDaytimeLocationId = ref(null);
const encounterPhone = ref("");
const encounterHousingStreet = ref("");
const encounterHousingApt = ref("");
const encounterHousingCity = ref("");
const encounterHousingState = ref("");
const encounterHousingZip = ref("");
const encounterFormRef = ref(null);
const clientSearchFieldRef = ref(null);
const requiredEncounterType = [(v) => (v != null && v !== "") || "Encounter type is required"];
const onEncounterTypeChange = async () => {
  // Re-validate immediately so required error clears once a value is selected.
  await encounterFormRef.value?.validate();
};
const clientServiceHistory = ref([]);
const photoDialogOpen = ref(false);
const photoStream = ref(null);
const photoVideoRef = ref(null);
const photoFileInputRef = ref(null);
const photoUploading = ref(false);
const photoError = ref("");
const photoFacingMode = ref("environment");
const photoSwitchingCamera = ref(false);

const formatNow = () => {
  const d = new Date();
  const datePart = Utils.formatDate(d.toISOString().slice(0, 10));
  const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart} ${timePart}`;
};

const getClientLabel = (c) => {
  const name = getClientFullDisplayName(c);
  const phone = c.phone ? ` • ${formatPhoneForDisplay(c.phone)}` : "";
  return `${name}${phone}`;
};

const getClientDisplayName = (c) => {
  if (!c) return "";
  return getClientFullDisplayName(c) || `Client #${c.id}`;
};

/** Zebra striping for the four cells in one service row (shared CSS grid). */
const encounterServiceRowClass = (idx) => (idx % 2 === 1 ? "encounter-service-data-row--alt" : "encounter-service-data-row");

const getClientPhotoUrl = (c) => (c?.photoUrl ? ClientServices.getPhotoUrl(c.photoUrl) : null);

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

const openPhotoDialog = async () => {
  if (!selectedClient.value) return;
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
    await nextTick();
    captureSaveBaseline();
    closePhotoDialog();
  } catch (e) {
    photoError.value = e.response?.data?.message || "Upload failed.";
  } finally {
    photoUploading.value = false;
  }
};

/** Keep the selected row in `items` after the search list clears; otherwise Vuetify clears v-model and snapshot defaults are lost. */
const clientsWithLabel = computed(() => {
  const base = clients.value.map((c) => ({ ...c, displayLabel: getClientLabel(c) }));
  const sel = selectedClient.value;
  if (!sel?.id) return base;
  const sid = Number(sel.id);
  if (base.some((x) => Number(x.id) === sid)) return base;
  return [{ ...sel, displayLabel: getClientLabel(sel) }, ...base];
});

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
    // Do not treat request dates on cancelled rows as "last requested" — cancellation supersedes.
    if (req && r.status !== "cancelled") {
      lastRequested = !lastRequested || req > lastRequested ? req : lastRequested;
    }
    if (r.status === "cancelled") {
      const canc = toDateStr(r.cancelledDate);
      if (canc) lastCancelled = !lastCancelled || canc > lastCancelled ? canc : lastCancelled;
    }
  });
  /** Same calendar date: provided > cancelled > requested (cancel beats a still-open request). */
  const typeOrder = { provided: 3, cancelled: 2, requested: 1 };
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

function toLookupId(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeStateAbbrev(v) {
  return String(v ?? "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

const showEncounterHousingAddress = computed(() => {
  const id = encounterHousingLocationId.value;
  if (id == null || id === "") return false;
  const selected = housingLocations.value.find((l) => Number(l.id) === Number(id));
  return selected?.value === "Address";
});

watch(encounterHousingLocationId, (id) => {
  const selected = housingLocations.value.find((l) => Number(l.id) === Number(id));
  if (selected?.value !== "Address") {
    encounterHousingStreet.value = "";
    encounterHousingApt.value = "";
    encounterHousingCity.value = "";
    encounterHousingState.value = "";
    encounterHousingZip.value = "";
  }
});

watch(showEncounterHousingAddress, (show) => {
  if (show && !String(encounterHousingState.value ?? "").trim()) {
    encounterHousingState.value = "OK";
  }
});

function applyClientSnapshotToEncounterFields(c) {
  if (!c) {
    encounterCurrentSituationId.value = null;
    encounterCurrentlyTakingDrugs.value = false;
    encounterHousingTypeId.value = null;
    encounterHousingRedGreen.value = null;
    encounterHousingLocationId.value = null;
    encounterDaytimeLocationId.value = null;
    encounterHousingStreet.value = "";
    encounterHousingApt.value = "";
    encounterHousingCity.value = "";
    encounterHousingState.value = "";
    encounterHousingZip.value = "";
    encounterPhone.value = "";
    return;
  }
  encounterCurrentSituationId.value = toLookupId(c.currentSituationId ?? c.currentSituation?.id);
  encounterCurrentlyTakingDrugs.value = !!c.currentlyTakingDrugs;
  encounterHousingTypeId.value = toLookupId(c.housingTypeId ?? c.housingType?.id);
  encounterHousingRedGreen.value = c.housingRedGreen ?? null;
  encounterHousingLocationId.value = toLookupId(c.housingLocationId ?? c.housingLocation?.id);
  encounterDaytimeLocationId.value = toLookupId(c.daytimeLocationId ?? c.daytimeLocation?.id);
  encounterHousingStreet.value = c.housingStreet ?? "";
  encounterHousingApt.value = c.housingApt ?? "";
  encounterHousingCity.value = c.housingCity ?? "";
  encounterHousingState.value = c.housingState ? normalizeStateAbbrev(c.housingState) : "";
  encounterHousingZip.value = c.housingZip ?? "";
  encounterPhone.value = c.phone ?? "";
}

/** Loads lookup lists using the selected client’s org when set, otherwise the signed-in user’s org (same as Edit Encounter). */
async function loadEncounterLookupsForClient(client) {
  const opts = lookupQueryOpts(organizationIdFromClientEmbedded(client ?? null));
  const [init, ht, hl, dl] = await Promise.all([
    LookupServices.getByType("initial_situation", opts),
    LookupServices.getByType("housing_type", opts),
    LookupServices.getByType("housing_location", opts),
    LookupServices.getByType("daytime_location", opts),
  ]);
  initialSituations.value = init.data || [];
  housingTypes.value = ht.data || [];
  housingLocations.value = hl.data || [];
  daytimeLocations.value = dl.data || [];
}

function selectedClientNumericId() {
  const raw = selectedClient.value?.id ?? selectedClient.value?.clientId;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const saveBaseline = ref(null);

function eqSnapshotId(a, b) {
  const na = a == null || a === "" ? null : Number(a);
  const nb = b == null || b === "" ? null : Number(b);
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  return na === nb;
}

function captureSaveBaseline() {
  const c = selectedClient.value;
  saveBaseline.value = {
    clientPhotoUrl: c?.photoUrl ?? null,
    encounterTypeId: encounterTypeId.value ?? null,
    notes: String(encounterNotes.value ?? "").trim(),
    phone: String(encounterPhone.value ?? "").trim(),
    currentSituationId: encounterCurrentSituationId.value ?? null,
    currentlyTakingDrugs: !!encounterCurrentlyTakingDrugs.value,
    housingTypeId: encounterHousingTypeId.value ?? null,
    housingRedGreen: encounterHousingRedGreen.value ?? null,
    housingLocationId: encounterHousingLocationId.value ?? null,
    daytimeLocationId: encounterDaytimeLocationId.value ?? null,
    housingStreet: String(encounterHousingStreet.value ?? "").trim(),
    housingApt: String(encounterHousingApt.value ?? "").trim(),
    housingCity: String(encounterHousingCity.value ?? "").trim(),
    housingState: String(encounterHousingState.value ?? "").trim(),
    housingZip: String(encounterHousingZip.value ?? "").trim(),
    serviceSelections: serviceSelections.value.map((s) => ({
      id: s.id,
      requested: !!s.requested,
      provided: !!s.provided,
      cancelled: !!s.cancelled,
    })),
  };
}

watch(
  () => selectedClientNumericId(),
  async (clientId) => {
    if (clientId == null) {
      saveBaseline.value = null;
      applyClientSnapshotToEncounterFields(null);
      await loadEncounterLookupsForClient(null);
      clientServiceHistory.value = [];
      return;
    }
    try {
      const res = await ClientServices.get(clientId);
      const full = res.data;
      if (full?.id != null && Number(full.id) === clientId) {
        selectedClient.value = full;
        applyClientSnapshotToEncounterFields(full);
        await loadEncounterLookupsForClient(full);
      }
    } catch {
      const c = selectedClient.value;
      if (c && Number(c.id ?? c.clientId) === clientId) {
        applyClientSnapshotToEncounterFields(c);
        await loadEncounterLookupsForClient(c);
      }
    }
    try {
      const svcRes = await ClientServiceServices.getAll({ clientId });
      const cur = selectedClient.value;
      if (cur && Number(cur.id ?? cur.clientId) === clientId) {
        clientServiceHistory.value = svcRes.data || [];
      }
    } catch {
      const cur = selectedClient.value;
      if (cur && Number(cur.id ?? cur.clientId) === clientId) {
        clientServiceHistory.value = [];
      }
    }
    await nextTick();
    if (selectedClientNumericId() === clientId) {
      captureSaveBaseline();
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

/** Encounter details and services stay inert until a client is chosen (search stays enabled). */
const encounterFormDisabled = computed(() => selectedClientNumericId() == null);

const isFormDirty = computed(() => {
  const b = saveBaseline.value;
  if (!b || selectedClientNumericId() == null) return false;
  const c = selectedClient.value;
  if ((c?.photoUrl ?? null) !== (b.clientPhotoUrl ?? null)) return true;
  if (!eqSnapshotId(encounterTypeId.value, b.encounterTypeId)) return true;
  if (String(encounterNotes.value ?? "").trim() !== b.notes) return true;
  if (String(encounterPhone.value ?? "").trim() !== b.phone) return true;
  if (!eqSnapshotId(encounterCurrentSituationId.value, b.currentSituationId)) return true;
  if (!!encounterCurrentlyTakingDrugs.value !== b.currentlyTakingDrugs) return true;
  if (!eqSnapshotId(encounterHousingTypeId.value, b.housingTypeId)) return true;
  if ((encounterHousingRedGreen.value ?? null) !== (b.housingRedGreen ?? null)) return true;
  if (!eqSnapshotId(encounterHousingLocationId.value, b.housingLocationId)) return true;
  if (!eqSnapshotId(encounterDaytimeLocationId.value, b.daytimeLocationId)) return true;
  if (String(encounterHousingStreet.value ?? "").trim() !== b.housingStreet) return true;
  if (String(encounterHousingApt.value ?? "").trim() !== b.housingApt) return true;
  if (String(encounterHousingCity.value ?? "").trim() !== b.housingCity) return true;
  if (String(encounterHousingState.value ?? "").trim() !== b.housingState) return true;
  if (String(encounterHousingZip.value ?? "").trim() !== b.housingZip) return true;
  const curSvc = serviceSelections.value.map((s) => ({
    id: s.id,
    requested: !!s.requested,
    provided: !!s.provided,
    cancelled: !!s.cancelled,
  }));
  if (curSvc.length !== b.serviceSelections.length) return true;
  for (let i = 0; i < curSvc.length; i++) {
    const x = curSvc[i];
    const y = b.serviceSelections[i];
    if (!y || x.id !== y.id || x.requested !== y.requested || x.provided !== y.provided || x.cancelled !== y.cancelled) {
      return true;
    }
  }
  return false;
});

const canSaveEncounter = computed(
  () => !encounterFormDisabled.value && (hasSelection.value || isFormDirty.value)
);

const save = async () => {
  const { valid } = (await encounterFormRef.value?.validate()) ?? { valid: true };
  if (!valid) return;
  const client = selectedClient.value;
  const clientId = client?.id ?? client?.clientId;
  if (!clientId) {
    message.value = "Please select a client.";
    return;
  }
  if (encounterTypeId.value == null || encounterTypeId.value === "") {
    message.value = "Encounter type is required.";
    return;
  }
  if (!hasSelection.value && !isFormDirty.value) {
    message.value = "Update the form or mark at least one service as requested, provided, or cancelled.";
    return;
  }
  if (showEncounterHousingAddress.value) {
    if (!String(encounterHousingStreet.value ?? "").trim()) {
      message.value = "Street is required when Housing location is Address.";
      return;
    }
    if (!String(encounterHousingCity.value ?? "").trim()) {
      message.value = "City is required when Housing location is Address.";
      return;
    }
    if (!String(encounterHousingState.value ?? "").trim()) {
      message.value = "State is required when Housing location is Address.";
      return;
    }
    if (!String(encounterHousingZip.value ?? "").trim()) {
      message.value = "Zip is required when Housing location is Address.";
      return;
    }
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
  const trimOrNull = (s) => {
    const t = String(s ?? "").trim();
    return t || null;
  };
  const addressOpts = showEncounterHousingAddress.value
    ? {
        housingStreet: trimOrNull(encounterHousingStreet.value),
        housingApt: trimOrNull(encounterHousingApt.value),
        housingCity: trimOrNull(encounterHousingCity.value),
        housingState: trimOrNull(normalizeStateAbbrev(encounterHousingState.value)),
        housingZip: trimOrNull(encounterHousingZip.value),
      }
    : {
        housingStreet: null,
        housingApt: null,
        housingCity: null,
        housingState: null,
        housingZip: null,
      };

  saving.value = true;
  message.value = "Saving...";
  try {
    await ClientServiceServices.createBulk(clientId, items, {
      userId: uid,
      notes: encounterNotes.value || null,
      encounterTypeId: encounterTypeId.value,
      currentSituationId: encounterCurrentSituationId.value,
      currentlyTakingDrugs: encounterCurrentlyTakingDrugs.value,
      housingTypeId: encounterHousingTypeId.value,
      housingRedGreen: encounterHousingRedGreen.value,
      housingLocationId: encounterHousingLocationId.value,
      daytimeLocationId: encounterDaytimeLocationId.value,
      phone: trimOrNull(encounterPhone.value),
      ...addressOpts,
    });
    leaveEncounter();
  } catch (e) {
    message.value = e.response?.data?.message || e.message || "Error saving. Check console for details.";
    console.error("Add Encounter save error:", e?.response?.data || e);
  } finally {
    saving.value = false;
  }
};

const cancel = () => leaveEncounter();

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
  const inPerson = encounterTypes.value.find((t) => t.value === "In Person");
  if (inPerson?.id != null) encounterTypeId.value = inPerson.id;
  serviceSelections.value = services.value.map((s) => ({
    id: s.id,
    value: s.value,
    requested: false,
    provided: false,
    cancelled: false,
  }));

  const preId = route.query.clientId;
  if (preId != null && String(preId).trim() !== "") {
    const id = parseInt(String(preId), 10);
    if (!Number.isNaN(id)) {
      try {
        const res = await ClientServices.get(id);
        if (res.data?.id) selectedClient.value = res.data;
      } catch (_) {
        /* user can search for a client */
      }
    }
  }
  await nextTick();
  const field = clientSearchFieldRef.value;
  if (field && typeof field.focus === "function") {
    field.focus();
  } else {
    const input = field?.$el?.querySelector?.("input");
    input?.focus?.();
  }
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

      <v-sheet v-if="selectedClient" class="rounded-lg mb-4 pa-4" border>
        <div class="d-flex flex-column align-center ga-4 justify-center text-center">
          <div
            class="flex-shrink-0 overflow-hidden rounded mx-auto"
            style="width: 120px; height: 120px; background: rgb(var(--v-theme-surface-variant));"
          >
            <img
              v-if="getClientPhotoUrl(selectedClient)"
              :src="getClientPhotoUrl(selectedClient)"
              alt="Client photo"
              style="width: 100%; height: 100%; object-fit: cover"
            />
            <div v-else class="d-flex align-center justify-center" style="width: 100%; height: 100%; min-height: 120px">
              <v-icon size="56" color="medium-emphasis">mdi-account</v-icon>
            </div>
          </div>
          <div class="text-center" style="min-width: 0">
            <div class="text-h5 font-weight-medium">{{ getClientDisplayName(selectedClient) }}</div>
            <div class="d-flex flex-wrap ga-2 justify-center mt-3">
              <v-btn
                color="primary"
                size="small"
                variant="tonal"
                :disabled="photoUploading"
                :loading="photoUploading"
                @click="openPhotoDialog"
              >
                <v-icon start size="18">{{ getClientPhotoUrl(selectedClient) ? "mdi-camera" : "mdi-camera-plus" }}</v-icon>
                {{ getClientPhotoUrl(selectedClient) ? "Update photo" : "Add photo" }}
              </v-btn>
            </div>
          </div>
        </div>
      </v-sheet>

      <div class="text-h5 text-center mt-2 mb-2">{{ nowDisplay }}</div>
      <h4>{{ message }}</h4>
      <br />

      <v-form ref="encounterFormRef" validate-on="blur">
        <v-sheet class="rounded-lg mb-4 pa-4" border>
          <div class="text-subtitle-1 mb-3 font-weight-medium">Select Client</div>
          <v-autocomplete
            ref="clientSearchFieldRef"
            v-model="selectedClient"
            :items="clientsWithLabel"
            :loading="loading"
            item-title="displayLabel"
            item-value="id"
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
            label="Encounter type *"
            :rules="requiredEncounterType"
            :disabled="encounterFormDisabled"
            density="compact"
            class="mt-3"
            @update:model-value="onEncounterTypeChange"
          />
          <p
            v-if="!encounterFormDisabled"
            class="text-body-2 text-medium-emphasis mt-2 mb-0"
          >
            Update these fields to current values for the client.
          </p>
          <v-row class="mt-2" dense>
            <v-col cols="12" md="6">
              <v-select
                v-model="encounterCurrentSituationId"
                :items="initialSituations"
                item-title="value"
                item-value="id"
                label="Current Status"
                clearable
                :disabled="encounterFormDisabled"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="6" class="d-flex align-center">
              <v-checkbox
                v-model="encounterCurrentlyTakingDrugs"
                label="Currently taking drugs"
                hide-details
                density="compact"
                color="primary"
                :disabled="encounterFormDisabled"
              />
            </v-col>
          </v-row>
          <v-row dense>
            <v-col cols="12" md="4">
              <v-select
                v-model="encounterHousingTypeId"
                :items="housingTypes"
                item-title="value"
                item-value="id"
                label="Housing Type"
                clearable
                :disabled="encounterFormDisabled"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-select
                v-model="encounterHousingRedGreen"
                :items="['Red', 'Green']"
                label="Red/Green"
                clearable
                :disabled="encounterFormDisabled"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="encounterHousingLocationId"
                :items="housingLocations"
                item-title="value"
                item-value="id"
                label="Housing Location"
                clearable
                :disabled="encounterFormDisabled"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>
          <v-row v-if="showEncounterHousingAddress" dense>
            <v-col cols="12" md="4">
              <v-text-field v-model="encounterHousingStreet" label="Street *" :disabled="encounterFormDisabled" density="compact" hide-details />
            </v-col>
            <v-col cols="12" md="2">
              <v-text-field v-model="encounterHousingApt" label="Apt #" placeholder="Optional" :disabled="encounterFormDisabled" density="compact" hide-details />
            </v-col>
            <v-col cols="12" md="2">
              <v-text-field v-model="encounterHousingCity" label="City *" :disabled="encounterFormDisabled" density="compact" hide-details />
            </v-col>
            <v-col cols="12" md="2">
              <v-text-field
                :model-value="normalizeStateAbbrev(encounterHousingState)"
                label="State *"
                maxlength="2"
                placeholder="OK"
                :disabled="encounterFormDisabled"
                density="compact"
                hide-details
                autocapitalize="characters"
                @update:model-value="encounterHousingState = normalizeStateAbbrev($event)"
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-text-field v-model="encounterHousingZip" label="Zip *" :disabled="encounterFormDisabled" density="compact" hide-details />
            </v-col>
          </v-row>
          <v-row dense>
            <v-col cols="12" md="6">
              <v-select
                v-model="encounterDaytimeLocationId"
                :items="daytimeLocations"
                item-title="value"
                item-value="id"
                label="Daytime Location"
                clearable
                :disabled="encounterFormDisabled"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>
          <v-row class="mt-3" dense>
            <v-col cols="12" md="6">
              <PhoneInput v-model="encounterPhone" label="Phone" :disabled="encounterFormDisabled" hide-details />
            </v-col>
          </v-row>
          <v-textarea
            v-model="encounterNotes"
            label="Notes"
            placeholder="Optional notes for this encounter..."
            :disabled="encounterFormDisabled"
            density="compact"
            rows="3"
            class="mt-3"
            hide-details
          />
        </v-sheet>
      </v-form>

      <v-sheet class="rounded-lg pa-0 overflow-hidden" border>
        <div class="text-subtitle-1 pa-3 bg-grey-lighten-3 font-weight-medium">Services Provided</div>
        <div class="encounter-services-list px-3 pb-2">
          <div v-if="serviceSelections.length" class="encounter-services-cells text-caption text-medium-emphasis">
            <div class="encounter-services-h-spacer" />
            <div class="encounter-services-check-h">Requested</div>
            <div class="encounter-services-check-h">Provided</div>
            <div class="encounter-services-check-h">Cancel</div>
            <template v-for="(svc, idx) in serviceSelections" :key="svc.id">
              <div
                class="encounter-service-label encounter-services-cell"
                :class="encounterServiceRowClass(idx)"
              >
                <div class="encounter-service-title">
                  <strong>{{ svc.value }}</strong> <span class="text-medium-emphasis">({{ getProvidedCount(svc.id) }} {{ getProvidedCount(svc.id) === 1 ? "time" : "times" }})</span>
                </div>
                <div v-if="getLastDateForService(svc.id)" class="text-caption text-medium-emphasis encounter-service-meta">
                  {{ getLastDateForService(svc.id).text }}
                </div>
              </div>
              <div class="encounter-services-check-cell encounter-services-cell" :class="encounterServiceRowClass(idx)">
                <v-checkbox
                  :model-value="svc.requested"
                  :disabled="encounterFormDisabled || showsLastRequested(svc.id)"
                  hide-details
                  density="compact"
                  color="primary"
                  class="encounter-service-checkbox"
                  @update:model-value="(v) => setRequested(idx, v)"
                />
              </div>
              <div class="encounter-services-check-cell encounter-services-cell" :class="encounterServiceRowClass(idx)">
                <v-checkbox
                  :model-value="svc.provided"
                  :disabled="encounterFormDisabled || !!svc.cancelled"
                  hide-details
                  density="compact"
                  color="success"
                  class="encounter-service-checkbox"
                  @update:model-value="(v) => setProvided(idx, v)"
                />
              </div>
              <div class="encounter-services-check-cell encounter-services-cell" :class="encounterServiceRowClass(idx)">
                <v-checkbox
                  v-if="hasPendingRequest(svc.id)"
                  :model-value="svc.cancelled"
                  :disabled="encounterFormDisabled || !!svc.provided"
                  hide-details
                  density="compact"
                  color="error"
                  class="encounter-service-checkbox"
                  @update:model-value="(v) => setCancel(idx, v)"
                />
                <span v-else class="text-caption text-disabled">—</span>
              </div>
            </template>
          </div>
          <div v-else class="text-center text-medium-emphasis py-4">
            No services configured. Add them in Admin.
          </div>
        </div>
      </v-sheet>

      <div class="d-flex align-center mt-4">
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn
          color="primary"
          :disabled="!canSaveEncounter || saving || encounterTypeId == null || encounterTypeId === ''"
          :loading="saving"
          @click="save"
        >
          Save
        </v-btn>
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
    </v-container>
  </div>
</template>

<style scoped>
/* One grid: column 1 is max-content (widest label), so checkboxes sit right after text — no full-width gap. */
.encounter-services-cells {
  display: grid;
  grid-template-columns: max-content 7rem 7rem 7rem;
  /* No column-gap — gaps show the sheet behind and break zebra striping across the row. */
  column-gap: 0;
  row-gap: 0;
  /* stretch so each row’s cells share one height; otherwise backgrounds only cover content (short label / “—” column). */
  align-items: stretch;
  padding-top: 4px;
}
.encounter-services-h-spacer {
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  min-height: 2.25rem;
}
.encounter-services-check-h {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  line-height: 1.15;
  padding: 0 6px 6px;
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  align-self: end;
  white-space: nowrap;
}
.encounter-services-cell {
  padding: 3px 6px;
}
.encounter-service-data-row {
  background-color: rgb(var(--v-theme-surface));
}
.encounter-service-data-row--alt {
  background-color: rgba(var(--v-theme-on-surface), 0.045);
}
.encounter-service-label {
  min-width: 0;
  max-width: min(72rem, calc(100vw - 22.5rem));
  word-break: break-word;
}
.encounter-service-title {
  line-height: 1.25;
}
.encounter-service-meta {
  line-height: 1.2;
  margin-top: 2px;
}
.encounter-services-check-cell {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  min-width: 0;
  justify-self: stretch;
}
.encounter-service-checkbox :deep(.v-selection-control) {
  min-height: 28px;
}
.encounter-service-checkbox :deep(.v-input__control) {
  min-height: 28px;
}
.encounter-service-checkbox :deep(.v-selection-control__wrapper) {
  height: 28px;
}
</style>
