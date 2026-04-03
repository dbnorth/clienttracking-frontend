<script setup>
import { ref, computed, watch, onUnmounted } from "vue";
import ClientDocumentServices from "../services/clientDocumentServices.js";
import Utils from "../config/utils.js";
import { getClientFullDisplayName } from "../utils/clientNameUtils.js";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  client: { type: Object, default: null },
});

const emit = defineEmits(["update:modelValue"]);

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const DOC_TYPES = [
  { value: "drivers_license", title: "Driver's License" },
  { value: "birth_certificate", title: "Birth Certificate" },
  { value: "social_security_card", title: "Social Security Card" },
  { value: "misc", title: "Misc" },
];

const documents = ref([]);
const loading = ref(false);
const listError = ref("");
const addSaving = ref(false);
const addError = ref("");

const addDocumentType = ref("drivers_license");
const addMiscDescription = ref("");
const addDateAdded = ref("");
const addFile = ref(null);

const previewOpen = ref(false);
const previewDoc = ref(null);
const previewBlobUrl = ref("");
const previewLoading = ref(false);
const previewLoadError = ref("");

function revokePreviewUrl() {
  if (previewBlobUrl.value) {
    URL.revokeObjectURL(previewBlobUrl.value);
    previewBlobUrl.value = "";
  }
}

watch(
  () => [previewOpen.value, previewDoc.value?.id, props.client?.id],
  async () => {
    revokePreviewUrl();
    previewLoadError.value = "";
    if (!previewOpen.value || !previewDoc.value?.id || !props.client?.id) return;
    previewLoading.value = true;
    try {
      const res = await ClientDocumentServices.downloadFile(props.client.id, previewDoc.value.id);
      const raw = res.data;
      const mime = previewDoc.value.mimeType || "application/octet-stream";
      const buf = raw instanceof Blob ? await raw.arrayBuffer() : raw;
      previewBlobUrl.value = URL.createObjectURL(new Blob([buf], { type: mime }));
    } catch (e) {
      previewLoadError.value = e.response?.data?.message || e.message || "Could not load document.";
    } finally {
      previewLoading.value = false;
    }
  },
  { flush: "post" }
);

onUnmounted(() => {
  revokePreviewUrl();
});

const openPreviewInNewTab = () => {
  if (previewBlobUrl.value) window.open(previewBlobUrl.value, "_blank", "noopener,noreferrer");
};

const isPdf = computed(() => {
  const m = previewDoc.value?.mimeType || "";
  if (m === "application/pdf") return true;
  const u = (previewDoc.value?.fileUrl || "").toLowerCase();
  return u.endsWith(".pdf");
});

const isRasterImage = computed(() => {
  const m = previewDoc.value?.mimeType || "";
  return m === "image/png" || m === "image/jpeg" || m === "image/jpg";
});

const isHeic = computed(() => {
  const m = (previewDoc.value?.mimeType || "").toLowerCase();
  const u = (previewDoc.value?.fileUrl || "").toLowerCase();
  return m.includes("heic") || m.includes("heif") || u.endsWith(".heic") || u.endsWith(".heif");
});

const editOpen = ref(false);
const editSaving = ref(false);
const editError = ref("");
const editDoc = ref(null);
const editDocumentType = ref("drivers_license");
const editMiscDescription = ref("");
const editDateAdded = ref("");
const editFile = ref(null);

const deleteConfirmOpen = ref(false);
const deleteTarget = ref(null);
const deleteLoading = ref(false);

const clientTitle = computed(() => (props.client ? getClientFullDisplayName(props.client) : ""));

const typeTitle = (value) => DOC_TYPES.find((t) => t.value === value)?.title || value;

const todayStr = () => new Date().toISOString().slice(0, 10);

const loadDocuments = async () => {
  if (!props.client?.id) return;
  loading.value = true;
  listError.value = "";
  try {
    const res = await ClientDocumentServices.list(props.client.id);
    documents.value = Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    listError.value = e.response?.data?.message || "Could not load documents.";
    documents.value = [];
  } finally {
    loading.value = false;
  }
};

watch(
  () => [open.value, props.client?.id],
  ([isOpen]) => {
    if (isOpen && props.client?.id) {
      addDateAdded.value = todayStr();
      addDocumentType.value = "drivers_license";
      addMiscDescription.value = "";
      addFile.value = null;
      addError.value = "";
      loadDocuments();
    }
  }
);

const close = () => {
  open.value = false;
};

const resetAddForm = () => {
  addDateAdded.value = todayStr();
  addMiscDescription.value = "";
  addFile.value = null;
  addError.value = "";
};

const pickFile = (val) => {
  if (val == null) return null;
  return Array.isArray(val) ? val[0] : val;
};

const submitAdd = async () => {
  if (!props.client?.id) return;
  addError.value = "";
  const file = pickFile(addFile.value);
  if (!file || !(file instanceof File)) {
    addError.value = "Choose a file (PNG, JPG, HEIC, or PDF).";
    return;
  }
  if (addDocumentType.value === "misc" && !addMiscDescription.value?.trim()) {
    addError.value = "Description is required for Misc.";
    return;
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("documentType", addDocumentType.value);
  fd.append("dateAdded", addDateAdded.value || todayStr());
  if (addDocumentType.value === "misc") {
    fd.append("miscDescription", addMiscDescription.value.trim());
  }
  addSaving.value = true;
  try {
    await ClientDocumentServices.create(props.client.id, fd);
    resetAddForm();
    await loadDocuments();
  } catch (e) {
    addError.value = e.response?.data?.message || "Upload failed.";
  } finally {
    addSaving.value = false;
  }
};

const openPreview = (doc) => {
  previewDoc.value = doc;
  previewOpen.value = true;
};

const openEdit = (doc) => {
  editDoc.value = doc;
  editDocumentType.value = doc.documentType;
  editMiscDescription.value = doc.miscDescription || "";
  editDateAdded.value = doc.dateAdded ? String(doc.dateAdded).slice(0, 10) : todayStr();
  editFile.value = null;
  editError.value = "";
  editOpen.value = true;
};

const saveEdit = async () => {
  if (!props.client?.id || !editDoc.value) return;
  editError.value = "";
  if (editDocumentType.value === "misc" && !editMiscDescription.value?.trim()) {
    editError.value = "Description is required for Misc.";
    return;
  }
  const fd = new FormData();
  fd.append("documentType", editDocumentType.value);
  fd.append("dateAdded", editDateAdded.value || todayStr());
  if (editDocumentType.value === "misc") {
    fd.append("miscDescription", editMiscDescription.value.trim());
  } else {
    fd.append("miscDescription", "");
  }
  const rep = pickFile(editFile.value);
  if (rep && rep instanceof File) {
    fd.append("file", rep);
  }
  editSaving.value = true;
  try {
    await ClientDocumentServices.update(props.client.id, editDoc.value.id, fd);
    editOpen.value = false;
    await loadDocuments();
  } catch (e) {
    editError.value = e.response?.data?.message || "Update failed.";
  } finally {
    editSaving.value = false;
  }
};

const askDelete = (doc) => {
  deleteTarget.value = doc;
  deleteConfirmOpen.value = true;
};

const confirmDelete = async () => {
  if (!props.client?.id || !deleteTarget.value) return;
  deleteLoading.value = true;
  try {
    await ClientDocumentServices.remove(props.client.id, deleteTarget.value.id);
    deleteConfirmOpen.value = false;
    deleteTarget.value = null;
    await loadDocuments();
  } catch (e) {
    listError.value = e.response?.data?.message || "Delete failed.";
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <v-dialog v-model="open" max-width="920" scrollable>
    <v-card v-if="client">
      <v-card-title class="d-flex align-center flex-wrap">
        <span>Documents — {{ clientTitle }}</span>
        <v-spacer />
        <v-btn icon variant="text" density="comfortable" @click="close">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-divider />
      <v-card-text class="pt-4">
        <v-alert v-if="listError" type="warning" density="compact" class="mb-3" closable @click:close="listError = ''">
          {{ listError }}
        </v-alert>
        <v-progress-linear v-if="loading" indeterminate class="mb-3" />

        <v-sheet border rounded class="pa-4 mb-6">
          <div class="text-subtitle-2 mb-3">Add document</div>
          <v-row dense>
            <v-col cols="12" md="4">
              <v-select
                v-model="addDocumentType"
                :items="DOC_TYPES"
                item-title="title"
                item-value="value"
                label="Document type"
                density="compact"
                hide-details="auto"
              />
            </v-col>
            <v-col v-if="addDocumentType === 'misc'" cols="12" md="4">
              <v-text-field
                v-model="addMiscDescription"
                label="Description *"
                density="compact"
                hide-details="auto"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="addDateAdded" type="date" label="Date added" density="compact" hide-details="auto" />
            </v-col>
            <v-col cols="12">
              <v-file-input
                v-model="addFile"
                label="File *"
                accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,application/pdf,.heic,.heif"
                prepend-icon="mdi-paperclip"
                density="compact"
                show-size
                hide-details="auto"
              />
            </v-col>
          </v-row>
          <v-alert v-if="addError" type="error" density="compact" class="mt-2">{{ addError }}</v-alert>
          <v-btn color="primary" class="mt-2" :loading="addSaving" :disabled="addSaving" @click="submitAdd">
            Upload
          </v-btn>
        </v-sheet>

        <div class="text-subtitle-2 mb-2">Uploaded documents</div>
        <v-table v-if="documents.length" density="comfortable">
          <thead>
            <tr>
              <th class="text-left">Type</th>
              <th class="text-left">Description</th>
              <th class="text-left">Date added</th>
              <th class="text-left">File</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="doc in documents" :key="doc.id">
              <td>{{ typeTitle(doc.documentType) }}</td>
              <td>{{ doc.miscDescription || "–" }}</td>
              <td>{{ Utils.formatDate(doc.dateAdded) }}</td>
              <td class="text-truncate" style="max-width: 180px">{{ doc.originalFilename || "–" }}</td>
              <td class="text-right text-nowrap">
                <v-btn icon size="small" variant="text" title="View" @click="openPreview(doc)">
                  <v-icon size="small">mdi-eye</v-icon>
                </v-btn>
                <v-btn icon size="small" variant="text" title="Edit" @click="openEdit(doc)">
                  <v-icon size="small">mdi-pencil</v-icon>
                </v-btn>
                <v-btn icon size="small" variant="text" title="Delete" @click="askDelete(doc)">
                  <v-icon size="small">mdi-delete</v-icon>
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
        <p v-else-if="!loading" class="text-medium-emphasis">No documents yet.</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="previewOpen" max-width="960">
    <v-card v-if="previewDoc">
      <v-card-title class="d-flex align-center">
        <span>{{ typeTitle(previewDoc.documentType) }}</span>
        <v-spacer />
        <v-btn
          v-if="previewBlobUrl"
          variant="text"
          prepend-icon="mdi-open-in-new"
          @click="openPreviewInNewTab"
        >
          Open in new tab
        </v-btn>
        <v-btn icon variant="text" @click="previewOpen = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-progress-linear v-if="previewLoading" indeterminate class="mb-3" />
        <v-alert v-if="previewLoadError" type="error" density="compact" class="mb-3">{{ previewLoadError }}</v-alert>
        <iframe
          v-if="isPdf && previewBlobUrl && !previewLoading"
          :src="previewBlobUrl"
          title="Document"
          style="width: 100%; height: 75vh; border: 0"
        />
        <div v-else-if="isRasterImage && previewBlobUrl && !previewLoading" class="d-flex justify-center">
          <img :src="previewBlobUrl" alt="Document" style="max-width: 100%; max-height: 75vh; object-fit: contain" />
        </div>
        <div v-else-if="isHeic && previewBlobUrl && !previewLoading" class="py-4">
          <p class="mb-2">HEIC/HEIF may not preview in the browser.</p>
          <v-btn color="primary" @click="openPreviewInNewTab">Download / open file</v-btn>
        </div>
        <div v-else-if="previewBlobUrl && !previewLoading" class="py-4">
          <p class="mb-2">Preview not available in the browser.</p>
          <v-btn color="primary" @click="openPreviewInNewTab">Open file</v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog v-model="editOpen" max-width="560">
    <v-card v-if="editDoc">
      <v-card-title>Edit document</v-card-title>
      <v-card-text>
        <v-select
          v-model="editDocumentType"
          class="mb-2"
          :items="DOC_TYPES"
          item-title="title"
          item-value="value"
          label="Document type"
          density="compact"
        />
        <v-text-field
          v-if="editDocumentType === 'misc'"
          v-model="editMiscDescription"
          class="mb-2"
          label="Description *"
          density="compact"
        />
        <v-text-field v-model="editDateAdded" type="date" class="mb-2" label="Date added" density="compact" />
        <v-file-input
          v-model="editFile"
          label="Replace file (optional)"
          accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,application/pdf,.heic,.heif"
          prepend-icon="mdi-paperclip"
          density="compact"
          show-size
        />
        <v-alert v-if="editError" type="error" density="compact" class="mt-2">{{ editError }}</v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="editOpen = false">Cancel</v-btn>
        <v-btn color="primary" :loading="editSaving" @click="saveEdit">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="deleteConfirmOpen" max-width="420">
    <v-card>
      <v-card-title>Delete document?</v-card-title>
      <v-card-text>
        This removes the file from the server. {{ deleteTarget ? typeTitle(deleteTarget.documentType) : "" }}
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="deleteConfirmOpen = false">Cancel</v-btn>
        <v-btn color="error" :loading="deleteLoading" @click="confirmDelete">Delete</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
