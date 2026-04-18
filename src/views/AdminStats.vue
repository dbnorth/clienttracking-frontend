<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { Bar } from "vue-chartjs";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";
import Utils from "../config/utils.js";
import StatsServices from "../services/statsServices.js";
import LookupServices from "../services/lookupServices.js";
import { lookupQueryOpts } from "../utils/lookupOrgUtils.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CHART_TYPES = [
  {
    value: "serviceActivity",
    title: "Service activity (requested / provided / cancelled)",
    description:
      "Counts per day when requested, provided, or cancelled dates are set on client services (not the current status). One row can appear in more than one series if multiple dates fall in the range. Optional filter: services provided.",
  },
  {
    value: "clientsAdded",
    title: "New clients by first-contact date",
    description:
      "Count of clients whose date of first contact falls on each day in the range. Optionally restrict by initial situation and/or referral type. Scoped to your organization; superadmin uses Act as organization when set.",
  },
  {
    value: "serviceCounts",
    title: "Service counts (aggregate entries)",
    description:
      "Totals from the Service counts screen: summed counts per day for your locations. Leave services empty to show one total across all services; pick one or more services to compare series.",
  },
];

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

function effectiveOrgIdForLookups() {
  const u = Utils.getStore("user");
  if (u?.role === "superadmin" && u.actingOrganizationId != null && u.actingOrganizationId !== "") {
    return Number(u.actingOrganizationId);
  }
  if (u?.organizationId != null && u.organizationId !== "") {
    return Number(u.organizationId);
  }
  return null;
}

const selectedChart = ref(CHART_TYPES[0].value);
const fromDate = ref(defaultDateRange().fromDate);
const toDate = ref(defaultDateRange().toDate);
const selectedServiceIds = ref([]);
const serviceCountsSelectedIds = ref([]);
const serviceTypes = ref([]);
const initialSituations = ref([]);
const referralTypes = ref([]);
const clientsFilterInitialSituationId = ref(null);
const clientsFilterReferralTypeId = ref(null);
const loading = ref(false);
const message = ref("");

const raw = ref({ labels: [], datasets: [] });

const activeChartMeta = computed(() => CHART_TYPES.find((c) => c.value === selectedChart.value) || CHART_TYPES[0]);

const chartData = computed(() => {
  const labels = (raw.value.labels || []).map((d) => Utils.formatDate(d));
  const datasets = (raw.value.datasets || []).map((ds) => ({
    label: ds.label,
    data: [...(ds.data || [])],
    backgroundColor: ds.backgroundColor,
  }));
  return { labels, datasets };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "top" },
    title: {
      display: true,
      text: activeChartMeta.value.title,
    },
    tooltip: {
      mode: "index",
      intersect: false,
    },
  },
  scales: {
    x: {
      ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 31 },
    },
    y: {
      beginAtZero: true,
      ticks: { precision: 0 },
    },
  },
  datasets: {
    bar: {
      categoryPercentage: 0.75,
      barPercentage: 0.85,
    },
  },
}));

const loadServiceFilterOptions = async () => {
  try {
    const res = await LookupServices.getByType("service_provided", lookupQueryOpts(effectiveOrgIdForLookups()));
    serviceTypes.value = res.data || [];
  } catch {
    serviceTypes.value = [];
  }
};

const loadClientChartFilterOptions = async () => {
  const opts = lookupQueryOpts(effectiveOrgIdForLookups());
  try {
    const [initR, refR] = await Promise.all([
      LookupServices.getByType("initial_situation", opts),
      LookupServices.getByType("referral_type", opts),
    ]);
    initialSituations.value = initR.data || [];
    referralTypes.value = refR.data || [];
  } catch {
    initialSituations.value = [];
    referralTypes.value = [];
  }
};

/** v-select may store a number or (in some cases) the full item object — API needs a positive int. */
const lookupIdForParams = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "object" && v !== null && "id" in v) {
    const n = Number(v.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Bumps after each successful fetch so Chart.js remounts (avoids stale merged datasets). */
const chartRenderKey = ref(0);

const loadChart = async () => {
  message.value = "";
  if (!fromDate.value || !toDate.value) {
    message.value = "Choose a from and to date.";
    return;
  }
  if (fromDate.value > toDate.value) {
    message.value = "From date must be on or before to date.";
    return;
  }
  loading.value = true;
  try {
    const params = { fromDate: fromDate.value, toDate: toDate.value };
    let res;
    if (selectedChart.value === "serviceActivity") {
      if (selectedServiceIds.value?.length) {
        params.serviceProvidedIds = selectedServiceIds.value.join(",");
      }
      res = await StatsServices.getServiceStatusTimeseries(params);
    } else if (selectedChart.value === "clientsAdded") {
      const initId = lookupIdForParams(clientsFilterInitialSituationId.value);
      const refId = lookupIdForParams(clientsFilterReferralTypeId.value);
      if (initId != null) params.initialSituationId = initId;
      if (refId != null) params.referralTypeId = refId;
      res = await StatsServices.getClientsAddedTimeseries(params);
    } else if (selectedChart.value === "serviceCounts") {
      if (serviceCountsSelectedIds.value?.length) {
        params.serviceProvidedIds = serviceCountsSelectedIds.value.join(",");
      }
      res = await StatsServices.getServiceCountsTimeseries(params);
    } else {
      raw.value = { labels: [], datasets: [] };
      return;
    }
    const payload = res.data || {};
    raw.value = {
      labels: [...(payload.labels || [])],
      datasets: (payload.datasets || []).map((ds) => ({
        label: ds.label,
        backgroundColor: ds.backgroundColor,
        data: [...(ds.data || [])],
      })),
    };
    chartRenderKey.value += 1;
    if (!raw.value.labels.length) {
      message.value = "No days in range or no data for this tenant.";
    }
  } catch (e) {
    raw.value = { labels: [], datasets: [] };
    message.value = e.response?.data?.message || "Could not load stats.";
  } finally {
    loading.value = false;
  }
};

watch(selectedChart, () => {
  loadChart();
});

onMounted(async () => {
  await Promise.all([loadServiceFilterOptions(), loadClientChartFilterOptions()]);
  await loadChart();
});
</script>

<template>
  <div>
    <v-container>
      <v-toolbar>
        <v-toolbar-title>Statistics</v-toolbar-title>
      </v-toolbar>
      <p class="text-body-2 text-medium-emphasis mt-2 mb-4">
        Scoped to your organization; superadmin uses <strong>Act as organization</strong> when set.
        {{ activeChartMeta.description }}
      </p>

      <v-card class="mb-4">
        <v-card-text>
          <v-row align="center" class="mb-2">
            <v-col cols="12" md="6">
              <v-select
                v-model="selectedChart"
                :items="CHART_TYPES"
                item-title="title"
                item-value="value"
                label="Chart"
                density="compact"
                hide-details
              />
            </v-col>
          </v-row>
          <v-row align="center">
            <v-col cols="12" sm="6" :md="selectedChart === 'clientsAdded' ? 2 : 3">
              <v-text-field v-model="fromDate" type="date" label="From date" density="compact" hide-details />
            </v-col>
            <v-col cols="12" sm="6" :md="selectedChart === 'clientsAdded' ? 2 : 3">
              <v-text-field v-model="toDate" type="date" label="To date" density="compact" hide-details />
            </v-col>
            <v-col v-if="selectedChart === 'serviceActivity'" cols="12" md="4">
              <v-select
                v-model="selectedServiceIds"
                :items="serviceTypes"
                item-title="value"
                item-value="id"
                label="Services (leave empty for all)"
                multiple
                chips
                closable-chips
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col v-if="selectedChart === 'serviceCounts'" cols="12" md="4">
              <v-select
                v-model="serviceCountsSelectedIds"
                :items="serviceTypes"
                item-title="value"
                item-value="id"
                label="Services (empty = total all services)"
                multiple
                chips
                closable-chips
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col v-if="selectedChart === 'clientsAdded'" cols="12" sm="6" md="3">
              <v-select
                v-model="clientsFilterInitialSituationId"
                :items="initialSituations"
                item-title="value"
                item-value="id"
                label="Initial situation (all)"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col v-if="selectedChart === 'clientsAdded'" cols="12" sm="6" md="3">
              <v-select
                v-model="clientsFilterReferralTypeId"
                :items="referralTypes"
                item-title="value"
                item-value="id"
                label="Referral type (all)"
                clearable
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" md="2" class="d-flex align-center">
              <v-btn color="primary" :loading="loading" @click="loadChart">Update chart</v-btn>
            </v-col>
          </v-row>
          <v-alert v-if="message" type="info" density="compact" variant="tonal" class="mt-3">{{ message }}</v-alert>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-text>
          <div style="height: 440px; position: relative">
            <Bar
              v-if="raw.labels?.length"
              :key="`${selectedChart}-${chartRenderKey}`"
              :data="chartData"
              :options="chartOptions"
            />
            <div
              v-else-if="!loading"
              class="d-flex align-center justify-center text-medium-emphasis"
              style="height: 100%"
            >
              No chart data for the selected range.
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>
