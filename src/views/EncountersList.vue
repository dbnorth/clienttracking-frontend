<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import Utils from "../config/utils.js";
import EncounterServices from "../services/encounterServices";
import ClientServices from "../services/clientServices";
import { getClientFullDisplayName } from "../utils/clientNameUtils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";

const router = useRouter();
const encounters = ref([]);
const message = ref("Results update when you change filters.");
const filterDate = ref("");
/** Selected client for filter (same search pattern as Add Encounter). */
const filterClient = ref(null);
const filterClientSearchResults = ref([]);
const filterClientLoading = ref(false);
const filterClientSearchInput = ref("");
const filterClientSearchTimeout = ref(null);

const getClientName = (c) => {
  if (!c) return "–";
  return getClientFullDisplayName(c) || "–";
};

const getClientLabel = (c) => {
  if (!c) return "";
  const name = getClientFullDisplayName(c);
  const phone = c.phone ? ` • ${formatPhoneForDisplay(c.phone)}` : "";
  return `${name}${phone}`;
};

/** Keep selection visible when the search list is cleared. */
const filterClientsWithLabel = computed(() => {
  const base = filterClientSearchResults.value.map((c) => ({ ...c, displayLabel: getClientLabel(c) }));
  const sel = filterClient.value;
  if (!sel?.id) return base;
  const sid = Number(sel.id);
  if (base.some((x) => Number(x.id) === sid)) return base;
  return [{ ...sel, displayLabel: getClientLabel(sel) }, ...base];
});

const searchFilterClients = (q) => {
  if (filterClientSearchTimeout.value) clearTimeout(filterClientSearchTimeout.value);
  filterClientSearchTimeout.value = setTimeout(async () => {
    const query = (typeof q === "string" ? q : filterClientSearchInput.value)?.trim();
    if (!query) {
      filterClientSearchResults.value = [];
      return;
    }
    filterClientLoading.value = true;
    try {
      const u = Utils.getStore("user");
      const params = { ...Utils.getClientListQueryParams(u), name: query, phone: query };
      const res = await ClientServices.getAll(params);
      filterClientSearchResults.value = res.data || [];
    } catch {
      filterClientSearchResults.value = [];
    } finally {
      filterClientLoading.value = false;
    }
  }, 300);
};

const onFilterClientSearchInput = (v) => {
  filterClientSearchInput.value = v;
  searchFilterClients(v);
};

const getTimeDisplay = (row) => {
  const t = row?.time;
  if (!t) return "–";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
};

const retrieveEncounters = () => {
  const params = { ...Utils.getClientListQueryParams(Utils.getStore("user")) };
  if (filterDate.value) params.date = filterDate.value;
  const cid = filterClient.value?.id;
  if (cid != null && cid !== "") params.clientId = Number(cid);
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
  filterClient.value = null;
  filterClientSearchResults.value = [];
  retrieveEncounters();
};

watch(() => filterClient.value?.id, () => retrieveEncounters());
watch(filterDate, () => retrieveEncounters());

const onUserUpdated = () => {
  retrieveEncounters();
};

onMounted(() => {
  retrieveEncounters();
  window.addEventListener("user-updated", onUserUpdated);
});
onUnmounted(() => {
  if (filterClientSearchTimeout.value) clearTimeout(filterClientSearchTimeout.value);
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
            <v-col cols="12" md="5">
              <v-autocomplete
                v-model="filterClient"
                :items="filterClientsWithLabel"
                :loading="filterClientLoading"
                item-title="displayLabel"
                item-value="id"
                return-object
                label="Filter by client"
                placeholder="Search by name or phone…"
                clearable
                hide-no-data
                density="compact"
                hide-details
                no-filter
                @update:search="onFilterClientSearchInput"
              >
                <template #selection>
                  <span v-if="filterClient">{{ getClientLabel(filterClient) }}</span>
                </template>
              </v-autocomplete>
            </v-col>
            <v-col cols="12" md="2" class="d-flex align-center">
              <v-btn variant="outlined" size="small" @click="clearFilters">Clear filters</v-btn>
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
                <v-tooltip text="View encounter" location="top">
                  <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" small class="mr-2" @click="viewEncounter(row)">mdi-eye</v-icon>
                  </template>
                </v-tooltip>
                <v-tooltip text="Edit encounter" location="top">
                  <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" small class="mr-2" @click="editEncounter(row)">mdi-pencil</v-icon>
                  </template>
                </v-tooltip>
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
