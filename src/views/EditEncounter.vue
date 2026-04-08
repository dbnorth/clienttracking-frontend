<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import Utils from "../config/utils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";
import EncounterServices from "../services/encounterServices";
import LookupServices from "../services/lookupServices";
import { getClientFullDisplayName } from "../utils/clientNameUtils.js";
import { lookupQueryOpts, organizationIdFromClientEmbedded } from "../utils/lookupOrgUtils.js";
import PhoneInput from "../components/PhoneInput.vue";

const router = useRouter();
const props = defineProps({
  clientId: { type: [String, Number], required: true },
  id: { type: [String, Number], required: true },
});
const message = ref("Edits apply to this encounter only and do not change the client profile. Click Save when done.");
const encounter = ref(null);
const record = ref({
  notes: null,
  encounterTypeId: null,
  currentSituationId: null,
  currentlyTakingDrugs: false,
  housingTypeId: null,
  housingRedGreen: null,
  housingLocationId: null,
  daytimeLocationId: null,
  phone: "",
  housingStreet: "",
  housingApt: "",
  housingCity: "",
  housingState: "",
  housingZip: "",
});
const encounterTypes = ref([]);
const initialSituations = ref([]);
const housingTypes = ref([]);
const housingLocations = ref([]);
const daytimeLocations = ref([]);

const getClientName = (c) => {
  if (!c) return "–";
  return getClientFullDisplayName(c) || "–";
};

const getTimeDisplay = (t) => {
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

function normalizeStateAbbrev(v) {
  return String(v ?? "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

const showHousingAddress = computed(() => {
  const id = record.value.housingLocationId;
  if (id == null || id === "") return false;
  const selected = housingLocations.value.find((l) => Number(l.id) === Number(id));
  return selected?.value === "Address";
});

watch(
  () => record.value.housingLocationId,
  (hid) => {
    const selected = housingLocations.value.find((l) => Number(l.id) === Number(hid));
    if (selected?.value !== "Address") {
      record.value.housingStreet = "";
      record.value.housingApt = "";
      record.value.housingCity = "";
      record.value.housingState = "";
      record.value.housingZip = "";
    }
  }
);

watch(showHousingAddress, (show) => {
  if (show && !String(record.value.housingState ?? "").trim()) {
    record.value.housingState = "OK";
  }
});

async function loadSituationLookups(client) {
  const opts = lookupQueryOpts(organizationIdFromClientEmbedded(client || {}));
  const [init, ht, hl, dl] = await Promise.all([
    LookupServices.getByType("initial_situation", opts),
    LookupServices.getByType("housing_type", opts),
    LookupServices.getByType("housing_location", opts),
    LookupServices.getByType("daytime_location", opts),
  ]);
  initialSituations.value = init.data || [];
  housingTypes.value = ht.data || [];
  housingLocations.value = hl.data || [];
  daytimeLocations.value = dl.data || [];
}

const trimOrNull = (s) => {
  const t = String(s ?? "").trim();
  return t || null;
};

const save = () => {
  if (showHousingAddress.value) {
    if (!String(record.value.housingStreet ?? "").trim()) {
      message.value = "Street is required when Housing location is Address.";
      return;
    }
    if (!String(record.value.housingCity ?? "").trim()) {
      message.value = "City is required when Housing location is Address.";
      return;
    }
    if (!String(record.value.housingState ?? "").trim()) {
      message.value = "State is required when Housing location is Address.";
      return;
    }
    if (!String(record.value.housingZip ?? "").trim()) {
      message.value = "Zip is required when Housing location is Address.";
      return;
    }
  }
  const payload = {
    notes: record.value.notes,
    date: encounter.value?.date,
    time: encounter.value?.time ? String(encounter.value.time).slice(0, 5) : null,
    encounterTypeId: record.value.encounterTypeId || null,
    currentSituationId: record.value.currentSituationId,
    currentlyTakingDrugs: record.value.currentlyTakingDrugs,
    housingTypeId: record.value.housingTypeId,
    housingRedGreen: record.value.housingRedGreen,
    housingLocationId: record.value.housingLocationId,
    daytimeLocationId: record.value.daytimeLocationId,
    phone: record.value.phone?.trim() || null,
    housingStreet: showHousingAddress.value ? trimOrNull(record.value.housingStreet) : null,
    housingApt: showHousingAddress.value ? trimOrNull(record.value.housingApt) : null,
    housingCity: showHousingAddress.value ? trimOrNull(record.value.housingCity) : null,
    housingState: showHousingAddress.value ? trimOrNull(normalizeStateAbbrev(record.value.housingState)) : null,
    housingZip: showHousingAddress.value ? trimOrNull(record.value.housingZip) : null,
  };
  EncounterServices.update(props.clientId, props.id, payload)
    .then(() => router.push({ name: "encounters" }))
    .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
};

const cancel = () => router.push({ name: "encounters" });

onMounted(async () => {
  try {
    const [encRes, typeRes] = await Promise.all([
      EncounterServices.getOne(props.clientId, props.id),
      LookupServices.getByType("encounter_type"),
    ]);
    encounterTypes.value = typeRes.data || [];
    const enc = encRes.data;
    if (enc) {
      encounter.value = enc;
      await loadSituationLookups(enc.client);
      record.value = {
        notes: enc.notes || null,
        encounterTypeId: enc.encounterTypeId ?? enc.encounterType?.id ?? null,
        currentSituationId: enc.currentSituationId ?? enc.currentSituation?.id ?? null,
        currentlyTakingDrugs: !!enc.currentlyTakingDrugs,
        housingTypeId: enc.housingTypeId ?? enc.housingType?.id ?? null,
        housingRedGreen: enc.housingRedGreen ?? null,
        housingLocationId: enc.housingLocationId ?? enc.housingLocation?.id ?? null,
        daytimeLocationId: enc.daytimeLocationId ?? enc.daytimeLocation?.id ?? null,
        phone: enc.phone ?? enc.client?.phone ?? "",
        housingStreet: enc.housingStreet ?? enc.client?.housingStreet ?? "",
        housingApt: enc.housingApt ?? enc.client?.housingApt ?? "",
        housingCity: enc.housingCity ?? enc.client?.housingCity ?? "",
        housingState: enc.housingState ? normalizeStateAbbrev(enc.housingState) : enc.client?.housingState ? normalizeStateAbbrev(enc.client.housingState) : "",
        housingZip: enc.housingZip ?? enc.client?.housingZip ?? "",
      };
    }
  } catch (e) {
    message.value = e.response?.data?.message || "Error loading encounter.";
  }
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Edit Encounter</v-toolbar-title>
      </v-toolbar>
      <br />
      <h4>{{ message }}</h4>
      <br />
      <v-sheet v-if="encounter" class="rounded-lg mb-4 pa-4" border>
        <div class="text-subtitle-1 mb-3 font-weight-medium">Encounter</div>
        <div class="text-body-2">
          <strong>Client:</strong> {{ encounter.client ? getClientName(encounter.client) : `#${encounter.clientId}` }}
        </div>
        <div class="mt-1 text-body-2">
          <strong>Client record phone:</strong> {{ formatPhoneForDisplay(encounter.client?.phone) || "–" }}
        </div>
        <div class="mt-1 text-body-2">
          <strong>Date:</strong> {{ Utils.formatDate(encounter.date) }} &nbsp;|&nbsp;
          <strong>Time:</strong> {{ getTimeDisplay(encounter.time) }}
        </div>
        <div class="mt-1 text-body-2">
          <strong>User:</strong> {{ getUserDisplay(encounter.user) }}
        </div>
        <div class="mt-1 text-body-2">
          <strong>Location:</strong> {{ getLocationDisplay(encounter.client?.intakeLocation) }}
        </div>
      </v-sheet>
      <v-form>
        <v-row>
          <v-col cols="12" md="4">
            <v-select
              v-model="record.encounterTypeId"
              :items="encounterTypes"
              item-title="value"
              item-value="id"
              label="Encounter Type"
              clearable
              density="compact"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="record.currentSituationId"
              :items="initialSituations"
              item-title="value"
              item-value="id"
              label="Current Status"
              clearable
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="6" class="d-flex align-center">
            <v-checkbox
              v-model="record.currentlyTakingDrugs"
              label="Currently taking drugs"
              hide-details
              density="compact"
              color="primary"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="4">
            <v-select
              v-model="record.housingTypeId"
              :items="housingTypes"
              item-title="value"
              item-value="id"
              label="Housing Type"
              clearable
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="record.housingRedGreen"
              :items="['Red', 'Green']"
              label="Red/Green"
              clearable
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="record.housingLocationId"
              :items="housingLocations"
              item-title="value"
              item-value="id"
              label="Housing Location"
              clearable
              density="compact"
            />
          </v-col>
        </v-row>
        <v-row v-if="showHousingAddress" dense>
          <v-col cols="12" md="4">
            <v-text-field v-model="record.housingStreet" label="Street *" density="compact" hide-details />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field v-model="record.housingApt" label="Apt #" placeholder="Optional" density="compact" hide-details />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field v-model="record.housingCity" label="City *" density="compact" hide-details />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              :model-value="normalizeStateAbbrev(record.housingState)"
              label="State *"
              maxlength="2"
              placeholder="OK"
              density="compact"
              hide-details
              autocapitalize="characters"
              @update:model-value="record.housingState = normalizeStateAbbrev($event)"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field v-model="record.housingZip" label="Zip *" density="compact" hide-details />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="record.daytimeLocationId"
              :items="daytimeLocations"
              item-title="value"
              item-value="id"
              label="Daytime Location"
              clearable
              density="compact"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <PhoneInput v-model="record.phone" label="Phone (on this encounter)" hide-details />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="8">
            <v-textarea v-model="record.notes" label="Notes" density="compact" rows="3" />
          </v-col>
        </v-row>
      </v-form>
      <div class="d-flex align-center mt-4">
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn color="primary" @click="save">Save</v-btn>
      </div>
    </v-container>
  </div>
</template>
