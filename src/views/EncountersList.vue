<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import Utils from "../config/utils.js";
import EncounterServices from "../services/encounterServices";
import ClientServices from "../services/clientServices";

const router = useRouter();
const encounters = ref([]);
const clients = ref([]);
const message = ref("Filter and manage encounters.");
const filterDate = ref("");
const filterClientId = ref(null);

const getClientName = (c) => {
  if (!c) return "–";
  const name = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");
  return name || `#${c.id}`;
};

const clientsForSelect = computed(() =>
  clients.value.map((c) => ({ ...c, displayName: getClientName(c) }))
);

const getTimeDisplay = (row) => {
  const t = row?.time;
  if (!t) return "–";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
};

const retrieveEncounters = () => {
  const params = { ...Utils.getClientListQueryParams(Utils.getStore("user")) };
  if (filterDate.value) params.date = filterDate.value;
  if (filterClientId.value) params.clientId = filterClientId.value;
  EncounterServices.getAll(params)
    .then((res) => (encounters.value = res.data || []))
    .catch((e) => (message.value = e.response?.data?.message || "Error loading encounters"));
};

const addEncounter = () => router.push({ name: "addEncounter" });

const viewEncounter = (row) => {
  router.push({ name: "viewEncounter", params: { clientId: String(row.clientId), id: String(row.id) } });
};

const editEncounter = (row) => {
  router.push({ name: "editEncounter", params: { clientId: String(row.clientId), id: String(row.id) } });
};

const clearFilters = () => {
  filterDate.value = "";
  filterClientId.value = null;
  retrieveEncounters();
};

watch(filterClientId, () => retrieveEncounters());
watch(filterDate, () => retrieveEncounters());

const loadClientsForEncounters = async () => {
  try {
    const params = { ...Utils.getClientListQueryParams(Utils.getStore("user")) };
    const r = await ClientServices.getAll(params);
    clients.value = r.data || [];
  } catch {
    clients.value = [];
  }
};

const onUserUpdated = () => {
  loadClientsForEncounters();
  retrieveEncounters();
};

onMounted(async () => {
  await loadClientsForEncounters();
  retrieveEncounters();
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
        <v-toolbar-title>Encounters</v-toolbar-title>
        <v-spacer />
        <v-btn color="primary" @click="addEncounter">Add Encounter</v-btn>
      </v-toolbar>
      <br />
      <v-card>
        <v-card-text>
          <v-row class="mb-3 align-center">
            <v-col cols="12" md="3">
              <v-text-field
                v-model="filterDate"
                type="date"
                label="Filter by Date"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="filterClientId"
                :items="clientsForSelect"
                item-title="displayName"
                item-value="id"
                label="Filter by Client"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="3" class="d-flex align-center">
              <v-btn color="primary" size="small" class="mr-2" @click="retrieveEncounters">Filter</v-btn>
              <v-btn variant="outlined" size="small" @click="clearFilters">Clear</v-btn>
            </v-col>
          </v-row>
          <b>{{ message }}</b>
        </v-card-text>
        <v-table density="compact">
          <thead>
            <tr>
              <th class="text-left">Client</th>
              <th class="text-left">Date</th>
              <th class="text-left">Time</th>
              <th class="text-left">Type</th>
              <th class="text-left">Notes</th>
              <th class="text-left" width="120">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in encounters" :key="`${row.clientId}-${row.id}`">
              <td>{{ getClientName(row.client) }}</td>
              <td>{{ Utils.formatDate(row.date) }}</td>
              <td>{{ getTimeDisplay(row) }}</td>
              <td>{{ row.encounterType?.value || "–" }}</td>
              <td>{{ row.notes || "–" }}</td>
              <td>
                <v-icon small class="mr-2" @click="viewEncounter(row)">mdi-eye</v-icon>
                <v-icon small class="mr-2" @click="editEncounter(row)">mdi-pencil</v-icon>
              </td>
            </tr>
            <tr v-if="!encounters.length">
              <td colspan="6" class="text-center">No encounters. Add one to get started.</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </v-container>
  </div>
</template>
