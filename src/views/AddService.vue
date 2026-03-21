<script setup>
import { ref, onMounted } from "vue";
import ServiceRecordServices from "../services/servicerecordServices";
import LookupServices from "../services/lookupServices";
import { useRouter } from "vue-router";

const router = useRouter();
const props = defineProps({ id: { required: true } });
const message = ref("Enter service details and click Save");
const serviceProvidedList = ref([]);
const record = ref({
  date: new Date().toISOString().split("T")[0],
  serviceProvidedId: null,
});

const save = () => {
  ServiceRecordServices.create(props.id, record.value)
    .then(() => router.push({ name: "viewClient", params: { id: props.id } }))
    .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
};

const cancel = () => router.push({ name: "viewClient", params: { id: props.id } });

onMounted(async () => {
  const res = await LookupServices.getByType("service_provided");
  serviceProvidedList.value = res.data;
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Add Service</v-toolbar-title>
      </v-toolbar>
      <br />
      <h4>{{ message }}</h4>
      <br />
      <v-form>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field v-model="record.date" type="date" label="Date" />
          </v-col>
          <v-col cols="12" md="4">
            <v-select v-model="record.serviceProvidedId" :items="serviceProvidedList" item-title="value" item-value="id"
              label="Service Provided" />
          </v-col>
        </v-row>
      </v-form>
      <v-btn color="success" class="mr-4" @click="save">Save</v-btn>
      <v-btn color="error" class="mr-4" @click="cancel">Cancel</v-btn>
    </v-container>
  </div>
</template>
