<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import Utils from "../config/utils.js";
import ClientServiceServices from "../services/clientserviceServices";
import ClientServices from "../services/clientServices";
import LookupServices from "../services/lookupServices";
import ViewEncounter from "./ViewEncounter.vue";
import ViewClient from "./ViewClient.vue";

const services = ref([]);
const clients = ref([]);
const serviceTypes = ref([]);
const message = ref("Filter services by client, service type, status, and date.");
const filterClientId = ref(null);
const filterServiceProvidedId = ref(null);
const filterStatus = ref(null);
const filterStatusDate = ref("");

const statusOptions = [
  { title: "Requested", value: "requested" },
  { title: "Provided", value: "provided" },
  { title: "Cancelled", value: "cancelled" },
];

const getClientName = (c) => {
  if (!c) return "–";
  const name = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");
  return name || `#${c.id}`;
};

const clientsForSelect = computed(() =>
  clients.value.map((c) => ({ ...c, displayName: getClientName(c) }))
);

const getStatusDate = (row) => {
  if (row.status === "provided" && row.providedDate) return Utils.formatDate(row.providedDate);
  if (row.status === "cancelled" && row.cancelledDate) return Utils.formatDate(row.cancelledDate);
  if (row.requestedDate) return Utils.formatDate(row.requestedDate);
  return "–";
};

const retrieveServices = () => {
  const params = { ...Utils.getClientListQueryParams(Utils.getStore("user")) };
  if (filterClientId.value) params.clientId = filterClientId.value;
  if (filterServiceProvidedId.value) params.serviceProvidedId = filterServiceProvidedId.value;
  if (filterStatus.value) params.status = filterStatus.value;
  if (filterStatusDate.value) params.date = filterStatusDate.value;
  ClientServiceServices.getAll(params)
    .then((res) => (services.value = res.data || []))
    .catch((e) => (message.value = e.response?.data?.message || "Error loading services"));
};

const dialogOpen = ref(false);
const dialogContent = ref(null);
const selectedRow = ref(null);

const getEncounterId = (row) =>
  row.status === "provided" ? row.encounterProvidedId : row.encounterRequestedId;

const openViewClient = (row) => {
  selectedRow.value = row;
  dialogContent.value = "client";
  dialogOpen.value = true;
};

const openViewEncounter = (row) => {
  const encId = getEncounterId(row);
  if (encId) {
    selectedRow.value = row;
    dialogContent.value = "encounter";
    dialogOpen.value = true;
  }
};

const closeDialog = () => {
  dialogOpen.value = false;
  dialogContent.value = null;
  selectedRow.value = null;
};

const clearFilters = () => {
  filterClientId.value = null;
  filterServiceProvidedId.value = null;
  filterStatus.value = null;
  filterStatusDate.value = "";
  retrieveServices();
};

watch([filterClientId, filterServiceProvidedId, filterStatus, filterStatusDate], () => retrieveServices());

const loadClientsAndTypes = async () => {
  try {
    const clientParams = { ...Utils.getClientListQueryParams(Utils.getStore("user")) };
    const [clientsRes, servicesRes] = await Promise.all([
      ClientServices.getAll(clientParams),
      LookupServices.getByType("service_provided"),
    ]);
    clients.value = clientsRes.data || [];
    serviceTypes.value = servicesRes.data || [];
  } catch {
    clients.value = [];
    serviceTypes.value = [];
  }
};

const onUserUpdated = () => {
  loadClientsAndTypes();
  retrieveServices();
};

onMounted(async () => {
  await loadClientsAndTypes();
  retrieveServices();
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
        <v-toolbar-title>Services</v-toolbar-title>
      </v-toolbar>
      <br />
      <v-card>
        <v-card-text>
          <v-row class="mb-3 align-center">
            <v-col cols="12" md="2">
              <v-select
                v-model="filterClientId"
                :items="clientsForSelect"
                item-title="displayName"
                item-value="id"
                label="Client"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-select
                v-model="filterServiceProvidedId"
                :items="serviceTypes"
                item-title="value"
                item-value="id"
                label="Service Type"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-select
                v-model="filterStatus"
                :items="statusOptions"
                item-title="title"
                item-value="value"
                label="Status"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-text-field
                v-model="filterStatusDate"
                type="date"
                label="Status Date"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="3" class="d-flex align-center">
              <v-btn color="primary" size="small" class="mr-2" @click="retrieveServices">Filter</v-btn>
              <v-btn variant="outlined" size="small" @click="clearFilters">Clear</v-btn>
            </v-col>
          </v-row>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table density="compact">
          <thead>
            <tr>
              <th class="text-left">Client</th>
              <th class="text-left">Service</th>
              <th class="text-left">Status</th>
              <th class="text-left">Status Date</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in services" :key="row.id">
              <td>
                {{ getClientName(row.client) }}
              </td>
              <td>{{ row.serviceProvided?.value || "–" }}</td>
              <td>
                <v-chip
                  :color="row.status === 'provided' ? 'success' : row.status === 'cancelled' ? 'error' : 'primary'"
                  size="small"
                  variant="tonal"
                >
                  {{ row.status }}
                </v-chip>
              </td>
              <td>{{ getStatusDate(row) }}</td>
              <td>
                <v-tooltip text="View Encounter" location="top">
                  <template #activator="{ props: tooltipProps }">
                    <v-icon
                      v-if="getEncounterId(row)"
                      v-bind="tooltipProps"
                      small
                      class="mr-2"
                      @click="openViewEncounter(row)"
                    >
                      mdi-account-voice
                    </v-icon>
                  </template>
                </v-tooltip>
                <v-tooltip text="View Client" location="top">
                  <template #activator="{ props: tooltipProps }">
                    <v-icon v-bind="tooltipProps" small @click="openViewClient(row)">
                      mdi-account
                    </v-icon>
                  </template>
                </v-tooltip>
              </td>
            </tr>
            <tr v-if="!services.length">
              <td colspan="5" class="text-center">No services match the filters.</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-dialog v-model="dialogOpen" max-width="900" persistent scrollable>
        <div class="dialog-content" style="max-height: 85vh; overflow-y: auto">
          <ViewEncounter
            v-if="dialogContent === 'encounter' && selectedRow"
            :client-id="selectedRow.clientId"
            :id="getEncounterId(selectedRow)"
            embedded
            @close="closeDialog"
          />
          <ViewClient
            v-else-if="dialogContent === 'client' && selectedRow"
            :id="String(selectedRow.clientId)"
            embedded
            @close="closeDialog"
          />
        </div>
      </v-dialog>
    </v-container>
  </div>
</template>
