<script setup>
import { ref, onMounted } from "vue";
import ClientServices from "../services/clientServices";
import LookupServices from "../services/lookupServices";
import ReferringOrganizationServices from "../services/referringOrganizationServices";
import LocationServices from "../services/locationServices";
import { useRouter } from "vue-router";
import { phoneRule } from "../utils/phoneUtils.js";
import { toProperNameCase } from "../utils/nameCaseUtils.js";
import ClientForm from "../components/ClientForm.vue";
import {
  lookupQueryOpts,
  organizationIdForClientRecordLookups,
} from "../utils/lookupOrgUtils.js";

const router = useRouter();
const props = defineProps({ id: { required: true } });
const clientFormRef = ref(null);
const message = ref("Edit client data and click Save");

const referralTypes = ref([]);
const organizations = ref([]);
const intakeLocations = ref([]);
const drugOfChoice = ref([]);
const housingTypes = ref([]);
const housingLocations = ref([]);
const daytimeLocations = ref([]);
const races = ref([]);
const ethnicities = ref([]);
const genders = ref([]);
const initialSituations = ref([]);
const benefits = ref([]);
const client = ref({});

const loadStaticRefs = async () => {
  const [o, loc] = await Promise.all([
    ReferringOrganizationServices.getAll(),
    LocationServices.getAll(),
  ]);
  organizations.value = o.data;
  intakeLocations.value = loc.data;
};

const reloadTypeLookups = async () => {
  const opts = lookupQueryOpts(
    organizationIdForClientRecordLookups(client.value, intakeLocations.value)
  );
  const [r, d, h, hl, dl, race, ethn, g, init, b] = await Promise.all([
    LookupServices.getByType("referral_type", opts),
    LookupServices.getByType("drug_of_choice", opts),
    LookupServices.getByType("housing_type", opts),
    LookupServices.getByType("housing_location", opts),
    LookupServices.getByType("daytime_location", opts),
    LookupServices.getByType("race", opts),
    LookupServices.getByType("ethnicity", opts),
    LookupServices.getByType("gender", opts),
    LookupServices.getByType("initial_situation", opts),
    LookupServices.getByType("benefit", opts),
  ]);
  referralTypes.value = r.data;
  drugOfChoice.value = d.data;
  housingTypes.value = h.data;
  housingLocations.value = hl.data;
  daytimeLocations.value = dl.data;
  races.value = race.data;
  ethnicities.value = ethn.data;
  genders.value = g.data;
  initialSituations.value = init.data;
  benefits.value = b.data;
};

const retrieveClient = async () => {
  try {
    const res = await ClientServices.get(props.id);
    client.value = res.data;
    if (typeof client.value.benefits === "string") {
      try { client.value.benefits = JSON.parse(client.value.benefits) || []; } catch (_) { client.value.benefits = []; }
    }
    if (!Array.isArray(client.value.benefits)) client.value.benefits = [];
    if (client.value.organizationId && client.value.organization) {
      client.value.referralCaseWorker = client.value.organization.caseWorkerName || "";
      client.value.referralPhone = client.value.organization.phone || "";
    }
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading client";
  }
};

const saveClient = async () => {
  const { valid } = (await clientFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  for (const field of ["parentPhone", "referralPhone"]) {
    const err = phoneRule(client.value[field]);
    if (err !== true) {
      message.value = err;
      return;
    }
  }
  const payload = {
    ...client.value,
    firstName: toProperNameCase(client.value.firstName),
    middleName: toProperNameCase(client.value.middleName),
    lastName: toProperNameCase(client.value.lastName),
    nickname: toProperNameCase(client.value.nickname),
    parentFirstName: toProperNameCase(client.value.parentFirstName),
    parentLastName: toProperNameCase(client.value.parentLastName),
  };
  ClientServices.update(props.id, payload)
    .then(() => router.push({ name: "clients" }))
    .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
};

const cancel = () => router.push({ name: "clients" });

onMounted(async () => {
  try {
    await loadStaticRefs();
    await retrieveClient();
    await reloadTypeLookups();
  } catch (e) {
    message.value = "Error loading lookup data";
  }
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Edit Client</v-toolbar-title>
      </v-toolbar>
      <br />
      <h4>{{ message }}</h4>
      <br />
      <ClientForm ref="clientFormRef" v-if="client.id" v-model="client" :referral-types="referralTypes" :organizations="organizations"
        :intake-locations="intakeLocations" :drug-of-choice="drugOfChoice" :housing-types="housingTypes"
        :housing-locations="housingLocations" :daytime-locations="daytimeLocations" :races="races" :ethnicities="ethnicities" :genders="genders" :initial-situations="initialSituations" :benefits="benefits" />
      <div class="d-flex align-center mt-4">
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn color="primary" @click="saveClient">Save</v-btn>
      </div>
    </v-container>
  </div>
</template>
