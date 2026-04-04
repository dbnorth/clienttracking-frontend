<script setup>
import { ref, onMounted, nextTick, watch } from "vue";
import ClientForm from "../components/ClientForm.vue";
import ClientServices from "../services/clientServices";
import LookupServices from "../services/lookupServices";
import ReferringOrganizationServices from "../services/referringOrganizationServices";
import LocationServices from "../services/locationServices";
import OrganizationServices from "../services/organizationServices";
import Utils from "../config/utils.js";
import { phoneRule } from "../utils/phoneUtils.js";
import { toProperNameCase } from "../utils/nameCaseUtils.js";
import {
  lookupQueryOpts,
  organizationIdForAddClientLookups,
} from "../utils/lookupOrgUtils.js";
import { useRouter } from "vue-router";

const router = useRouter();
const clientFormRef = ref(null);
const saving = ref(false);
const user = Utils.getStore("user");
const message = ref("Enter client data and click Save");

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

const client = ref({
  firstName: "",
  nickname: "",
  middleName: "",
  lastName: "",
  suffix: "",
  birthdate: null,
  raceId: null,
  ethnicityId: null,
  genderId: null,
  initialSituationId: null,
  parentFirstName: "",
  parentLastName: "",
  parentPhone: "",
  phone: "",
  emergencyContactName: "Delesa Jones",
  emergencyContactPhone: "",
  referralTypeId: null,
  organizationId: null,
  intakeLocationId: user?.currentLocationId ?? null,
  referralCaseWorker: "",
  referralPhone: "",
  drugOfChoiceId: null,
  drugMethod: null,
  housingTypeId: null,
  housingRedGreen: null,
  housingLocationId: null,
  daytimeLocationId: null,
  daytimeLocationOther: "",
  housingStreet: "",
  housingApt: "",
  housingCity: "",
  housingState: "OK",
  housingZip: "",
  benefits: [],
  status: "Active",
  userId: user?.userId,
});

const clearLookupSelections = () => {
  client.value.raceId = null;
  client.value.ethnicityId = null;
  client.value.genderId = null;
  client.value.initialSituationId = null;
  client.value.referralTypeId = null;
  client.value.drugOfChoiceId = null;
  client.value.housingTypeId = null;
  client.value.housingLocationId = null;
  client.value.daytimeLocationId = null;
  client.value.benefits = [];
};

const reloadTypeLookups = async () => {
  const orgId = organizationIdForAddClientLookups(
    client.value.intakeLocationId,
    intakeLocations.value
  );
  const opts = lookupQueryOpts(orgId);
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

const loadLookups = async () => {
  try {
    const [o, loc] = await Promise.all([
      ReferringOrganizationServices.getAll(),
      LocationServices.getAll(),
    ]);
    organizations.value = o.data;
    intakeLocations.value = loc.data;
    await reloadTypeLookups();
    const org = user?.organization;
    if (org) {
      client.value.emergencyContactName = org.contactName || client.value.emergencyContactName;
      client.value.emergencyContactPhone = org.phoneNumber || client.value.emergencyContactPhone;
    } else if (user?.organizationId) {
      try {
        const orgRes = await OrganizationServices.get(user.organizationId);
        const fetchedOrg = orgRes.data;
        if (fetchedOrg) {
          client.value.emergencyContactName = fetchedOrg.contactName || client.value.emergencyContactName;
          client.value.emergencyContactPhone = fetchedOrg.phoneNumber || client.value.emergencyContactPhone;
        }
      } catch (_) {}
    }
  } catch (e) {
    message.value = "Error loading lookup data";
  }
};

watch(
  () => client.value.intakeLocationId,
  async (newId, oldId) => {
    if (oldId === undefined) return;
    const prevOrg = organizationIdForAddClientLookups(oldId, intakeLocations.value);
    const nextOrg = organizationIdForAddClientLookups(newId, intakeLocations.value);
    if (prevOrg !== nextOrg) {
      clearLookupSelections();
    }
    try {
      await reloadTypeLookups();
    } catch (_) {
      message.value = "Error loading lookup data";
    }
  }
);


/** Validates form and phone rules; returns payload for POST or null. */
const prepareClientPayload = async () => {
  const { valid } = (await clientFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return null;
  for (const field of ["parentPhone", "referralPhone"]) {
    const err = phoneRule(client.value[field]);
    if (err !== true) {
      message.value = err;
      return null;
    }
  }
  const data = { ...client.value };
  data.firstName = toProperNameCase(data.firstName);
  data.middleName = toProperNameCase(data.middleName);
  data.lastName = toProperNameCase(data.lastName);
  data.nickname = toProperNameCase(data.nickname);
  data.parentFirstName = toProperNameCase(data.parentFirstName);
  data.parentLastName = toProperNameCase(data.parentLastName);
  data.dateOfFirstContact = new Date().toISOString().split("T")[0];
  data.statusChangeDate = data.dateOfFirstContact;
  data.userId = user?.userId;
  return data;
};

const saveClient = async () => {
  const data = await prepareClientPayload();
  if (!data) return;
  saving.value = true;
  message.value = "Saving...";
  try {
    await ClientServices.create(data);
    router.back();
  } catch (e) {
    message.value = e.response?.data?.message || "Error saving";
  } finally {
    saving.value = false;
  }
};

const saveClientAndAddEncounter = async () => {
  const data = await prepareClientPayload();
  if (!data) return;
  saving.value = true;
  message.value = "Saving...";
  try {
    const res = await ClientServices.create(data);
    const id = res.data?.id;
    if (id == null) {
      message.value = "Client was saved but no id was returned. Add an encounter from the client list.";
      return;
    }
    router.push({
      name: "addEncounter",
      query: { clientId: String(id), from: "addClient" },
    });
  } catch (e) {
    message.value = e.response?.data?.message || "Error saving";
  } finally {
    saving.value = false;
  }
};

const cancel = () => router.back();

onMounted(async () => {
  await loadLookups();
  await nextTick();
  clientFormRef.value?.focusFirstField?.();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Add Client</v-toolbar-title>
      </v-toolbar>
      <br />
      <h4>{{ message }}</h4>
      <br />
      <ClientForm ref="clientFormRef" v-model="client" :referral-types="referralTypes" :organizations="organizations"
        :intake-locations="intakeLocations" :drug-of-choice="drugOfChoice" :housing-types="housingTypes"
        :housing-locations="housingLocations" :daytime-locations="daytimeLocations" :races="races" :ethnicities="ethnicities" :genders="genders" :initial-situations="initialSituations" :benefits="benefits" />
      <div class="d-flex align-center flex-wrap ga-2 mt-4">
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="cancel">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="saving" @click="saveClient">Save</v-btn>
        <v-btn color="primary" variant="tonal" :loading="saving" :disabled="saving" @click="saveClientAndAddEncounter">
          Save &amp; add encounter
        </v-btn>
      </div>
    </v-container>
  </div>
</template>
