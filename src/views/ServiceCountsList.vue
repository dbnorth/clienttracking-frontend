<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import Utils from "../config/utils.js";
import ServiceCountServices from "../services/serviceCountServices.js";
import LocationServices from "../services/locationServices.js";
import LookupServices from "../services/lookupServices.js";
import { lookupQueryOpts } from "../utils/lookupOrgUtils.js";

function effectiveOrgIdForLookups() {
  const u = Utils.getStore("user");
  if (u?.role === "superadmin" && u.actingOrganizationId != null && u.actingOrganizationId !== "") {
    return Number(u.actingOrganizationId);
  }
  if (u?.organizationId != null && u.organizationId !== "") {
    return Number(u.organizationId);
  }
  return null;
}

const rows = ref([]);
const locations = ref([]);
const message = ref("");

const filterLocationId = ref(null);
const filterServiceProvidedId = ref(null);
const filterFromDate = ref("");
const filterToDate = ref("");

const showDialog = ref(false);
const dialogSaving = ref(false);
const dialogError = ref("");
const editingId = ref(null);
const form = ref({
  locationId: null,
  serviceProvidedId: null,
  countDate: "",
  count: null,
});
const serviceOptions = ref([]);

const locationsForSelect = computed(() =>
  locations.value.map((loc) => ({
    ...loc,
    displayName: loc.organization ? `${loc.organization.name} – ${loc.name}` : loc.name,
  }))
);

/** Services Provided list values for filter dropdown (scoped like other lookups). */
const filterServiceTypes = ref([]);

/** Chronological by count date, then id (matches API order). */
const sortedRows = computed(() =>
  [...rows.value].sort((a, b) => {
    const da = String(a.countDate ?? "").slice(0, 10);
    const db = String(b.countDate ?? "").slice(0, 10);
    if (da !== db) return da.localeCompare(db);
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  })
);

const loadLocations = async () => {
  try {
    const res = await LocationServices.getAll();
    locations.value = res.data || [];
  } catch {
    locations.value = [];
  }
};

const loadFilterServiceTypes = async () => {
  try {
    const res = await LookupServices.getByType("service_provided", lookupQueryOpts(effectiveOrgIdForLookups()));
    filterServiceTypes.value = res.data || [];
  } catch {
    filterServiceTypes.value = [];
  }
};

const loadServiceOptionsForLocation = async (locationId) => {
  const loc = locations.value.find((l) => l.id === locationId);
  const orgId = loc?.organizationId ?? loc?.organization?.id;
  const opts = lookupQueryOpts(orgId != null ? Number(orgId) : null);
  try {
    const res = await LookupServices.getByType("service_provided", opts);
    serviceOptions.value = res.data || [];
  } catch {
    serviceOptions.value = [];
  }
};

const retrieveCounts = () => {
  message.value = "";
  const params = {};
  if (filterLocationId.value) params.locationId = filterLocationId.value;
  if (filterServiceProvidedId.value) params.serviceProvidedId = filterServiceProvidedId.value;
  if (filterFromDate.value) params.fromDate = filterFromDate.value;
  if (filterToDate.value) params.toDate = filterToDate.value;
  ServiceCountServices.getAll(params)
    .then((res) => {
      rows.value = res.data || [];
      if (!rows.value.length) message.value = "No service counts match the filters.";
    })
    .catch((e) => {
      rows.value = [];
      message.value = e.response?.data?.message || "Error loading service counts.";
    });
};

const clearFilters = () => {
  filterLocationId.value = null;
  filterServiceProvidedId.value = null;
  filterFromDate.value = "";
  filterToDate.value = "";
  retrieveCounts();
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const openAdd = async () => {
  editingId.value = null;
  dialogError.value = "";
  form.value = {
    locationId: null,
    serviceProvidedId: null,
    countDate: todayStr(),
    count: null,
  };
  serviceOptions.value = [];
  showDialog.value = true;
};

const openEdit = async (row) => {
  editingId.value = row.id;
  dialogError.value = "";
  form.value = {
    locationId: row.locationId,
    serviceProvidedId: row.serviceProvidedId,
    countDate: String(row.countDate || "").slice(0, 10),
    count: row.count,
  };
  await loadServiceOptionsForLocation(row.locationId);
  if (!serviceOptions.value.some((s) => s.id === row.serviceProvidedId) && row.serviceProvided) {
    serviceOptions.value = [...serviceOptions.value, row.serviceProvided];
  }
  showDialog.value = true;
};

const closeDialog = () => {
  showDialog.value = false;
  dialogError.value = "";
};

const saveForm = async () => {
  dialogError.value = "";
  if (form.value.locationId == null || form.value.serviceProvidedId == null) {
    dialogError.value = "Location and service are required.";
    return;
  }
  if (!form.value.countDate?.trim()) {
    dialogError.value = "Date is required.";
    return;
  }
  const n = Number(form.value.count);
  if (Number.isNaN(n) || n < 0) {
    dialogError.value = "Count must be a number ≥ 0.";
    return;
  }
  const payload = {
    locationId: form.value.locationId,
    serviceProvidedId: form.value.serviceProvidedId,
    countDate: form.value.countDate,
    count: n,
  };
  dialogSaving.value = true;
  try {
    if (editingId.value != null) {
      await ServiceCountServices.update(editingId.value, payload);
    } else {
      await ServiceCountServices.create(payload);
    }
    closeDialog();
    retrieveCounts();
  } catch (e) {
    dialogError.value = e.response?.data?.message || "Save failed.";
  } finally {
    dialogSaving.value = false;
  }
};

const deleteRow = (row) => {
  if (!confirm(`Delete count for "${row.serviceProvided?.value || "service"}" on ${Utils.formatDate(row.countDate)}?`)) {
    return;
  }
  ServiceCountServices.delete(row.id)
    .then(() => retrieveCounts())
    .catch((e) => {
      message.value = e.response?.data?.message || "Delete failed.";
    });
};

const locationLabel = (row) => {
  const loc = row.location;
  if (!loc) return "–";
  return loc.organization ? `${loc.organization.name} – ${loc.name}` : loc.name;
};

watch(
  () => form.value.locationId,
  async (lid, prev) => {
    if (!showDialog.value) return;
    if (lid == null) {
      serviceOptions.value = [];
      form.value.serviceProvidedId = null;
      return;
    }
    await loadServiceOptionsForLocation(lid);
    if (prev != null && prev !== lid) {
      form.value.serviceProvidedId = null;
    }
  }
);

watch([filterLocationId, filterServiceProvidedId, filterFromDate, filterToDate], () => retrieveCounts());

const onUserUpdated = () => {
  loadLocations();
  loadFilterServiceTypes();
  retrieveCounts();
};

onMounted(async () => {
  await loadLocations();
  await loadFilterServiceTypes();
  retrieveCounts();
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
        <v-toolbar-title>Service counts</v-toolbar-title>
        <v-spacer />
        <v-btn color="primary" @click="openAdd">Add count</v-btn>
      </v-toolbar>
      <br />
      <v-card>
        <v-card-text>
          <v-row class="mb-2 align-center">
            <v-col cols="12" md="3">
              <v-select
                v-model="filterLocationId"
                :items="locationsForSelect"
                item-title="displayName"
                item-value="id"
                label="Location"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-select
                v-model="filterServiceProvidedId"
                :items="filterServiceTypes"
                item-title="value"
                item-value="id"
                label="Service"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-text-field
                v-model="filterFromDate"
                type="date"
                label="From date"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-text-field
                v-model="filterToDate"
                type="date"
                label="To date"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="2" class="d-flex align-center">
              <v-tooltip text="Clear all filters" location="top">
                <template #activator="{ props: tp }">
                  <v-btn v-bind="tp" variant="outlined" size="small" @click="clearFilters">Clear filters</v-btn>
                </template>
              </v-tooltip>
            </v-col>
          </v-row>
          <div v-if="message" class="text-body-2 text-medium-emphasis mb-2">{{ message }}</div>
        </v-card-text>
        <v-table density="compact">
          <thead>
            <tr>
              <th class="text-left">Date</th>
              <th class="text-left">Service</th>
              <th class="text-right">Count</th>
              <th class="text-left">Location</th>
              <th class="text-left" width="120">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedRows" :key="row.id">
              <td>{{ Utils.formatDate(row.countDate) }}</td>
              <td>{{ row.serviceProvided?.value || "–" }}</td>
              <td class="text-right">{{ row.count }}</td>
              <td>{{ locationLabel(row) }}</td>
              <td>
                <v-tooltip text="Edit" location="top">
                  <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" size="small" class="mr-2" @click="openEdit(row)">mdi-pencil</v-icon>
                  </template>
                </v-tooltip>
                <v-tooltip text="Delete" location="top">
                  <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" size="small" @click="deleteRow(row)">mdi-delete-outline</v-icon>
                  </template>
                </v-tooltip>
              </td>
            </tr>
            <tr v-if="!rows.length && !message">
              <td colspan="5" class="text-center text-medium-emphasis">No service counts yet. Add one or adjust filters.</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-dialog
        v-model="showDialog"
        max-width="480"
        persistent
        scrollable
        :z-index="5000"
        content-class="service-count-dialog-content"
      >
        <v-card>
          <v-card-title>{{ editingId != null ? "Edit service count" : "Add service count" }}</v-card-title>
          <v-card-text>
            <v-alert
              v-if="dialogError"
              type="error"
              density="compact"
              class="mb-3"
              closable
              @click:close="dialogError = ''"
            >
              {{ dialogError }}
            </v-alert>
            <v-select
              v-model="form.locationId"
              :items="locationsForSelect"
              item-title="displayName"
              item-value="id"
              label="Location *"
              density="compact"
              class="mb-2"
            />
            <v-select
              v-model="form.serviceProvidedId"
              :items="serviceOptions"
              item-title="value"
              item-value="id"
              label="Service (list value) *"
              :disabled="!form.locationId"
              density="compact"
              class="mb-2"
            />
            <v-text-field v-model="form.countDate" type="date" label="Date *" density="compact" class="mb-2" />
            <v-text-field
              v-model.number="form.count"
              type="number"
              label="Count *"
              min="0"
              step="1"
              density="compact"
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" :disabled="dialogSaving" @click="closeDialog">Cancel</v-btn>
            <v-btn color="primary" :loading="dialogSaving" :disabled="dialogSaving" @click="saveForm">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>

<style>
.service-count-dialog-content .v-input__details {
  position: relative;
  z-index: 2;
}
</style>
