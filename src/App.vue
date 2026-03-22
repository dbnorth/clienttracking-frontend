<script setup>
import { onMounted, onUnmounted } from "vue";
import { useTheme } from "vuetify";
import MenuBar from "./components/MenuBar.vue";
import Utils from "./config/utils.js";
import OrganizationServices from "./services/organizationServices.js";

const theme = useTheme();
const DEFAULT_PRIMARY = "#80162B";

const applyOrgPrimaryColor = (color) => {
  const primaryColor = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : DEFAULT_PRIMARY;
  if (theme.themes.value.myCustomLightTheme) {
    theme.themes.value.myCustomLightTheme.colors.primary = primaryColor;
  }
};

const fetchAndApplyOrgColor = () => {
  const user = Utils.getStore("user");
  const color = user?.organization?.primaryColor;
  const orgId = user?.organizationId ?? user?.organization?.id;
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
    applyOrgPrimaryColor(color);
  } else if (orgId) {
    OrganizationServices.get(orgId)
      .then((r) => {
        const c = r.data?.primaryColor;
        applyOrgPrimaryColor(c);
      })
      .catch(() => applyOrgPrimaryColor());
  } else {
    applyOrgPrimaryColor();
  }
};

const handleThemeUpdate = () => fetchAndApplyOrgColor();

onMounted(() => {
  fetchAndApplyOrgColor();
  window.addEventListener("user-updated", handleThemeUpdate);
  window.addEventListener("user-logged-in", handleThemeUpdate);
  window.addEventListener("org-updated", handleThemeUpdate);
});
onUnmounted(() => {
  window.removeEventListener("user-updated", handleThemeUpdate);
  window.removeEventListener("user-logged-in", handleThemeUpdate);
  window.removeEventListener("org-updated", handleThemeUpdate);
});
</script>

<template>
  <v-app>
    <MenuBar :key="$route.fullPath" />
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
