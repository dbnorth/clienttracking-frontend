<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import Utils from "../config/utils.js";

const router = useRouter();
const user = Utils.getStore("user");
const nowDisplay = ref("");

const formatNow = () => {
  const d = new Date();
  const datePart = Utils.formatDate(d.toISOString().slice(0, 10));
  const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  return `${datePart} ${timePart}`;
};

const greeting = computed(() => {
  const firstName = user?.fName?.trim();
  return firstName ? `Hello ${firstName}, thanks for helping others today!` : "Hello, thanks for helping others today!";
});

const hasNoAccess = computed(() => user?.role === "none");

const actions = [
  { name: "addClient", label: "Add Client", icon: "mdi-account-plus", color: "success", subtitle: "Register a new client" },
  { name: "addEncounter", label: "Add Encounter", icon: "mdi-hand-heart", color: "secondary", subtitle: "Record services requested or provided" },
];

const goTo = (routeName) => router.push({ name: routeName });

let nowInterval;
onMounted(() => {
  nowDisplay.value = formatNow();
  nowInterval = setInterval(() => { nowDisplay.value = formatNow(); }, 1000);
});
onUnmounted(() => {
  if (nowInterval) clearInterval(nowInterval);
});
</script>

<template>
  <div class="home-page">
    <v-container class="fill-height">
      <v-row justify="center" align="center">
        <v-col cols="12" class="text-center mb-8">
          <h1 class="text-h3 font-weight-bold mb-2">{{ greeting }}</h1>
          <p v-if="!hasNoAccess" class="text-h6 text-medium-emphasis">What would you like to do?</p>
        </v-col>
        <v-col cols="12" md="10" lg="8">
          <div class="text-h5 text-center mt-2 mb-4">{{ nowDisplay }}</div>
          <v-alert v-if="hasNoAccess" type="warning" variant="tonal" class="mb-4 text-center">
            Admin must give you access to use this application.
          </v-alert>
          <v-row v-else justify="center">
            <v-col v-for="action in actions" :key="action.name" cols="12" sm="6" md="4" >
              <v-card
                :color="action.color"
                class="home-action-card pa-8 rounded-xl"
                elevation="4"
                hover
                @click="goTo(action.name)"
              >
                <v-card-text class="text-center pa-0">
                  <v-icon size="100" class="mb-4 d-block mx-auto">{{ action.icon }}</v-icon>
                  <div class="text-h4 font-weight-bold mb-2">{{ action.label }}</div>
                  <div class="text-body-1 opacity-90">{{ action.subtitle }}</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
          <p v-if="hasNoAccess" class="text-body-2 text-medium-emphasis text-center mt-3">
            Contact your administrator to request access.
          </p>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.home-action-card {
  height: 300px;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.home-action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2) !important;
}
</style>
