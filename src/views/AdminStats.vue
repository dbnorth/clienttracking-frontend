<script setup>
import { ref, computed, onMounted } from "vue";
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

const fromDate = ref(defaultDateRange().fromDate);
const toDate = ref(defaultDateRange().toDate);
const selectedServiceIds = ref([]);
const serviceTypes = ref([]);
const loading = ref(false);
const message = ref("");

const raw = ref({ labels: [], datasets: [] });

const chartData = computed(() => {
  const labels = (raw.value.labels || []).map((d) => Utils.formatDate(d));
  const datasets = (raw.value.datasets || []).map((ds) => ({
    label: ds.label,
    data: [...(ds.data || [])],
    backgroundColor: ds.backgroundColor,
  }));
  return { labels, datasets };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "top" },
    title: {
      display: true,
      text: "Client service activity by date fields (grouped counts per day)",
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
};

const loadServiceFilterOptions = async () => {
  try {
    const res = await LookupServices.getByType("service_provided", lookupQueryOpts(effectiveOrgIdForLookups()));
    serviceTypes.value = res.data || [];
  } catch {
    serviceTypes.value = [];
  }
};

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
    if (selectedServiceIds.value?.length) {
      params.serviceProvidedIds = selectedServiceIds.value.join(",");
    }
    const res = await StatsServices.getServiceStatusTimeseries(params);
    raw.value = {
      labels: res.data?.labels || [],
      datasets: res.data?.datasets || [],
    };
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

onMounted(async () => {
  await loadServiceFilterOptions();
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
        Counts per day when <strong>requested</strong>, <strong>provided</strong>, or <strong>cancelled</strong> dates
        are set (not the current status). One row can appear in more than one series if multiple dates fall in the
        range. Scoped to your organization; superadmin uses <strong>Act as organization</strong> when set.
      </p>

      <v-card class="mb-4">
        <v-card-text>
          <v-row align="center">
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model="fromDate" type="date" label="From date" density="compact" hide-details />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model="toDate" type="date" label="To date" density="compact" hide-details />
            </v-col>
            <v-col cols="12" md="4">
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
            <Bar v-if="raw.labels?.length" :data="chartData" :options="chartOptions" />
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
