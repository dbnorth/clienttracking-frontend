<script setup>
import { watch, computed, ref } from "vue";
import PhoneInput from "./PhoneInput.vue";
import { toProperNameCase } from "../utils/nameCaseUtils.js";

const formRef = ref(null);
const firstNameFieldRef = ref(null);
const requiredText = [(v) => !!v?.trim() || "Required"];
const requiredSelect = [(v) => (v != null && v !== "") || "Required"];
const requiredDate = [(v) => !!v || "Required"];

const props = defineProps({
  modelValue: { type: Object, required: true },
  referralTypes: { type: Array, default: () => [] },
  organizations: { type: Array, default: () => [] },
  intakeLocations: { type: Array, default: () => [] },
  drugOfChoice: { type: Array, default: () => [] },
  housingTypes: { type: Array, default: () => [] },
  housingLocations: { type: Array, default: () => [] },
  daytimeLocations: { type: Array, default: () => [] },
  races: { type: Array, default: () => [] },
  ethnicities: { type: Array, default: () => [] },
  genders: { type: Array, default: () => [] },
  initialSituations: { type: Array, default: () => [] },
  benefits: { type: Array, default: () => [] },
  readOnly: { type: Boolean, default: false },
  /** When true (add client): Current Status is disabled (mirrors Initial Situation). When false (edit): Initial Situation is disabled. */
  isAddMode: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

const showReferringOrganization = computed(() => {
  if (!props.modelValue.referralTypeId) return false;
  const selected = props.referralTypes.find((r) => r.id === props.modelValue.referralTypeId);
  return selected?.value === "Organization";
});

const showReferralContact = computed(() => !!props.modelValue.organizationId);

const showHousingAddress = computed(() => {
  if (!props.modelValue.housingLocationId) return false;
  const selected = props.housingLocations.find((l) => l.id === props.modelValue.housingLocationId);
  return selected?.value === "Address";
});

const showDaytimeLocationOther = computed(() => {
  if (!props.modelValue.daytimeLocationId) return false;
  const selected = props.daytimeLocations.find((l) => l.id === props.modelValue.daytimeLocationId);
  return selected?.value === "Other";
});

const daytimeOtherRules = computed(() =>
  showDaytimeLocationOther.value && !props.readOnly
    ? [(v) => !!String(v ?? "").trim() || "Description required when Other is selected"]
    : []
);

const initialSituationDisabled = computed(() => props.readOnly || !props.isAddMode);
const currentStatusDisabled = computed(() => props.readOnly || props.isAddMode);

const intakeLocationsWithLabel = computed(() =>
  props.intakeLocations.map((loc) => ({
    ...loc,
    displayName: loc.organization ? `${loc.organization.name} – ${loc.name}` : loc.name,
  }))
);

watch(
  () => props.modelValue.organizationId,
  (id) => {
    const org = props.organizations.find((o) => o.id === id);
    if (org) {
      emit("update:modelValue", {
        ...props.modelValue,
        referralCaseWorker: org.caseWorkerName || props.modelValue.referralCaseWorker || "",
        referralPhone: org.phone || props.modelValue.referralPhone || "",
      });
    }
  }
);

watch(
  () => props.modelValue.referralTypeId,
  (id) => {
    const selected = props.referralTypes.find((r) => r.id === id);
    if (selected?.value !== "Organization" && props.modelValue.organizationId) {
      emit("update:modelValue", {
        ...props.modelValue,
        organizationId: null,
        referralCaseWorker: "",
        referralPhone: "",
      });
    }
  }
);

watch(
  () => props.modelValue.housingLocationId,
  (id) => {
    const selected = props.housingLocations.find((l) => l.id === id);
    if (
      selected?.value !== "Address" &&
      (props.modelValue.housingStreet ||
        props.modelValue.housingApt ||
        props.modelValue.housingCity ||
        props.modelValue.housingState ||
        props.modelValue.housingZip)
    ) {
      emit("update:modelValue", {
        ...props.modelValue,
        housingStreet: "",
        housingApt: "",
        housingCity: "",
        housingState: "",
        housingZip: "",
      });
    }
  }
);

watch(
  () => props.modelValue.daytimeLocationId,
  (id) => {
    const selected = props.daytimeLocations.find((l) => l.id === id);
    if (selected?.value !== "Other" && props.modelValue.daytimeLocationOther) {
      emit("update:modelValue", {
        ...props.modelValue,
        daytimeLocationId: id,
        daytimeLocationOther: "",
      });
    }
  }
);

watch(
  () => props.modelValue.organizationId,
  (id) => {
    if (!id && (props.modelValue.referralCaseWorker || props.modelValue.referralPhone)) {
      emit("update:modelValue", {
        ...props.modelValue,
        referralCaseWorker: "",
        referralPhone: "",
      });
    }
  }
);

/** US state abbreviation: letters only, max 2, uppercase. */
const normalizeStateAbbrev = (v) =>
  String(v ?? "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();

watch(showHousingAddress, (show) => {
  if (show && !props.readOnly && !String(props.modelValue.housingState ?? "").trim()) {
    emit("update:modelValue", {
      ...props.modelValue,
      housingState: "OK",
    });
  }
});

watch(
  () => props.modelValue.housingState,
  (s) => {
    if (props.readOnly) return;
    const n = normalizeStateAbbrev(s);
    if (String(s ?? "") !== n) {
      emit("update:modelValue", {
        ...props.modelValue,
        housingState: n,
      });
    }
  },
  { immediate: true }
);

const validate = () => formRef.value?.validate();

const focusFirstField = () => {
  if (props.readOnly) return;
  const field = firstNameFieldRef.value;
  if (field && typeof field.focus === "function") {
    field.focus();
  } else {
    const input = field?.$el?.querySelector?.("input");
    input?.focus?.();
  }
};

const commitClientName = (key) => {
  if (props.readOnly) return;
  const raw = props.modelValue[key];
  const formatted = toProperNameCase(raw);
  if ((raw ?? "") === formatted) return;
  emit("update:modelValue", { ...props.modelValue, [key]: formatted });
};

defineExpose({ validate, focusFirstField });
</script>

<template>
  <v-form ref="formRef" validate-on="submit lazy">
    <div class="text-caption text-medium-emphasis mb-3">* required field</div>
    <!-- Client Info -->
    <v-sheet class="rounded-lg mb-4 pa-0 overflow-hidden" border>
      <div class="text-subtitle-1 pa-3 bg-grey-lighten-3 font-weight-medium">Client Info</div>
      <div class="pa-4">
        <div class="text-caption text-medium-emphasis mb-2">Legal name</div>
        <v-row>
          <v-col cols="12" md="3">
            <v-text-field
              ref="firstNameFieldRef"
              :model-value="modelValue.firstName"
              label="First Name *"
              :readonly="readOnly"
              :rules="readOnly ? [] : requiredText"
              density="compact"
              @update:model-value="(v) => $emit('update:modelValue', { ...modelValue, firstName: v })"
              @blur="() => commitClientName('firstName')"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              :model-value="modelValue.middleName"
              label="Middle"
              :readonly="readOnly"
              density="compact"
              @update:model-value="(v) => $emit('update:modelValue', { ...modelValue, middleName: v })"
              @blur="() => commitClientName('middleName')"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              :model-value="modelValue.lastName"
              label="Last Name *"
              :readonly="readOnly"
              :rules="readOnly ? [] : requiredText"
              density="compact"
              @update:model-value="(v) => $emit('update:modelValue', { ...modelValue, lastName: v })"
              @blur="() => commitClientName('lastName')"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="modelValue.suffix" label="Suffix" :readonly="readOnly" density="compact" />
          </v-col>
        </v-row>
        <v-row class="mt-0">
          <v-col cols="12" md="6">
            <v-text-field
              :model-value="modelValue.nickname"
              label="Nickname / goes by"
              placeholder="Optional"
              :readonly="readOnly"
              density="compact"
              @update:model-value="(v) => $emit('update:modelValue', { ...modelValue, nickname: v })"
              @blur="() => commitClientName('nickname')"
            />
          </v-col>
        </v-row>
        <v-row class="mt-0">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="modelValue.birthdate"
              type="date"
              label="Birthdate *"
              :readonly="readOnly"
              :rules="readOnly ? [] : requiredDate"
              density="compact"
              @update:model-value="(v) => $emit('update:modelValue', { ...modelValue, birthdate: v })"
            />
          </v-col>
          <v-col cols="12" md="4">
            <PhoneInput
              :model-value="modelValue.phone"
              label="Client Phone *"
              :readonly="readOnly"
              required
              @update:model-value="$emit('update:modelValue', { ...modelValue, phone: $event })"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="4">
            <v-select v-model="modelValue.housingTypeId" :items="housingTypes" item-title="value" item-value="id"
              label="Housing Type" clearable :readonly="readOnly" density="compact" />
          </v-col>
          <v-col cols="12" md="2">
            <v-select v-model="modelValue.housingRedGreen" :items="['Red','Green']" label="Red/Green" clearable :readonly="readOnly" density="compact" />
          </v-col>
          <v-col cols="12" md="4">
            <v-select v-model="modelValue.housingLocationId" :items="housingLocations" item-title="value" item-value="id"
              label="Housing Location" clearable :readonly="readOnly" density="compact" />
          </v-col>
        </v-row>
        <v-row v-if="showHousingAddress">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="modelValue.housingStreet"
              label="Street *"
              :readonly="readOnly"
              :rules="readOnly ? [] : requiredText"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              v-model="modelValue.housingApt"
              label="Apt #"
              placeholder="Optional"
              :readonly="readOnly"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              v-model="modelValue.housingCity"
              label="City *"
              :readonly="readOnly"
              :rules="readOnly ? [] : requiredText"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              :model-value="normalizeStateAbbrev(modelValue.housingState)"
              label="State *"
              maxlength="2"
              placeholder="OK"
              :readonly="readOnly"
              :rules="readOnly ? [] : requiredText"
              density="compact"
              autocapitalize="characters"
              @update:model-value="
                (v) =>
                  $emit('update:modelValue', {
                    ...modelValue,
                    housingState: normalizeStateAbbrev(v),
                  })
              "
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              v-model="modelValue.housingZip"
              label="Zip *"
              :readonly="readOnly"
              :rules="readOnly ? [] : requiredText"
              density="compact"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="4">
            <v-select
              :model-value="modelValue.daytimeLocationId"
              :items="daytimeLocations"
              item-title="value"
              item-value="id"
              label="Daytime location"
              clearable
              :readonly="readOnly"
              density="compact"
              hide-details="auto"
              @update:model-value="
                (v) => $emit('update:modelValue', { ...modelValue, daytimeLocationId: v })
              "
            />
          </v-col>
          <v-col v-if="showDaytimeLocationOther" cols="12" md="8">
            <v-text-field
              :model-value="modelValue.daytimeLocationOther"
              label="Daytime location description *"
              placeholder="Describe when Other is selected"
              :readonly="readOnly"
              :rules="readOnly ? [] : daytimeOtherRules"
              density="compact"
              hide-details="auto"
              @update:model-value="
                (v) => $emit('update:modelValue', { ...modelValue, daytimeLocationOther: v })
              "
            />
          </v-col>
        </v-row>
      </div>
    </v-sheet>

    <!-- Contact Info -->
    <v-sheet class="rounded-lg mb-4 pa-0 overflow-hidden" border>
      <div class="text-subtitle-1 pa-3 bg-grey-lighten-3 font-weight-medium">Contact Info</div>
      <div class="pa-4">
        <v-row>
          <v-col cols="12" md="3">
            <v-text-field
              :model-value="modelValue.parentFirstName"
              label="Parent First Name"
              :readonly="readOnly"
              density="compact"
              @update:model-value="(v) => $emit('update:modelValue', { ...modelValue, parentFirstName: v })"
              @blur="() => commitClientName('parentFirstName')"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              :model-value="modelValue.parentLastName"
              label="Parent Last Name"
              :readonly="readOnly"
              density="compact"
              @update:model-value="(v) => $emit('update:modelValue', { ...modelValue, parentLastName: v })"
              @blur="() => commitClientName('parentLastName')"
            />
          </v-col>
          <v-col cols="12" md="3">
            <PhoneInput
              :model-value="modelValue.parentPhone"
              @update:model-value="$emit('update:modelValue', { ...modelValue, parentPhone: $event })"
              label="Parent Phone"
              :readonly="readOnly"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="modelValue.emergencyContactName"
              label="Emergency Contact Name *"
              :readonly="readOnly"
              :rules="readOnly ? [] : requiredText"
              density="compact"
              @update:model-value="(v) => $emit('update:modelValue', { ...modelValue, emergencyContactName: v })"
            />
          </v-col>
          <v-col cols="12" md="6">
            <PhoneInput
              :model-value="modelValue.emergencyContactPhone"
              label="Emergency Contact Phone *"
              :readonly="readOnly"
              required
              @update:model-value="$emit('update:modelValue', { ...modelValue, emergencyContactPhone: $event })"
            />
          </v-col>
        </v-row>
      </div>
    </v-sheet>

    <!-- Demographic -->
    <v-sheet class="rounded-lg mb-4 pa-0 overflow-hidden" border>
      <div class="text-subtitle-1 pa-3 bg-grey-lighten-3 font-weight-medium">Demographic</div>
      <div class="pa-4">
        <v-row>
          <v-col cols="12" md="4">
            <v-select v-model="modelValue.genderId" :items="genders" item-title="value" item-value="id"
              label="Gender" clearable :readonly="readOnly" density="compact" />
          </v-col>
          <v-col cols="12" md="4">
            <v-select v-model="modelValue.raceId" :items="races" item-title="value" item-value="id"
              label="Race" clearable :readonly="readOnly" density="compact" />
          </v-col>
          <v-col cols="12" md="4">
            <v-select v-model="modelValue.ethnicityId" :items="ethnicities" item-title="value" item-value="id"
              label="Ethnicity" clearable :readonly="readOnly" density="compact" />
          </v-col>
        </v-row>
      </div>
    </v-sheet>

    <!-- Referral -->
    <v-sheet class="rounded-lg mb-4 pa-0 overflow-hidden" border>
      <div class="text-subtitle-1 pa-3 bg-grey-lighten-3 font-weight-medium">Referral</div>
      <div class="pa-4">
        <v-row>
          <v-col cols="12" md="4">
            <v-select v-model="modelValue.referralTypeId" :items="referralTypes" item-title="value" item-value="id"
              label="Referral Type" clearable :readonly="readOnly" density="compact" />
          </v-col>
          <v-col v-if="showReferringOrganization" cols="12" md="4">
            <v-select
              v-model="modelValue.organizationId"
              :items="organizations"
              item-title="name"
              item-value="id"
              label="Referring Organization *"
              :rules="readOnly || !showReferringOrganization ? [] : requiredSelect"
              clearable
              :readonly="readOnly"
              density="compact"
            />
          </v-col>
        </v-row>
        <v-row v-if="showReferralContact">
          <v-col cols="12" md="4">
            <v-text-field v-model="modelValue.referralCaseWorker" label="Case Worker" :readonly="readOnly" density="compact" />
          </v-col>
          <v-col cols="12" md="4">
            <PhoneInput
              :model-value="modelValue.referralPhone"
              @update:model-value="$emit('update:modelValue', { ...modelValue, referralPhone: $event })"
              label="Phone"
              :readonly="readOnly"
            />
          </v-col>
        </v-row>
      </div>
    </v-sheet>

    <!-- Situation -->
    <v-sheet class="rounded-lg mb-4 pa-0 overflow-hidden" border>
      <div class="text-subtitle-1 pa-3 bg-grey-lighten-3 font-weight-medium">Situation</div>
      <div class="pa-4">
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="modelValue.initialSituationId"
              :items="initialSituations"
              item-title="value"
              item-value="id"
              label="Initial Situation"
              clearable
              :disabled="initialSituationDisabled"
              :readonly="readOnly"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="modelValue.currentSituationId"
              :items="initialSituations"
              item-title="value"
              item-value="id"
              label="Current Status"
              clearable
              :disabled="currentStatusDisabled"
              :readonly="readOnly"
              density="compact"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="modelValue.drugsOfChoice"
              :items="drugOfChoice"
              item-title="value"
              item-value="id"
              label="Drugs of Choice"
              multiple
              chips
              clearable
              :readonly="readOnly"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select v-model="modelValue.benefits" :items="benefits" item-title="value" item-value="id"
              label="Benefits" multiple chips clearable :readonly="readOnly" density="compact" />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6" class="d-flex align-center">
            <v-checkbox
              v-model="modelValue.currentlyTakingDrugs"
              label="Currently taking drugs"
              hide-details
              density="compact"
              :disabled="readOnly"
            />
          </v-col>
        </v-row>
      </div>
    </v-sheet>

    <!-- Organization Info -->
    <v-sheet class="rounded-lg mb-4 pa-0 overflow-hidden" border>
      <div class="text-subtitle-1 pa-3 bg-grey-lighten-3 font-weight-medium">Organization Info</div>
      <div class="pa-4">
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="modelValue.intakeLocationId"
              :items="intakeLocationsWithLabel"
              item-title="displayName"
              item-value="id"
              label="Intake Location *"
              :rules="readOnly ? [] : requiredSelect"
              clearable
              :readonly="readOnly"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select v-model="modelValue.status" :items="['Active','Lost Contact','Deceased']" label="Status" :readonly="readOnly" density="compact" />
          </v-col>
        </v-row>
      </div>
    </v-sheet>
  </v-form>
</template>
