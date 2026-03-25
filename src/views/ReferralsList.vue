<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import Utils from "../config/utils.js";
import ReferralServices from "../services/referralServices";
import ClientServices from "../services/clientServices";
import ReferringOrganizationServices from "../services/referringOrganizationServices";
import ViewClient from "./ViewClient.vue";

const referrals = ref([]);
const clients = ref([]);
const referringOrgs = ref([]);
const message = ref("Results update when you change filters.");
const filterClientId = ref(null);
const filterReferringOrgId = ref(null);
const filterDate = ref("");

const getClientName = (c) => {
  if (!c) return "–";
  const name = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");
  return name || `#${c.id}`;
};

const clientsForSelect = computed(() =>
  clients.value.map((c) => ({ ...c, displayName: getClientName(c) }))
);

const retrieveReferrals = () => {
  const params = { ...Utils.getClientListQueryParams(Utils.getStore("user")) };
  if (filterClientId.value) params.clientId = filterClientId.value;
  if (filterReferringOrgId.value) params.referringOrganizationId = filterReferringOrgId.value;
  if (filterDate.value) params.date = filterDate.value;
  ReferralServices.getAll(params)
    .then((res) => (referrals.value = res.data || []))
    .catch((e) => (message.value = e.response?.data?.message || "Error loading referrals"));
};

const dialogOpen = ref(false);
const selectedRow = ref(null);

const openViewClient = (row) => {
  selectedRow.value = row;
  dialogOpen.value = true;
};

const closeDialog = () => {
  dialogOpen.value = false;
  selectedRow.value = null;
};

const clearFilters = () => {
  filterClientId.value = null;
  filterReferringOrgId.value = null;
  filterDate.value = "";
  retrieveReferrals();
};

watch([filterClientId, filterReferringOrgId, filterDate], () => retrieveReferrals());

const loadClientsAndOrgs = async () => {
  try {
    const clientParams = { ...Utils.getClientListQueryParams(Utils.getStore("user")) };
    const [clientsRes, orgsRes] = await Promise.all([
      ClientServices.getAll(clientParams),
      ReferringOrganizationServices.getAll(),
    ]);
    clients.value = clientsRes.data || [];
    referringOrgs.value = orgsRes.data || [];
  } catch {
    clients.value = [];
    referringOrgs.value = [];
  }
};

const onUserUpdated = () => {
  loadClientsAndOrgs();
  retrieveReferrals();
};

onMounted(async () => {
  await loadClientsAndOrgs();
  retrieveReferrals();
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
        <v-toolbar-title>Referrals</v-toolbar-title>
      </v-toolbar>
      <br />
      <v-card>
        <v-card-text>
          <v-row class="mb-3 align-center">
            <v-col cols="12" md="3">
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
            <v-col cols="12" md="3">
              <v-select
                v-model="filterReferringOrgId"
                :items="referringOrgs"
                item-title="name"
                item-value="id"
                label="Referring organization"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-text-field
                v-model="filterDate"
                type="date"
                label="Referral date"
                clearable
                density="compact"
                hide-details
              />
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
              <th class="text-left">Referring organization</th>
              <th class="text-left">Type</th>
              <th class="text-left">Case worker</th>
              <th class="text-left">Phone</th>
              <th class="text-left">Referral date</th>
              <th class="text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in referrals" :key="row.id">
              <td>{{ getClientName(row.client) }}</td>
              <td>{{ row.referringOrganization?.name || "–" }}</td>
              <td>{{ row.referringOrganization?.referringOrganizationType?.value || "–" }}</td>
              <td>{{ row.caseWorkerName || row.referringOrganization?.caseWorkerName || "–" }}</td>
              <td>{{ row.phone || row.referringOrganization?.phone || "–" }}</td>
              <td>{{ row.dateOfReferral ? Utils.formatDate(row.dateOfReferral) : "–" }}</td>
              <td>
                <v-tooltip text="View Client" location="top">
                  <template #activator="{ props: tooltipProps }">
                    <v-icon v-bind="tooltipProps" small @click="openViewClient(row)"> mdi-account </v-icon>
                  </template>
                </v-tooltip>
              </td>
            </tr>
            <tr v-if="!referrals.length">
              <td colspan="7" class="text-center">No referrals match the filters.</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <v-dialog v-model="dialogOpen" max-width="900" persistent scrollable>
        <div class="dialog-content" style="max-height: 85vh; overflow-y: auto">
          <ViewClient
            v-if="selectedRow"
            :id="String(selectedRow.clientId)"
            embedded
            @close="closeDialog"
          />
        </div>
      </v-dialog>
    </v-container>
  </div>
</template>
