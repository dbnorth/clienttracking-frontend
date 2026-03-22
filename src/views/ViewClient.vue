<script setup>
import { ref, onMounted } from "vue";
import ClientServices from "../services/clientServices";
import ClientServiceServices from "../services/clientserviceServices";
import LookupServices from "../services/lookupServices";
import ReferringOrganizationServices from "../services/referringOrganizationServices";
import LocationServices from "../services/locationServices";
import { useRouter } from "vue-router";
import Utils from "../config/utils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";

const router = useRouter();
const user = Utils.getStore("user");
const props = defineProps({
  id: { required: true },
  embedded: { type: Boolean, default: false },
});
const emit = defineEmits(["close"]);
const message = ref("");
const client = ref({});
const clientServices = ref([]);

const referralTypes = ref([]);
const organizations = ref([]);
const intakeLocations = ref([]);
const drugOfChoice = ref([]);
const housingTypes = ref([]);
const housingLocations = ref([]);
const races = ref([]);
const ethnicities = ref([]);
const genders = ref([]);
const initialSituations = ref([]);
const benefits = ref([]);
const serviceProvidedList = ref([]);

const loadLookups = async () => {
  try {
    const [r, o, loc, d, h, hl, race, ethn, g, init, b, s] = await Promise.all([
      LookupServices.getByType("referral_type"),
      ReferringOrganizationServices.getAll(),
      LocationServices.getAll(),
      LookupServices.getByType("drug_of_choice"),
      LookupServices.getByType("housing_type"),
      LookupServices.getByType("housing_location"),
      LookupServices.getByType("race"),
      LookupServices.getByType("ethnicity"),
      LookupServices.getByType("gender"),
      LookupServices.getByType("initial_situation"),
      LookupServices.getByType("benefit"),
      LookupServices.getByType("service_provided"),
    ]);
    referralTypes.value = r.data;
    organizations.value = o.data;
    intakeLocations.value = loc.data;
    drugOfChoice.value = d.data;
    housingTypes.value = h.data;
    housingLocations.value = hl.data;
    races.value = race.data;
    ethnicities.value = ethn.data;
    genders.value = g.data;
    initialSituations.value = init.data;
    benefits.value = b.data;
    serviceProvidedList.value = s.data;
  } catch (e) {}
};

const getServiceName = (id) => serviceProvidedList.value.find((x) => x.id === id)?.value || id;

const lookupValue = (arr, id) => (id ? arr.find((x) => x.id === id)?.value : null) || "–";
const lookupOrg = (id) => (id ? organizations.value.find((o) => o.id === id)?.name : null) || "–";
const intakeLocLabel = (id) => {
  const loc = intakeLocations.value.find((l) => l.id === id);
  return loc ? (loc.organization ? `${loc.organization.name} – ${loc.name}` : loc.name) : "–";
};
const benefitsDisplay = (client) => {
  const ids = Array.isArray(client.benefits) ? client.benefits : [];
  return ids.map((id) => benefits.value.find((b) => b.id === id)?.value).filter(Boolean).join(", ") || "–";
};

const retrieveData = async () => {
  try {
    const [cRes, sRes] = await Promise.all([
      ClientServices.get(props.id),
      ClientServiceServices.getAll({ clientId: props.id, userId: user?.userId ?? user?.id }),
    ]);
    client.value = cRes.data;
    clientServices.value = sRes.data || [];
    if (typeof client.value.benefits === "string") {
      try { client.value.benefits = JSON.parse(client.value.benefits) || []; } catch (_) { client.value.benefits = []; }
    }
    if (!Array.isArray(client.value.benefits)) client.value.benefits = [];
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading";
  }
};

const getStatusDate = (rec) => {
  if (rec.status === "provided" && rec.providedDate) return Utils.formatDate(rec.providedDate);
  if (rec.status === "cancelled" && rec.cancelledDate) return Utils.formatDate(rec.cancelledDate);
  if (rec.requestedDate) return Utils.formatDate(rec.requestedDate);
  return "–";
};

const editClient = () => {
  if (props.embedded) emit("close");
  router.push({ name: "editClient", params: { id: props.id } });
};

onMounted(async () => {
  await loadLookups();
  await retrieveData();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Client View</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn v-if="embedded" variant="outlined" class="mr-2" @click="emit('close')">Close</v-btn>
        <v-btn color="primary" @click="editClient">Edit Client</v-btn>
      </v-toolbar>
      <br />
      <h4 v-if="message" class="text-error">{{ message }}</h4>

      <template v-if="client.id">
        <v-sheet class="rounded-lg mb-4 pa-4" border>
          <div class="text-subtitle-1 mb-3 font-weight-medium">Client Info</div>
          <div class="text-body-2">
            <div class="mb-2"><strong>Name:</strong> {{ [client.firstName, client.middleName, client.lastName].filter(Boolean).join(' ') || '–' }}{{ client.suffix ? ` ${client.suffix}` : '' }}</div>
            <div class="mb-2"><strong>Birthdate:</strong> {{ Utils.formatDate(client.birthdate) || '–' }}</div>
            <div class="mb-2"><strong>Phone:</strong> {{ formatPhoneForDisplay(client.phone) || '–' }}</div>
            <div class="mb-2"><strong>Housing Type:</strong> {{ lookupValue(housingTypes, client.housingTypeId) }}</div>
            <div class="mb-2"><strong>Red/Green:</strong> {{ client.housingRedGreen || '–' }}</div>
            <div class="mb-2"><strong>Housing Location:</strong> {{ lookupValue(housingLocations, client.housingLocationId) }}</div>
            <template v-if="lookupValue(housingLocations, client.housingLocationId) === 'Address'">
              <div class="mb-2"><strong>Street:</strong> {{ client.housingStreet || '–' }}</div>
              <div class="mb-2"><strong>City:</strong> {{ client.housingCity || '–' }}</div>
              <div class="mb-2"><strong>State:</strong> {{ client.housingState || '–' }}</div>
              <div class="mb-2"><strong>Zip:</strong> {{ client.housingZip || '–' }}</div>
            </template>
          </div>
        </v-sheet>
        <v-sheet class="rounded-lg mb-4 pa-4" border>
          <div class="text-subtitle-1 mb-3 font-weight-medium">Contact Info</div>
          <div class="text-body-2">
            <div class="mb-2"><strong>Parent:</strong> {{ [client.parentFirstName, client.parentLastName].filter(Boolean).join(' ') || '–' }}</div>
            <div class="mb-2"><strong>Parent Phone:</strong> {{ formatPhoneForDisplay(client.parentPhone) || '–' }}</div>
            <div class="mb-2"><strong>Emergency Contact:</strong> {{ client.emergencyContactName || '–' }}</div>
            <div class="mb-2"><strong>Emergency Phone:</strong> {{ formatPhoneForDisplay(client.emergencyContactPhone) || '–' }}</div>
          </div>
        </v-sheet>
        <v-sheet class="rounded-lg mb-4 pa-4" border>
          <div class="text-subtitle-1 mb-3 font-weight-medium">Demographic</div>
          <div class="text-body-2">
            <div class="mb-2"><strong>Gender:</strong> {{ lookupValue(genders, client.genderId) }}</div>
            <div class="mb-2"><strong>Race:</strong> {{ lookupValue(races, client.raceId) }}</div>
            <div class="mb-2"><strong>Ethnicity:</strong> {{ lookupValue(ethnicities, client.ethnicityId) }}</div>
            <div class="mb-2"><strong>Initial Situation:</strong> {{ lookupValue(initialSituations, client.initialSituationId) }}</div>
          </div>
        </v-sheet>
        <v-sheet class="rounded-lg mb-4 pa-4" border>
          <div class="text-subtitle-1 mb-3 font-weight-medium">Referral</div>
          <div class="text-body-2">
            <div class="mb-2"><strong>Referral Type:</strong> {{ lookupValue(referralTypes, client.referralTypeId) }}</div>
            <div v-if="lookupValue(referralTypes, client.referralTypeId) === 'Organization'" class="mb-2">
              <strong>Organization:</strong> {{ lookupOrg(client.organizationId) }}
            </div>
            <div v-if="client.organizationId" class="mb-2"><strong>Case Worker:</strong> {{ client.referralCaseWorker || '–' }}</div>
            <div v-if="client.organizationId" class="mb-2"><strong>Referral Phone:</strong> {{ formatPhoneForDisplay(client.referralPhone) || '–' }}</div>
          </div>
        </v-sheet>
        <v-sheet class="rounded-lg mb-4 pa-4" border>
          <div class="text-subtitle-1 mb-3 font-weight-medium">Situation</div>
          <div class="text-body-2">
            <div class="mb-2"><strong>Drug of Choice:</strong> {{ lookupValue(drugOfChoice, client.drugOfChoiceId) }}</div>
            <div class="mb-2"><strong>Drug Method:</strong> {{ client.drugMethod || '–' }}</div>
            <div class="mb-2"><strong>Benefits:</strong> {{ benefitsDisplay(client) }}</div>
          </div>
        </v-sheet>
        <v-sheet class="rounded-lg mb-4 pa-4" border>
          <div class="text-subtitle-1 mb-3 font-weight-medium">Organization Info</div>
          <div class="text-body-2">
            <div class="mb-2"><strong>Intake Location:</strong> {{ intakeLocLabel(client.intakeLocationId) }}</div>
            <div class="mb-2"><strong>Status:</strong> {{ client.status || '–' }}</div>
          </div>
        </v-sheet>
      </template>

      <v-card class="mt-6">
        <v-card-title>Services</v-card-title>
        <v-card-text>
          <v-table>
            <thead>
              <tr>
                <th class="text-left">Service</th>
                <th class="text-left">Status</th>
                <th class="text-left">Requested Date</th>
                <th class="text-left">Provided / Cancelled Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rec in clientServices" :key="rec.id">
                <td>{{ rec.serviceProvided?.value || getServiceName(rec.serviceProvidedId) }}</td>
                <td>
                  <v-chip
                    :color="rec.status === 'provided' ? 'success' : rec.status === 'cancelled' ? 'error' : 'primary'"
                    size="small"
                    variant="tonal"
                  >
                    {{ rec.status }}
                  </v-chip>
                </td>
                <td>{{ Utils.formatDate(rec.requestedDate) || '–' }}</td>
                <td>{{ getStatusDate(rec) }}</td>
              </tr>
              <tr v-if="!clientServices.length">
                <td colspan="4" class="text-center">No services recorded.</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>
