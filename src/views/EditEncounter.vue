<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import Utils from "../config/utils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";
import EncounterServices from "../services/encounterServices";

const router = useRouter();
const props = defineProps({
  clientId: { type: [String, Number], required: true },
  id: { type: [String, Number], required: true },
});
const message = ref("Edit encounter and click Save.");
const encounter = ref(null);
const record = ref({ notes: null });

const getClientName = (c) => {
  if (!c) return "–";
  const name = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ");
  return name || `#${c.id}`;
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

const save = () => {
  const payload = {
    notes: record.value.notes,
    date: encounter.value?.date,
    time: encounter.value?.time ? String(encounter.value.time).slice(0, 5) : null,
  };
  EncounterServices.update(props.clientId, props.id, payload)
    .then(() => router.push({ name: "encounters" }))
    .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
};

const cancel = () => router.push({ name: "encounters" });

onMounted(async () => {
  try {
    const res = await EncounterServices.getOne(props.clientId, props.id);
    const enc = res.data;
    if (enc) {
      encounter.value = enc;
      record.value = { notes: enc.notes || null };
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
          <strong>Phone:</strong> {{ formatPhoneForDisplay(encounter.client?.phone) || "–" }}
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
