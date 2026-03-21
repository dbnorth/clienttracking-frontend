<script setup>
import { ref, onMounted } from "vue";
import ClientForm from "../components/ClientForm.vue";
import ClientServices from "../services/clientServices";
import LookupServices from "../services/lookupServices";
import ReferringOrganizationServices from "../services/referringOrganizationServices";
import LocationServices from "../services/locationServices";
import OrganizationServices from "../services/organizationServices";
import Utils from "../config/utils.js";
import { useRouter } from "vue-router";

const router = useRouter();
const valid = ref(true);
const user = Utils.getStore("user");
const message = ref("Enter client data and click Save");

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

const client = ref({
  firstName: "",
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
  housingStreet: "",
  housingCity: "",
  housingState: "",
  housingZip: "",
  benefits: [],
  status: "Active",
  userId: user?.userId,
});

const loadLookups = async () => {
  try {
    const [r, o, loc, d, h, hl, race, ethn, g, init, b] = await Promise.all([
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


const saveClient = () => {
  const data = { ...client.value };
  data.dateOfFirstContact = new Date().toISOString().split("T")[0];
  data.statusChangeDate = data.dateOfFirstContact;
  data.userId = user?.userId;

  ClientServices.create(data)
    .then(() => router.push({ name: "clients" }))
    .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
};

const cancel = () => router.push({ name: "clients" });

onMounted(() => loadLookups());
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
      <ClientForm v-model="client" :referral-types="referralTypes" :organizations="organizations"
        :intake-locations="intakeLocations" :drug-of-choice="drugOfChoice" :housing-types="housingTypes"
        :housing-locations="housingLocations" :races="races" :ethnicities="ethnicities" :genders="genders" :initial-situations="initialSituations" :benefits="benefits" />
      <v-btn color="success" class="mr-4 mt-4" @click="saveClient">Save</v-btn>
      <v-btn color="error" class="mr-4 mt-4" @click="cancel">Cancel</v-btn>
    </v-container>
  </div>
</template>
