<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import Utils from "../config/utils.js";
import EncounterServices from "../services/encounterServices";
import ClientServiceServices from "../services/clientserviceServices";
import LookupServices from "../services/lookupServices";
import { getClientFullDisplayName } from "../utils/clientNameUtils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";

const router = useRouter();
const props = defineProps({
  clientId: { type: [String, Number], required: true },
  id: { type: [String, Number], required: true },
  embedded: { type: Boolean, default: false },
});
const emit = defineEmits(["close"]);

const encounter = ref(null);
const clientServices = ref([]);
const services = ref([]);
const serviceSelections = ref([]);
const loading = ref(true);
const message = ref("");

const getClientName = (c) => {
  if (!c) return "–";
  return getClientFullDisplayName(c) || "–";
};

const getTimeDisplay = (row) => {
  const t = row?.time;
  if (!t) return "–";
  const s = String(t).trim();
  const match = s.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return s;
  try {
    const d = new Date(`1970-01-01T${match[1].padStart(2, "0")}:${match[2]}:00`);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return s;
  }
};

const getLocationDisplay = (loc) => {
  if (!loc) return "–";
  const parts = [loc.name, loc.address].filter(Boolean);
  return parts.length ? parts.join(" – ") : "–";
};

const getUserDisplay = (u) => {
  if (!u) return "–";
  const name = [u.fName, u.lName].filter(Boolean).join(" ");
  return name || u.username || "–";
};

const isRequestedForService = (serviceProvidedId) =>
  clientServices.value.some(
    (r) => r.serviceProvidedId === serviceProvidedId && r.encounterRequestedId === parseInt(props.id, 10)
  );

const isProvidedForService = (serviceProvidedId) =>
  clientServices.value.some(
    (r) => r.serviceProvidedId === serviceProvidedId && r.encounterProvidedId === parseInt(props.id, 10)
  );

const editEncounter = () => {
  if (props.embedded) emit("close");
  router.push({ name: "editEncounter", params: { clientId: String(props.clientId), id: String(props.id) } });
};
const back = () => (props.embedded ? emit("close") : router.push({ name: "encounters" }));

const showEncounterHousingAddress = computed(() => encounter.value?.housingLocation?.value === "Address");

function formatEncounterHousingAddress(enc) {
  if (!enc) return "–";
  const street = String(enc.housingStreet ?? enc.client?.housingStreet ?? "").trim();
  const apt = String(enc.housingApt ?? enc.client?.housingApt ?? "").trim();
  const city = String(enc.housingCity ?? enc.client?.housingCity ?? "").trim();
  const state = String(enc.housingState ?? enc.client?.housingState ?? "").trim();
  const zip = String(enc.housingZip ?? enc.client?.housingZip ?? "").trim();
  if (!street && !city && !zip) return "–";
  const line1 = [street, apt].filter(Boolean).join(", ");
  const line2 = [city, state, zip].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join(" • ") || "–";
}

onMounted(async () => {
  loading.value = true;
  message.value = "";
  try {
    const [encRes, svcRes, lookupRes] = await Promise.all([
      EncounterServices.getOne(props.clientId, props.id),
      ClientServiceServices.getAll({ clientId: props.clientId, encounterId: props.id }),
      LookupServices.getByType("service_provided"),
    ]);
    encounter.value = encRes.data;
    clientServices.value = svcRes.data || [];
    services.value = lookupRes.data || [];
    serviceSelections.value = services.value.map((s) => ({
      id: s.id,
      value: s.value,
      requested: isRequestedForService(s.id),
      provided: isProvidedForService(s.id),
    }));
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading encounter.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>View Encounter</v-toolbar-title>
        <v-spacer />
        <v-btn color="primary" class="mr-2" @click="editEncounter">Edit</v-btn>
        <v-btn variant="outlined" @click="back">{{ embedded ? "Close" : "Back" }}</v-btn>
      </v-toolbar>
      <br />
      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
      <h4 v-if="message" class="text-error">{{ message }}</h4>
      <template v-else-if="encounter">
        <v-sheet class="rounded-lg mb-4 pa-4" border>
          <div class="text-subtitle-1 mb-3 font-weight-medium">Client</div>
          <span v-if="encounter.client" class="text-h6">{{ getClientName(encounter.client) }}</span>
          <span v-else>Client #{{ encounter.clientId }}</span>
          <div class="mt-3 text-body-2">
            <strong>Date:</strong> {{ Utils.formatDate(encounter.date) }} &nbsp;|&nbsp;
            <strong>Time:</strong> {{ getTimeDisplay(encounter) }}
          </div>
          <div class="mt-2 text-body-2">
            <strong>Phone:</strong> {{ formatPhoneForDisplay(encounter.phone || encounter.client?.phone) || "–" }}
          </div>
          <div class="mt-2 text-body-2">
            <strong>Encounter type:</strong> {{ encounter.encounterType?.value || "–" }}
          </div>
          <div class="mt-2 text-body-2">
            <strong>Current Status:</strong> {{ encounter.currentSituation?.value || "–" }}
          </div>
          <div class="mt-2 text-body-2">
            <strong>Currently taking drugs:</strong> {{ encounter.currentlyTakingDrugs ? "Yes" : "No" }}
          </div>
          <div class="mt-2 text-body-2">
            <strong>Housing Type:</strong> {{ encounter.housingType?.value || "–" }}
          </div>
          <div class="mt-2 text-body-2">
            <strong>Red/Green:</strong> {{ encounter.housingRedGreen || "–" }}
          </div>
          <div class="mt-2 text-body-2">
            <strong>Housing Location:</strong> {{ encounter.housingLocation?.value || "–" }}
          </div>
          <div v-if="showEncounterHousingAddress" class="mt-2 text-body-2">
            <strong>Housing address:</strong>
            <div class="mt-1">{{ formatEncounterHousingAddress(encounter) }}</div>
          </div>
          <div class="mt-2 text-body-2">
            <strong>Daytime Location:</strong> {{ encounter.daytimeLocation?.value || "–" }}
          </div>
          <div class="mt-2 text-body-2">
            <strong>Location:</strong> {{ getLocationDisplay(encounter.client?.intakeLocation) }}
          </div>
          <div class="mt-2 text-body-2">
            <strong>User:</strong> {{ getUserDisplay(encounter.user) }}
          </div>
          <div class="mt-2">
            <strong>Notes:</strong>
            <div class="mt-1 text-body-2">{{ encounter.notes || "–" }}</div>
          </div>
        </v-sheet>

        <v-sheet class="rounded-lg pa-0 overflow-hidden" border>
          <div class="text-subtitle-1 pa-3 bg-grey-lighten-3 font-weight-medium">Services Provided</div>
          <v-table density="compact">
            <thead>
              <tr>
                <th class="text-left">Services Provided</th>
                <th class="text-center" style="width: 120px">Requested</th>
                <th class="text-center" style="width: 120px">Provided</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="svc in serviceSelections" :key="svc.id">
                <td>{{ svc.value }}</td>
                <td class="text-center">
                  <v-checkbox
                    :model-value="svc.requested"
                    hide-details
                    density="compact"
                    color="primary"
                    disabled
                  />
                </td>
                <td class="text-center">
                  <v-checkbox
                    :model-value="svc.provided"
                    hide-details
                    density="compact"
                    color="success"
                    disabled
                  />
                </td>
              </tr>
              <tr v-if="!serviceSelections.length">
                <td colspan="3" class="text-center text-medium-emphasis">No services configured.</td>
              </tr>
            </tbody>
          </v-table>
        </v-sheet>
      </template>
    </v-container>
  </div>
</template>
