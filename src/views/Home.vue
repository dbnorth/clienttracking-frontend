<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import Utils from "../config/utils.js";
import LocationServices from "../services/locationServices.js";
import OrganizationServices from "../services/organizationServices.js";
import ClientServices from "../services/clientServices.js";
import EncounterServices from "../services/encounterServices.js";
import { getClientFullDisplayName } from "../utils/clientNameUtils.js";
import { formatPhoneForDisplay } from "../utils/phoneUtils.js";

const router = useRouter();
const user = ref(Utils.getStore("user"));
const nowDisplay = ref("");
const orgLogoUrl = ref(null);

const refreshUser = () => {
  user.value = Utils.getStore("user");
  loadOrgLogo();
};

const formatNow = () => {
  const d = new Date();
  const datePart = Utils.formatDate(d.toISOString().slice(0, 10));
  const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  return `${datePart} ${timePart}`;
};

const greeting = computed(() => {
  const firstName = user.value?.fName?.trim();
  return firstName ? `Hello ${firstName}, thanks for helping others today!` : "Hello, thanks for helping others today!";
});

const hasNoAccess = computed(() => user.value?.role === "none");

const locationDisplay = computed(() => user.value?.currentLocationName || "");

const loadLocationName = async () => {
  const locId = user.value?.currentLocationId;
  if (locId && !user.value?.currentLocationName) {
    try {
      const res = await LocationServices.get(locId);
      const loc = res.data;
      const name = loc?.organization ? `${loc.organization.name} – ${loc.name}` : loc?.name;
      if (name) {
        Utils.setStore("user", { ...user.value, currentLocationName: name });
        user.value = Utils.getStore("user");
      }
    } catch {}
  }
};

const loadOrgLogo = () => {
  const orgId = Utils.effectiveOrganizationId(user.value);
  if (orgId) {
    OrganizationServices.get(orgId)
      .then((r) => {
        const url = r.data?.logoUrl;
        orgLogoUrl.value = url ? OrganizationServices.getLogoUrl(url) : null;
      })
      .catch(() => {});
  } else {
    OrganizationServices.getAll()
      .then((r) => {
        const orgs = r.data || [];
        const first = orgs[0];
        const url = first?.logoUrl;
        orgLogoUrl.value = url ? OrganizationServices.getLogoUrl(url) : null;
      })
      .catch(() => {});
  }
};

const actions = [
  { name: "addClient", label: "Add Client", icon: "mdi-account-plus", subtitle: "Register a new client" },
  { name: "addEncounter", label: "Add Encounter", icon: "mdi-hand-heart", subtitle: "Record services requested or provided" },
];

const goTo = (routeName) => {
  if (routeName === "addEncounter" && homeClient.value?.id != null) {
    router.push({ name: "addEncounter", query: { clientId: String(homeClient.value.id) } });
    return;
  }
  router.push({ name: routeName });
};

/** Home client lookup — same pattern as Encounters list “Filter by client”. */
const homeClient = ref(null);
const homeClientSearchResults = ref([]);
const homeClientLoading = ref(false);
const homeClientSearchInput = ref("");
const homeClientSearchTimeout = ref(null);

const getClientLabel = (c) => {
  if (!c) return "";
  const name = getClientFullDisplayName(c);
  const phone = c.phone ? ` • ${formatPhoneForDisplay(c.phone)}` : "";
  return `${name}${phone}`;
};

/** Keep selection visible when the search list is cleared. */
const homeClientsWithLabel = computed(() => {
  const base = homeClientSearchResults.value.map((c) => ({ ...c, displayLabel: getClientLabel(c) }));
  const sel = homeClient.value;
  if (!sel?.id) return base;
  const sid = Number(sel.id);
  if (base.some((x) => Number(x.id) === sid)) return base;
  return [{ ...sel, displayLabel: getClientLabel(sel) }, ...base];
});

const searchHomeClients = (q) => {
  if (homeClientSearchTimeout.value) clearTimeout(homeClientSearchTimeout.value);
  homeClientSearchTimeout.value = setTimeout(async () => {
    const query = (typeof q === "string" ? q : homeClientSearchInput.value)?.trim();
    if (!query) {
      homeClientSearchResults.value = [];
      return;
    }
    homeClientLoading.value = true;
    try {
      const u = Utils.getStore("user");
      const params = { ...Utils.getClientListQueryParams(u), name: query, phone: query };
      const res = await ClientServices.getAll(params);
      homeClientSearchResults.value = res.data || [];
    } catch {
      homeClientSearchResults.value = [];
    } finally {
      homeClientLoading.value = false;
    }
  }, 300);
};

const onHomeClientSearchInput = (v) => {
  homeClientSearchInput.value = v;
  searchHomeClients(v);
};

const selectedClientPhotoUrl = computed(() => {
  const c = homeClient.value;
  if (!c?.photoUrl) return null;
  return ClientServices.getPhotoUrl(c.photoUrl);
});

const selectedClientDisplayName = computed(() => getClientFullDisplayName(homeClient.value));

const selectedClientBirthDisplay = computed(() => Utils.formatDate(homeClient.value?.birthdate));

const lastEncounterLoading = ref(false);
const lastEncounterDisplay = ref("");
let lastEncounterFetchSeq = 0;

watch(
  () => homeClient.value?.id,
  async (id) => {
    lastEncounterDisplay.value = "";
    if (id == null || id === "") {
      lastEncounterLoading.value = false;
      return;
    }
    const seq = ++lastEncounterFetchSeq;
    lastEncounterLoading.value = true;
    try {
      const params = {
        clientId: Number(id),
        ...Utils.getClientListQueryParams(Utils.getStore("user")),
      };
      const res = await EncounterServices.getAll(params);
      if (seq !== lastEncounterFetchSeq) return;
      const rows = Array.isArray(res.data) ? res.data : [];
      const latest = rows[0];
      if (latest?.date) {
        const iso = String(latest.date).slice(0, 10);
        lastEncounterDisplay.value = Utils.formatDate(iso);
      } else {
        lastEncounterDisplay.value = "No encounter";
      }
    } catch {
      if (seq !== lastEncounterFetchSeq) return;
      lastEncounterDisplay.value = "—";
    } finally {
      if (seq === lastEncounterFetchSeq) lastEncounterLoading.value = false;
    }
  },
  { immediate: true }
);

const openSelectedClientProfile = () => {
  const id = homeClient.value?.id;
  if (id != null) router.push({ name: "viewClient", params: { id: String(id) } });
};

let nowInterval;
onMounted(() => {
  nowDisplay.value = formatNow();
  nowInterval = setInterval(() => { nowDisplay.value = formatNow(); }, 1000);
  window.addEventListener("user-updated", refreshUser);
  loadLocationName();
  loadOrgLogo();
});
onUnmounted(() => {
  if (nowInterval) clearInterval(nowInterval);
  if (homeClientSearchTimeout.value) clearTimeout(homeClientSearchTimeout.value);
  window.removeEventListener("user-updated", refreshUser);
});
</script>

<template>
  <div class="home-page">
    <v-container class="fill-height">
      <v-row justify="center" align="center">
        <v-col cols="12" class="text-center mb-3">
          <h1 class="text-h3 font-weight-bold mb-2">{{ greeting }}</h1>
          <div v-if="orgLogoUrl" class="d-flex justify-center mb-2">
            <img
              :src="orgLogoUrl"
              alt="Organization logo"
              style="max-height: 160px; max-width: 400px; object-fit: contain"
            />
          </div>
          <p v-if="locationDisplay" class="text-h5 text-medium-emphasis mb-1">You are serving at {{ locationDisplay }} today.</p>
        </v-col>
        <v-col cols="12" md="10" lg="8">
          <div class="text-h5 text-center mt-0 mb-2">{{ nowDisplay }}</div>
          <v-alert v-if="hasNoAccess" type="warning" variant="tonal" class="mb-4 text-center">
            Admin must give you access to use this application.
          </v-alert>
          <div v-else class="mb-8 mx-auto" style="max-width: 560px">
            <v-autocomplete
              v-model="homeClient"
              :items="homeClientsWithLabel"
              :loading="homeClientLoading"
              item-title="displayLabel"
              item-value="id"
              return-object
              label="Find client"
              placeholder="Search by name or phone…"
              clearable
              hide-no-data
              density="compact"
              hide-details
              variant="outlined"
              prepend-inner-icon="mdi-magnify"
              no-filter
              @update:search="onHomeClientSearchInput"
            >
              <template #selection>
                <span v-if="homeClient">{{ getClientLabel(homeClient) }}</span>
              </template>
            </v-autocomplete>

            <v-card
              v-if="homeClient"
              class="mt-4 pa-4 text-left"
              variant="tonal"
              rounded="lg"
            >
              <div class="d-flex flex-column flex-sm-row align-center home-client-detail">
                <div class="flex-shrink-0 home-client-detail__photo">
                  <v-avatar size="120" rounded="lg">
                    <v-img v-if="selectedClientPhotoUrl" :src="selectedClientPhotoUrl" cover alt="Client photo" />
                    <v-icon v-else size="64" color="medium-emphasis">mdi-account</v-icon>
                  </v-avatar>
                </div>
                <div class="flex-grow-1 text-center text-sm-start">
                  <div class="text-h6 font-weight-bold">{{ selectedClientDisplayName }}</div>
                  <div class="text-body-1 text-medium-emphasis mt-1">
                    Date of birth: {{ selectedClientBirthDisplay }}
                  </div>
                  <div class="text-body-1 text-medium-emphasis mt-1">
                    Last encounter:
                    <template v-if="lastEncounterLoading">…</template>
                    <template v-else>{{ lastEncounterDisplay }}</template>
                  </div>
                  <div v-if="homeClient.phone" class="text-body-2 mt-1">
                    {{ formatPhoneForDisplay(homeClient.phone) }}
                  </div>
                  <v-btn
                    class="mt-3"
                    color="primary"
                    variant="text"
                    prepend-icon="mdi-account-details"
                    @click="openSelectedClientProfile"
                  >
                    Open full profile
                  </v-btn>
                </div>
              </div>
            </v-card>
          </div>
          <v-row v-if="!hasNoAccess" justify="center">
            <v-col v-for="action in actions" :key="action.name" cols="12" sm="6" md="4" >
              <v-card
                color="primary"
                class="home-action-card pa-8 rounded-xl"
                elevation="4"
                hover
                @click="goTo(action.name)"
              >
                <v-card-text class="text-center pa-0 text-white">
                  <v-icon size="100" class="mb-4 d-block mx-auto" color="white">{{ action.icon }}</v-icon>
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

/* Extra space between client photo and details (stacked and side-by-side). */
.home-client-detail {
  gap: 1.75rem;
}
@media (min-width: 600px) {
  .home-client-detail {
    gap: 2.5rem;
  }
  .home-client-detail__photo {
    margin-inline-end: 0.5rem;
  }
}
</style>
