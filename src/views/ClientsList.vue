<script setup>
import ClientServices from "../services/clientServices";
import LocationServices from "../services/locationServices";
import LookupServices from "../services/lookupServices";
import Utils from "../config/utils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";
import { ref, computed, onMounted, watch } from "vue";
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
              <th class="text-left">Name</th>
              <th class="text-left">Client Phone</th>
              <th class="text-left">Intake Location</th>
              <th class="text-left">Status</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in clients" :key="item.id">
              <td>{{ getClientName(item) }}</td>
              <td>{{ formatPhoneForDisplay(item.phone) || "–" }}</td>
              <td>{{ item.intakeLocation ? (item.intakeLocation.organization ? `${item.intakeLocation.organization.name} – ${item.intakeLocation.name}` : item.intakeLocation.name) : "–" }}</td>
              <td>
                <v-chip :color="item.status === 'Active' ? 'success' : item.status === 'Deceased' ? 'grey' : 'warning'" size="small">
                  {{ item.status }}
                </v-chip>
              </td>
              <td>
                <v-icon small class="mx-2" @click="editClient(item)">mdi-pencil</v-icon>
                <v-icon small class="mx-2" @click="viewClient(item)">mdi-eye</v-icon>
              </td>
            </tr>
            <tr v-if="!clients.length">
              <td colspan="5" class="text-center">No clients yet. Add your first client.</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </v-container>
  </div>
</template>
