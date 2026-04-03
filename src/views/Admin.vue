<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import Utils from "../config/utils.js";
import ReferringOrganizationServices from "../services/referringOrganizationServices";
import OrganizationServices from "../services/organizationServices";
import LookupServices from "../services/lookupServices";
import LocationServices from "../services/locationServices";
import UserServices from "../services/userServices";
import PhoneInput from "../components/PhoneInput.vue";
import { phoneRule, formatPhoneForDisplay } from "../utils/phoneUtils.js";

const tab = ref("organizations");
const message = ref("");
const successMessage = ref("");

const referringOrgs = ref([]);
const organizations = ref([]);
const locations = ref([]);
const lookups = ref([]);

/** List value types for the List Values tab, sorted by label for the dropdown. */
const LOOKUP_TYPES = [
  { value: "referring_organization_type", label: "Referring Organization Types" },
  { value: "housing_location", label: "Housing Locations" },
  { value: "daytime_location", label: "Daytime locations" },
  { value: "race", label: "Races" },
  { value: "ethnicity", label: "Ethnicities" },
  { value: "gender", label: "Genders" },
  { value: "initial_situation", label: "Initial Situations" },
  { value: "referral_type", label: "Referral Types" },
  { value: "drug_of_choice", label: "Drug of Choice" },
  { value: "housing_type", label: "Housing Types" },
  { value: "benefit", label: "Benefits" },
  { value: "service_provided", label: "Services Provided" },
  { value: "encounter_type", label: "Encounter Types" },
].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

const defaultLookupType = LOOKUP_TYPES[0]?.value ?? "benefit";
const selectedLookupType = ref(defaultLookupType);
/** List Values tab: org filter (superadmin can change; others follow user org). */
const selectedListValuesOrgId = ref(null);
const users = ref([]);

const showRefOrgDialog = ref(false);
const refOrgNameFieldRef = ref(null);
const showOrgDialog = ref(false);
const orgNameFieldRef = ref(null);
const showLocationDialog = ref(false);
const locationOrgFieldRef = ref(null);
const locationNameFieldRef = ref(null);
const showLookupDialog = ref(false);
const lookupValueFieldRef = ref(null);
const showUserDialog = ref(false);
const userFirstNameFieldRef = ref(null);
const refOrgForm = ref({ id: null, name: "", caseWorkerName: "", phone: "", referringOrganizationTypeId: null });
const orgForm = ref({ id: null, name: "", contactName: "", phoneNumber: "", street: "", city: "", state: "", zip: "", logoUrl: null, primaryColor: "#80162B" });
const locationForm = ref({ id: null, organizationId: null, name: "", address: "", city: "", state: "", zip: "", contactName: "", phoneNumber: "" });
const lookupForm = ref({
  id: null,
  type: defaultLookupType,
  value: "",
  sortOrder: 0,
  status: "Active",
  organizationId: null,
});
const userForm = ref({ id: null, fName: "", lName: "", email: "", username: "", password: "", organizationId: null, role: "worker" });
const userFormRef = ref(null);
const requiredText = [(v) => !!v?.trim() || "Required"];
const requiredSelect = [(v) => (v != null && v !== "") || "Required"];
const passwordRule = (isAdd) => [
  ...(isAdd ? [(v) => !!v?.trim() || "Required"] : []),
  (v) => !v || v.length >= 8 || "Min 8 characters",
];
const currentUser = ref(Utils.getStore("user"));
const refreshCurrentUser = () => {
  currentUser.value = Utils.getStore("user");
  const u = currentUser.value;
  if (u?.role !== "superadmin") {
    selectedListValuesOrgId.value = userOrganizationId.value ?? null;
    return;
  }
  if (u?.actingOrganizationId != null && u.actingOrganizationId !== "") {
    selectedListValuesOrgId.value = u.actingOrganizationId;
  }
};
const isSuperAdmin = computed(() => currentUser.value?.role === "superadmin");
const userOrganizationId = computed(
  () => currentUser.value?.organizationId ?? currentUser.value?.organization?.id ?? null
);
/** Superadmin: all orgs; others: only the signed-in admin's org (single option). Used for locations and users. */
const organizationsForTenantSelect = computed(() => {
  const all = organizations.value || [];
  if (isSuperAdmin.value) return all;
  const oid = userOrganizationId.value;
  if (oid == null) return [];
  const match = all.find((o) => o.id === oid);
  if (match) return [match];
  const name = currentUser.value?.organization?.name || "Organization";
  return [{ id: oid, name }];
});
const locationOrganizationHint = computed(() =>
  isSuperAdmin.value ? "Choose which organization this location belongs to." : "This location is for your organization."
);
const userOrganizationHint = computed(() =>
  isSuperAdmin.value ? "Choose which organization this user belongs to." : "Users are managed in your organization."
);
const lookupOrganizationHint = computed(() =>
  isSuperAdmin.value ? "Choose which organization owns this list value." : "List values are for your organization."
);
const listValuesOrgFilterHint = computed(() =>
  isSuperAdmin.value ? "Show list values for the selected organization." : "List values for your organization."
);
/** Target org for starter set: superadmin “act as” first, then List Values org, then home org. */
const starterSetTargetOrganizationId = computed(() => {
  const u = currentUser.value;
  if (!u) return null;
  if (u.role === "superadmin") {
    if (u.actingOrganizationId != null && u.actingOrganizationId !== "") return u.actingOrganizationId;
    if (selectedListValuesOrgId.value != null) return selectedListValuesOrgId.value;
    return userOrganizationId.value ?? null;
  }
  return userOrganizationId.value ?? null;
});
const roleOptions = computed(() => {
  const base = [
    { title: "Admin", value: "admin" },
    { title: "Worker", value: "worker" },
    { title: "None", value: "none" },
  ];
  if (isSuperAdmin.value) {
    return [{ title: "Superadmin", value: "superadmin" }, ...base];
  }
  return base;
});

const loadReferringOrgs = () => {
  ReferringOrganizationServices.getAll()
    .then((r) => (referringOrgs.value = r.data))
    .catch((e) => (message.value = e.response?.data?.message || "Error loading"));
};

const loadOrganizations = () => {
  return OrganizationServices.getAll()
    .then((r) => (organizations.value = r.data))
    .catch((e) => {
      message.value = e.response?.data?.message || "Error loading";
    });
};

const loadLocations = () => {
  LocationServices.getAll()
    .then((r) => (locations.value = r.data))
    .catch((e) => (message.value = e.response?.data?.message || "Error loading"));
};

const loadLookups = () => {
  LookupServices.getAll()
    .then((r) => (lookups.value = r.data))
    .catch((e) => (message.value = e.response?.data?.message || "Error loading"));
};

const loadUsers = () => {
  UserServices.getAll()
    .then((r) => (users.value = r.data || []))
    .catch((e) => (message.value = e.response?.data?.message || "Error loading users"));
};

const openAddUser = () => {
  userForm.value = {
    id: null,
    fName: "",
    lName: "",
    email: "",
    username: "",
    password: "",
    organizationId: isSuperAdmin.value ? null : userOrganizationId.value,
    role: "worker",
  };
  showUserDialog.value = true;
};

const openEditUser = (u) => {
  const orgId = u.organizationId ?? u.organization?.id ?? null;
  userForm.value = {
    id: u.id,
    fName: u.fName || "",
    lName: u.lName || "",
    email: u.email || "",
    username: u.username || "",
    password: "",
    organizationId: isSuperAdmin.value ? orgId : userOrganizationId.value ?? orgId,
    role: u.role || "worker",
  };
  showUserDialog.value = true;
};

const saveUser = async () => {
  const { valid } = (await userFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  const data = {
    fName: userForm.value.fName.trim(),
    lName: userForm.value.lName.trim(),
    email: (userForm.value.email || "").trim() || null,
    username: userForm.value.username.trim(),
    organizationId: userForm.value.organizationId || null,
    role: userForm.value.role || "worker",
  };
  if (!isSuperAdmin.value && userOrganizationId.value != null) {
    data.organizationId = userOrganizationId.value;
  }
  if (userForm.value.password) data.password = userForm.value.password;
  if (userForm.value.id) {
    UserServices.update(userForm.value.id, data)
      .then(() => {
        loadUsers();
        showUserDialog.value = false;
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error saving user"));
  } else {
    UserServices.create(data)
      .then(() => {
        loadUsers();
        showUserDialog.value = false;
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error creating user"));
  }
};

const filteredLookups = () => {
  let list = lookups.value.filter((l) => l.type === selectedLookupType.value);
  if (isSuperAdmin.value && selectedListValuesOrgId.value != null) {
    list = list.filter((l) => Number(l.organizationId) === Number(selectedListValuesOrgId.value));
  }
  return list;
};

watch(selectedLookupType, () => {
  lookupForm.value.type = selectedLookupType.value;
});

const referringOrgTypes = () => lookups.value.filter((l) => l.type === "referring_organization_type");

const openAddRefOrg = () => {
  refOrgForm.value = { id: null, name: "", caseWorkerName: "", phone: "", referringOrganizationTypeId: null };
  showRefOrgDialog.value = true;
};

const openEditRefOrg = (org) => {
  refOrgForm.value = {
    id: org.id,
    name: org.name,
    caseWorkerName: org.caseWorkerName || "",
    phone: org.phone || "",
    referringOrganizationTypeId: org.referringOrganizationTypeId ?? org.referringOrganizationType?.id ?? null,
  };
  showRefOrgDialog.value = true;
};

const saveRefOrg = () => {
  if (!refOrgForm.value.name?.trim()) {
    message.value = "Name is required.";
    return;
  }
  const phoneErr = phoneRule(refOrgForm.value.phone);
  if (phoneErr !== true) {
    message.value = phoneErr;
    return;
  }
  const data = {
    name: refOrgForm.value.name.trim(),
    caseWorkerName: refOrgForm.value.caseWorkerName?.trim() || null,
    phone: refOrgForm.value.phone?.trim() || null,
    referringOrganizationTypeId: refOrgForm.value.referringOrganizationTypeId || null,
  };
  if (refOrgForm.value.id) {
    ReferringOrganizationServices.update(refOrgForm.value.id, data)
      .then(() => {
        loadReferringOrgs();
        showRefOrgDialog.value = false;
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
  } else {
    ReferringOrganizationServices.create(data)
      .then(() => {
        loadReferringOrgs();
        showRefOrgDialog.value = false;
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
  }
};

const deleteRefOrg = (org) => {
  if (!confirm(`Delete referring organization "${org.name}"?`)) return;
  ReferringOrganizationServices.delete(org.id)
    .then(() => loadReferringOrgs())
    .catch((e) => (message.value = e.response?.data?.message || "Error deleting"));
};

const orgLogoUploading = ref(false);
const orgLogoError = ref("");
const orgLogoFile = ref(null);

const DEFAULT_PRIMARY_COLOR = "#80162B";

const openAddOrg = () => {
  orgForm.value = { id: null, name: "", contactName: "", phoneNumber: "", street: "", city: "", state: "", zip: "", logoUrl: null, primaryColor: DEFAULT_PRIMARY_COLOR };
  orgLogoError.value = "";
  showOrgDialog.value = true;
};

const openEditOrg = (org) => {
  orgForm.value = { ...org, logoUrl: org.logoUrl || null, primaryColor: org.primaryColor || DEFAULT_PRIMARY_COLOR };
  orgLogoError.value = "";
  showOrgDialog.value = true;
};

const onOrgLogoSelected = (fileOrFiles) => {
  const file = Array.isArray(fileOrFiles) ? fileOrFiles[0] : fileOrFiles;
  if (!file || !orgForm.value.id) return;
  if (!file.type?.startsWith("image/")) {
    orgLogoError.value = "Please select an image file (PNG, JPEG, or GIF).";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    orgLogoError.value = "Image must be 2MB or smaller.";
    return;
  }
  orgLogoError.value = "";
  orgLogoUploading.value = true;
  OrganizationServices.uploadLogo(orgForm.value.id, file)
    .then((res) => {
      orgForm.value.logoUrl = res.data?.logoUrl ?? res.data;
      loadOrganizations();
    })
    .catch((e) => {
      orgLogoError.value = e.response?.data?.message || "Upload failed.";
    })
    .finally(() => {
      orgLogoUploading.value = false;
      orgLogoFile.value = null;
    });
};

const removeOrgLogo = () => {
  if (!orgForm.value.id || !orgForm.value.logoUrl) return;
  orgLogoError.value = "";
  orgLogoUploading.value = true;
  OrganizationServices.removeLogo(orgForm.value.id)
    .then(() => {
      orgForm.value.logoUrl = null;
      loadOrganizations();
    })
    .catch((e) => {
      orgLogoError.value = e.response?.data?.message || "Failed to remove logo.";
    })
    .finally(() => {
      orgLogoUploading.value = false;
    });
};

const saveOrg = () => {
  if (!orgForm.value.name?.trim()) {
    message.value = "Name is required.";
    return;
  }
  const phoneErr = phoneRule(orgForm.value.phoneNumber);
  if (phoneErr !== true) {
    message.value = phoneErr;
    return;
  }
  const data = {
    name: orgForm.value.name.trim(),
    contactName: orgForm.value.contactName?.trim() || null,
    phoneNumber: orgForm.value.phoneNumber?.trim() || null,
    street: orgForm.value.street?.trim() || null,
    city: orgForm.value.city?.trim() || null,
    state: orgForm.value.state?.trim() || null,
    zip: orgForm.value.zip?.trim() || null,
    primaryColor: orgForm.value.primaryColor?.trim() || null,
  };
  if (orgForm.value.id) {
    OrganizationServices.update(orgForm.value.id, data)
      .then(() => {
        loadOrganizations();
        showOrgDialog.value = false;
        window.dispatchEvent(new CustomEvent("org-updated"));
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
  } else {
    OrganizationServices.create(data)
      .then(() => {
        loadOrganizations();
        showOrgDialog.value = false;
        window.dispatchEvent(new CustomEvent("org-updated"));
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
  }
};

const deleteOrg = (org) => {
  if (!confirm(`Delete organization "${org.name}"?`)) return;
  OrganizationServices.delete(org.id)
    .then(() => loadOrganizations())
    .catch((e) => (message.value = e.response?.data?.message || "Error deleting"));
};

const openAddLocation = () => {
  locationForm.value = {
    id: null,
    organizationId: isSuperAdmin.value ? null : userOrganizationId.value,
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    contactName: "",
    phoneNumber: "",
  };
  showLocationDialog.value = true;
};

const openEditLocation = (loc) => {
  locationForm.value = {
    id: loc.id,
    organizationId: loc.organizationId,
    name: loc.name || "",
    address: loc.address || "",
    city: loc.city || "",
    state: loc.state || "",
    zip: loc.zip || "",
    contactName: loc.contactName || "",
    phoneNumber: loc.phoneNumber || "",
  };
  showLocationDialog.value = true;
};

const saveLocation = () => {
  if (!locationForm.value.name?.trim()) {
    message.value = "Name is required.";
    return;
  }
  if (!locationForm.value.organizationId) {
    message.value = "Organization is required.";
    return;
  }
  const phoneErr = phoneRule(locationForm.value.phoneNumber);
  if (phoneErr !== true) {
    message.value = phoneErr;
    return;
  }
  const data = {
    organizationId: locationForm.value.organizationId,
    name: locationForm.value.name.trim(),
    address: locationForm.value.address?.trim() || null,
    city: locationForm.value.city?.trim() || null,
    state: locationForm.value.state?.trim() || null,
    zip: locationForm.value.zip?.trim() || null,
    contactName: locationForm.value.contactName?.trim() || null,
    phoneNumber: locationForm.value.phoneNumber?.trim() || null,
  };
  if (!isSuperAdmin.value && userOrganizationId.value != null) {
    data.organizationId = userOrganizationId.value;
  }
  if (locationForm.value.id) {
    LocationServices.update(locationForm.value.id, data)
      .then(() => {
        loadLocations();
        showLocationDialog.value = false;
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
  } else {
    LocationServices.create(data)
      .then(() => {
        loadLocations();
        showLocationDialog.value = false;
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
  }
};

const deleteLocation = (loc) => {
  if (!confirm(`Delete location "${loc.name}"?`)) return;
  LocationServices.delete(loc.id)
    .then(() => loadLocations())
    .catch((e) => (message.value = e.response?.data?.message || "Error deleting"));
};

const nextSortOrder = () => {
  const items = filteredLookups();
  if (!items.length) return 0;
  return Math.max(...items.map((l) => l.sortOrder ?? 0)) + 1;
};

const focusLookupValueField = async () => {
  await nextTick();
  const field = lookupValueFieldRef.value;
  if (field && typeof field.focus === "function") {
    field.focus();
  } else {
    field?.$el?.querySelector?.("input")?.focus?.();
  }
};

const focusRefOrgFirstField = async () => {
  await nextTick();
  const field = refOrgNameFieldRef.value;
  if (field && typeof field.focus === "function") {
    field.focus();
  } else {
    field?.$el?.querySelector?.("input")?.focus?.();
  }
};

const focusOrgFirstField = async () => {
  await nextTick();
  await nextTick();
  const field = orgNameFieldRef.value;
  if (field && typeof field.focus === "function") {
    field.focus();
  } else {
    field?.$el?.querySelector?.("input")?.focus?.();
  }
};

const focusUserFirstField = async () => {
  await nextTick();
  const field = userFirstNameFieldRef.value;
  if (field && typeof field.focus === "function") {
    field.focus();
  } else {
    field?.$el?.querySelector?.("input")?.focus?.();
  }
};

const focusLocationFirstField = async () => {
  await nextTick();
  await nextTick();
  const targetRef = isSuperAdmin.value ? locationOrgFieldRef : locationNameFieldRef;
  const field = targetRef.value;
  if (field && typeof field.focus === "function") {
    field.focus();
  } else {
    field?.$el?.querySelector?.("input")?.focus?.();
  }
};

const openAddLookup = () => {
  lookupForm.value = {
    id: null,
    type: selectedLookupType.value,
    value: "",
    sortOrder: nextSortOrder(),
    status: "Active",
    organizationId: isSuperAdmin.value
      ? selectedListValuesOrgId.value ?? userOrganizationId.value
      : userOrganizationId.value,
  };
  showLookupDialog.value = true;
};

const openEditLookup = (item) => {
  lookupForm.value = {
    ...item,
    organizationId: isSuperAdmin.value
      ? item.organizationId ?? item.organization?.id ?? null
      : userOrganizationId.value ?? item.organizationId ?? item.organization?.id ?? null,
  };
  showLookupDialog.value = true;
};

const saveLookup = () => {
  if (!lookupForm.value.value?.trim()) {
    message.value = "Value is required.";
    return;
  }
  if (isSuperAdmin.value && (lookupForm.value.organizationId == null || lookupForm.value.organizationId === "")) {
    message.value = "Organization is required.";
    return;
  }
  const data = {
    type: lookupForm.value.type,
    value: lookupForm.value.value.trim(),
    sortOrder: parseInt(lookupForm.value.sortOrder, 10) || 0,
    status: lookupForm.value.status || "Active",
    organizationId: lookupForm.value.organizationId,
  };
  if (!isSuperAdmin.value && userOrganizationId.value != null) {
    data.organizationId = userOrganizationId.value;
  }
  if (lookupForm.value.id) {
    LookupServices.update(lookupForm.value.id, data)
      .then(() => {
        loadLookups();
        showLookupDialog.value = false;
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
  } else {
    LookupServices.create(data)
      .then(() => {
        loadLookups();
        showLookupDialog.value = false;
      })
      .catch((e) => (message.value = e.response?.data?.message || "Error saving"));
  }
};

const deleteLookup = (item) => {
  if (!confirm(`Delete "${item.value}"?`)) return;
  LookupServices.delete(item.id)
    .then(() => loadLookups())
    .catch((e) => (message.value = e.response?.data?.message || "Error deleting"));
};

const loadStarterLookupsLoading = ref(false);
const loadStarterLookups = () => {
  const oid = starterSetTargetOrganizationId.value;
  if (oid == null) {
    message.value = "Select an organization in the List Values tab (or use Act as organization as superadmin).";
    return;
  }
  const orgName =
    organizations.value?.find((o) => Number(o.id) === Number(oid))?.name || `organization #${oid}`;
  if (
    !confirm(
      `Load default list values (race, ethnicity, referral types, genders, encounter types, housing types, housing locations including Address, benefits, drugs of choice, referring org types, initial situations) and a sample referring organization for "${orgName}"? Existing entries with the same name are skipped.`
    )
  ) {
    return;
  }
  message.value = "";
  successMessage.value = "";
  loadStarterLookupsLoading.value = true;
  LookupServices.seedStarterSet(isSuperAdmin.value ? oid : undefined)
    .then((r) => {
      const d = r.data || {};
      loadLookups();
      loadReferringOrgs();
      successMessage.value =
        d.message ||
        `Added ${d.lookupsCreated ?? 0} list values; skipped ${d.lookupsSkipped ?? 0} duplicates. Referring orgs: ${d.referringOrganizationsCreated ?? 0} added, ${d.referringOrganizationsSkipped ?? 0} skipped.`;
      setTimeout(() => {
        successMessage.value = "";
      }, 6000);
    })
    .catch((e) => (message.value = e.response?.data?.message || "Error loading starter set"))
    .finally(() => {
      loadStarterLookupsLoading.value = false;
    });
};

const sortAlphaAndRenumber = ref(false);
const sortAndRenumberLookups = async () => {
  const items = filteredLookups();
  if (!items.length) {
    message.value = "No items to sort.";
    return;
  }
  const sorted = [...items].sort((a, b) =>
    String(a.value || "").localeCompare(String(b.value || ""), undefined, { sensitivity: "base" })
  );
  sortAlphaAndRenumber.value = true;
  message.value = "";
  try {
    await Promise.all(
      sorted.map((item, index) =>
        LookupServices.update(item.id, {
          type: item.type,
          value: item.value,
          sortOrder: index + 1,
          status: item.status || "Active",
        })
      )
    );
    await loadLookups();
    successMessage.value = "Items sorted alphabetically and renumbered.";
    setTimeout(() => { successMessage.value = ""; }, 3000);
  } catch (e) {
    message.value = e.response?.data?.message || "Error saving sort order.";
  } finally {
    sortAlphaAndRenumber.value = false;
  }
};

onMounted(() => {
  refreshCurrentUser();
  window.addEventListener("user-updated", refreshCurrentUser);
  loadReferringOrgs();
  loadOrganizations().then(() => {
    if (selectedListValuesOrgId.value != null) return;
    if (isSuperAdmin.value) {
      selectedListValuesOrgId.value =
        userOrganizationId.value ?? organizations.value?.[0]?.id ?? null;
    }
  });
  loadLocations();
  loadLookups();
  loadUsers();
});

onUnmounted(() => {
  window.removeEventListener("user-updated", refreshCurrentUser);
});
</script>

<template>
  <v-container>
    <v-toolbar>
      <v-toolbar-title>Admin</v-toolbar-title>
    </v-toolbar>

    <v-alert v-if="message" type="error" density="compact" class="mt-3 mb-3" @click="message = ''">{{ message }}</v-alert>
    <v-alert v-if="successMessage" type="success" density="compact" class="mt-3 mb-3" @click="successMessage = ''">{{ successMessage }}</v-alert>

    <v-tabs v-model="tab" class="mt-4">
      <v-tab value="organizations">Organizations</v-tab>
      <v-tab value="locations">Locations</v-tab>
      <v-tab value="users">Users</v-tab>
      <v-tab value="referringOrgs">Referring Organizations</v-tab>
      <v-tab value="lookups">List Values</v-tab>
    </v-tabs>

    <v-window v-model="tab" class="mt-4">
      <v-window-item value="organizations">
        <v-card>
          <v-card-title class="d-flex align-center">
            Organizations
            <v-spacer />
            <v-btn v-if="isSuperAdmin" color="primary" size="small" @click="openAddOrg">Add Organization</v-btn>
          </v-card-title>
          <v-card-text>
            <v-table>
              <thead>
                <tr>
                  <th class="text-left">Name</th>
                  <th class="text-left">Contact Name</th>
                  <th class="text-left">Phone Number</th>
                  <th class="text-left">Address</th>
                  <th class="text-left" width="120">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="org in organizations" :key="org.id">
                  <td>{{ org.name }}</td>
                  <td>{{ org.contactName || "–" }}</td>
                  <td>{{ formatPhoneForDisplay(org.phoneNumber) || "–" }}</td>
                  <td>{{ [org.street, org.city, org.state, org.zip].filter(Boolean).join(", ") || "–" }}</td>
                  <td>
                    <v-icon small class="mr-2" @click="openEditOrg(org)">mdi-pencil</v-icon>
                    <v-icon v-if="isSuperAdmin" small @click="deleteOrg(org)">mdi-trash-can</v-icon>
                  </td>
                </tr>
                <tr v-if="!organizations.length">
                  <td colspan="5" class="text-center text-medium-emphasis">
                    <template v-if="isSuperAdmin">No organizations yet. Add one.</template>
                    <template v-else>No organizations yet. Only a superadmin can add or delete organizations.</template>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-window-item>

      <v-window-item value="locations">
        <v-card>
          <v-card-title class="d-flex align-center">
            Locations
            <v-spacer />
            <v-btn
              color="primary"
              size="small"
              :disabled="!isSuperAdmin && !userOrganizationId"
              @click="openAddLocation"
              >Add Location</v-btn
            >
          </v-card-title>
          <v-card-text>
            <v-table>
              <thead>
                <tr>
                  <th class="text-left">Organization</th>
                  <th class="text-left">Name</th>
                  <th class="text-left">Address</th>
                  <th class="text-left">City</th>
                  <th class="text-left">State</th>
                  <th class="text-left">Zip</th>
                  <th class="text-left">Contact Name</th>
                  <th class="text-left">Phone Number</th>
                  <th class="text-left" width="120">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="loc in locations" :key="loc.id">
                  <td>{{ loc.organization?.name || "–" }}</td>
                  <td>{{ loc.name }}</td>
                  <td>{{ loc.address || "–" }}</td>
                  <td>{{ loc.city || "–" }}</td>
                  <td>{{ loc.state || "–" }}</td>
                  <td>{{ loc.zip || "–" }}</td>
                  <td>{{ loc.contactName || "–" }}</td>
                  <td>{{ formatPhoneForDisplay(loc.phoneNumber) || "–" }}</td>
                  <td>
                    <v-icon small class="mr-2" @click="openEditLocation(loc)">mdi-pencil</v-icon>
                    <v-icon small @click="deleteLocation(loc)">mdi-trash-can</v-icon>
                  </td>
                </tr>
                <tr v-if="!locations.length">
                  <td colspan="9" class="text-center text-medium-emphasis">No locations yet. Add one.</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-window-item>

      <v-window-item value="users">
        <v-card>
          <v-card-title class="d-flex align-center">
            Users
            <v-spacer />
            <v-btn
              color="primary"
              size="small"
              :disabled="!isSuperAdmin && !userOrganizationId"
              @click="openAddUser"
              >Add User</v-btn
            >
          </v-card-title>
          <v-card-text>
            <v-table>
              <thead>
                <tr>
                  <th class="text-left">Name</th>
                  <th class="text-left">Username</th>
                  <th class="text-left">Email</th>
                  <th class="text-left">Role</th>
                  <th class="text-left">Organization</th>
                  <th class="text-left" width="100">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in users" :key="u.id">
                  <td>{{ [u.fName, u.lName].filter(Boolean).join(' ') || '–' }}</td>
                  <td>{{ u.username || '–' }}</td>
                  <td>{{ u.email || '–' }}</td>
                  <td>{{ u.role || 'worker' }}</td>
                  <td>{{ u.organization?.name || '–' }}</td>
                  <td>
                    <v-icon
                      v-if="u.role !== 'superadmin' || isSuperAdmin"
                      small
                      class="mr-2"
                      @click="openEditUser(u)"
                      >mdi-pencil</v-icon
                    >
                    <span v-else class="text-caption text-medium-emphasis">—</span>
                  </td>
                </tr>
                <tr v-if="!users.length">
                  <td colspan="6" class="text-center text-medium-emphasis">No users yet. Add one.</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-window-item>

      <v-window-item value="referringOrgs">
        <v-card>
          <v-card-title class="d-flex align-center">
            Referring Organizations
            <v-spacer />
            <v-btn color="primary" size="small" @click="openAddRefOrg">Add Referring Organization</v-btn>
          </v-card-title>
          <v-card-text>
            <v-table>
              <thead>
                <tr>
                  <th class="text-left">Name</th>
                  <th class="text-left">Organization</th>
                  <th class="text-left">Type</th>
                  <th class="text-left">Case Worker</th>
                  <th class="text-left">Phone</th>
                  <th class="text-left" width="120">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="org in referringOrgs" :key="org.id">
                  <td>{{ org.name }}</td>
                  <td>{{ org.organization?.name || "–" }}</td>
                  <td>{{ org.referringOrganizationType?.value || "–" }}</td>
                  <td>{{ org.caseWorkerName || "–" }}</td>
                  <td>{{ formatPhoneForDisplay(org.phone) || "–" }}</td>
                  <td>
                    <v-icon small class="mr-2" @click="openEditRefOrg(org)">mdi-pencil</v-icon>
                    <v-icon small @click="deleteRefOrg(org)">mdi-trash-can</v-icon>
                  </td>
                </tr>
                <tr v-if="!referringOrgs.length">
                  <td colspan="6" class="text-center text-medium-emphasis">No referring organizations yet. Add one.</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-window-item>

      <v-window-item value="lookups">
        <v-card>
          <v-card-text class="pt-4">
            <div class="d-flex flex-wrap align-end ga-3 mb-4">
              <v-select
                v-model="selectedListValuesOrgId"
                :items="organizationsForTenantSelect"
                item-title="name"
                item-value="id"
                label="Organization"
                density="compact"
                :disabled="!isSuperAdmin"
                :hint="listValuesOrgFilterHint"
                persistent-hint
                class="flex-grow-1"
                style="max-width: 400px; min-width: 220px"
              />
            </div>
            <div class="d-flex flex-wrap align-center ga-2 mb-2">
              <v-select
                v-model="selectedLookupType"
                :items="LOOKUP_TYPES"
                item-title="label"
                item-value="value"
                density="compact"
                hide-details
                style="max-width: 260px; min-width: 200px"
              />
              <v-spacer class="d-none d-sm-block" />
              <v-btn
                color="primary"
                variant="flat"
                size="default"
                :loading="loadStarterLookupsLoading"
                :disabled="loadStarterLookupsLoading || starterSetTargetOrganizationId == null"
                @click="loadStarterLookups"
              >
                <v-icon start>mdi-database-import</v-icon>
                Load starter set
              </v-btn>
              <v-btn
                color="primary"
                size="default"
                :loading="sortAlphaAndRenumber"
                :disabled="!filteredLookups().length || sortAlphaAndRenumber"
                @click="sortAndRenumberLookups"
              >
                <v-icon start>mdi-sort-alphabetical-ascending</v-icon>
                Sort A–Z &amp; Renumber
              </v-btn>
              <v-btn
                color="primary"
                size="default"
                :disabled="!isSuperAdmin && !userOrganizationId"
                @click="openAddLookup"
                >Add</v-btn
              >
            </div>
          </v-card-text>
          <v-card-text>
            <v-table>
              <thead>
                <tr>
                  <th class="text-left">Value</th>
                  <th class="text-left" width="80">Order</th>
                  <th class="text-left" width="100">Status</th>
                  <th class="text-left" width="120">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredLookups()" :key="item.id" :class="{ 'text-medium-emphasis': item.status === 'Inactive' }">
                  <td>{{ item.value }}</td>
                  <td>{{ item.sortOrder }}</td>
                  <td>
                    <v-chip :color="item.status === 'Active' ? 'success' : 'default'" size="small">{{ item.status || "Active" }}</v-chip>
                  </td>
                  <td>
                    <v-icon small class="mr-2" @click="openEditLookup(item)">mdi-pencil</v-icon>
                    <v-icon small @click="deleteLookup(item)">mdi-trash-can</v-icon>
                  </td>
                </tr>
                <tr v-if="!filteredLookups().length">
                  <td colspan="4" class="text-center text-medium-emphasis">No entries. Add one.</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-window-item>
    </v-window>

    <v-dialog v-model="showRefOrgDialog" max-width="480" persistent @after-enter="focusRefOrgFirstField">
      <v-card>
        <v-card-title>{{ refOrgForm.id ? "Edit" : "Add" }} Referring Organization</v-card-title>
        <v-card-text>
          <v-text-field ref="refOrgNameFieldRef" v-model="refOrgForm.name" label="Name" density="compact" />
          <v-select
            v-model="refOrgForm.referringOrganizationTypeId"
            :items="referringOrgTypes()"
            item-title="value"
            item-value="id"
            label="Referring Organization Type"
            clearable
          />
          <v-text-field v-model="refOrgForm.caseWorkerName" label="Case Worker Name" />
          <PhoneInput v-model="refOrgForm.phone" label="Phone" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRefOrgDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveRefOrg">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showOrgDialog" max-width="520" persistent @after-enter="focusOrgFirstField">
      <v-card>
        <v-card-title>{{ orgForm.id ? "Edit" : "Add" }} Organization</v-card-title>
        <v-card-text>
          <template v-if="orgForm.id">
            <div class="mb-4">
              <div class="text-caption mb-2">Logo</div>
              <div v-if="orgForm.logoUrl" class="d-flex align-center ga-3">
                <img
                  :src="OrganizationServices.getLogoUrl(orgForm.logoUrl)"
                  alt="Organization logo"
                  style="max-height: 80px; max-width: 120px; object-fit: contain"
                />
                <v-btn variant="text" color="error" size="small" :disabled="orgLogoUploading" @click="removeOrgLogo">Remove</v-btn>
              </div>
              <v-file-input
                v-else
                v-model="orgLogoFile"
                label="Upload logo"
                prepend-icon=""
                prepend-inner-icon="mdi-camera"
                accept="image/png, image/jpeg, image/jpg, image/gif"
                density="compact"
                hide-details
                :loading="orgLogoUploading"
                :disabled="orgLogoUploading"
                @update:model-value="onOrgLogoSelected"
              />
              <v-file-input
                v-if="orgForm.logoUrl"
                v-model="orgLogoFile"
                label="Replace logo"
                prepend-icon=""
                prepend-inner-icon="mdi-camera"
                accept="image/png, image/jpeg, image/jpg, image/gif"
                density="compact"
                hide-details
                class="mt-2"
                :loading="orgLogoUploading"
                :disabled="orgLogoUploading"
                @update:model-value="onOrgLogoSelected"
              />
              <v-alert v-if="orgLogoError" type="error" density="compact" class="mt-2">{{ orgLogoError }}</v-alert>
            </div>
          </template>
          <div class="mb-3">
            <div class="text-caption mb-1">Primary Color</div>
            <div class="d-flex align-center ga-2">
              <input
                v-model="orgForm.primaryColor"
                type="color"
                class="rounded"
                style="width: 48px; height: 38px; border: 1px solid rgba(0,0,0,0.2); cursor: pointer"
              />
              <v-text-field
                v-model="orgForm.primaryColor"
                label="Hex color"
                density="compact"
                hide-details
                placeholder="#80162B"
                style="max-width: 120px"
              />
            </div>
          </div>
          <v-text-field ref="orgNameFieldRef" v-model="orgForm.name" label="Organization Name" density="compact" />
          <v-text-field v-model="orgForm.contactName" label="Contact Name" />
          <PhoneInput v-model="orgForm.phoneNumber" label="Phone Number" />
          <v-text-field v-model="orgForm.street" label="Street" />
          <v-text-field v-model="orgForm.city" label="City" />
          <v-text-field v-model="orgForm.state" label="State" />
          <v-text-field v-model="orgForm.zip" label="Zip" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showOrgDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveOrg">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showLocationDialog" max-width="520" persistent @after-enter="focusLocationFirstField">
      <v-card>
        <v-card-title>{{ locationForm.id ? "Edit" : "Add" }} Location</v-card-title>
        <v-card-text>
          <v-select
            ref="locationOrgFieldRef"
            v-model="locationForm.organizationId"
            :items="organizationsForTenantSelect"
            item-title="name"
            item-value="id"
            label="Organization"
            :disabled="!isSuperAdmin"
            density="compact"
            :hint="locationOrganizationHint"
            persistent-hint
          />
          <v-text-field ref="locationNameFieldRef" v-model="locationForm.name" label="Name" density="compact" />
          <v-text-field v-model="locationForm.address" label="Address" />
          <v-row dense>
            <v-col cols="12" sm="5">
              <v-text-field v-model="locationForm.city" label="City" />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field v-model="locationForm.state" label="State" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="locationForm.zip" label="Zip" />
            </v-col>
          </v-row>
          <v-text-field v-model="locationForm.contactName" label="Contact Name" />
          <PhoneInput v-model="locationForm.phoneNumber" label="Phone Number" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showLocationDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveLocation">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showUserDialog" max-width="480" persistent @after-enter="focusUserFirstField">
      <v-card>
        <v-card-title>{{ userForm.id ? "Edit User" : "Add User" }}</v-card-title>
        <v-card-text>
          <v-form ref="userFormRef" validate-on="submit lazy">
            <div class="text-caption text-medium-emphasis mb-3">* required field</div>
            <v-text-field
              ref="userFirstNameFieldRef"
              v-model="userForm.fName"
              label="First Name *"
              :rules="requiredText"
              density="compact"
            />
            <v-text-field
              v-model="userForm.lName"
              label="Last Name *"
              :rules="requiredText"
              density="compact"
            />
            <v-text-field v-model="userForm.email" label="Email" type="email" density="compact" />
            <v-text-field
              v-model="userForm.username"
              label="Username *"
              :rules="requiredText"
              density="compact"
            />
            <v-text-field
              v-model="userForm.password"
              :label="userForm.id ? 'New Password (leave blank to keep current)' : 'Password *'"
              type="password"
              :rules="passwordRule(!userForm.id)"
              :hint="userForm.id ? 'Min 8 characters' : 'Min 8 characters required'"
              persistent-hint
              density="compact"
            />
            <v-select
              v-model="userForm.role"
              :items="roleOptions"
              item-title="title"
              item-value="value"
              label="Role *"
              :rules="requiredSelect"
              density="compact"
            />
            <v-select
              v-model="userForm.organizationId"
              :items="organizationsForTenantSelect"
              item-title="name"
              item-value="id"
              clearable
              :label="isSuperAdmin && userForm.id ? 'Organization' : 'Organization *'"
              :rules="isSuperAdmin && userForm.id ? [] : requiredSelect"
              density="compact"
              :disabled="!isSuperAdmin"
              :hint="userOrganizationHint"
              persistent-hint
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showUserDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveUser">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showLookupDialog" max-width="420" persistent @after-enter="focusLookupValueField">
      <v-card>
        <v-card-title>{{ lookupForm.id ? "Edit" : "Add" }} {{ LOOKUP_TYPES.find((t) => t.value === lookupForm.type)?.label || lookupForm.type }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="lookupForm.organizationId"
            :items="organizationsForTenantSelect"
            item-title="name"
            item-value="id"
            label="Organization *"
            :rules="requiredSelect"
            density="compact"
            :disabled="!isSuperAdmin"
            :hint="lookupOrganizationHint"
            persistent-hint
          />
          <v-text-field ref="lookupValueFieldRef" v-model="lookupForm.value" label="Value" density="compact" />
          <v-text-field v-model.number="lookupForm.sortOrder" label="Sort Order" type="number" />
          <v-select v-model="lookupForm.status" :items="['Active','Inactive']" label="Status" hint="Inactive options are hidden from dropdowns" persistent-hint />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showLookupDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveLookup">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
