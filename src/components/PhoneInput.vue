<script setup>
import { computed } from "vue";
import { formatPhone, phoneRule } from "../utils/phoneUtils.js";

const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, default: "Phone" },
  readonly: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  density: { type: String, default: "compact" },
  hideDetails: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

const rules = computed(() => {
  const r = [phoneRule];
  if (props.required) {
    r.unshift((v) => !!v?.trim() || "Phone is required");
  }
  return r;
});

const displayValue = computed(() => formatPhone(props.modelValue || ""));

const onInput = (v) => emit("update:modelValue", formatPhone(v));
</script>

<template>
  <v-text-field
    :model-value="displayValue"
    @update:model-value="onInput"
    :label="label"
    :readonly="readonly"
    :density="density"
    :hide-details="hideDetails"
    :rules="readonly ? [] : rules"
    placeholder="(555) 555-5555"
  />
</template>
