import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const page = document.body?.dataset?.page || "";
const urlParams = new URLSearchParams(window.location.search);

const groupTitleInput = document.getElementById("groupTitle");
const professoresInput = document.getElementById("professores");
const groupDriversInput = document.getElementById("groupDrivers");
const targetKidsInput = document.getElementById("targetKids");
const arrivalDateInput = document.getElementById("arrivalDate");
const departureDateInput = document.getElementById("departureDate");
const familyPicker = document.getElementById("family-picker");
const entryKindSelect = document.getElementById("entry-kind");
const addToListButton = document.getElementById("add-to-list");
const groupTableBody = document.getElementById("group-table-body");
const saveGroupButton = document.getElementById("save-group");
const newGroupButton = document.getElementById("new-group");
const feedback = document.getElementById("feedback");
const kidsTotal = document.getElementById("kids-total");
const kidsCompare = document.getElementById("kids-compare");
const groupSummary = document.getElementById("group-summary");

const familyForm = document.getElementById("family-form");
const familySubmitBtn = document.getElementById("family-submit-btn");
const familyCancelEditBtn = document.getElementById("family-cancel-edit");
const familyTableBody = document.getElementById("family-table-body");
const savedGroupsBody = document.getElementById("saved-groups-body");
const userEmail = document.getElementById("user-email");
const logoutButton = document.getElementById("logout-btn");

let session = null;
let draftKey = "group-draft-v1";
let families = [];
let groups = [];
let currentGroup = createEmptyGroup();
let editingFamilyId = null;
let schemaSupportsEntryType = true;
let schemaSupportsTeacherCounts = true;

await bootstrap();

async function bootstrap() {
  registerServiceWorker();

  if (!isSupabaseConfigured) {
    setFeedback("Supabase is not configured. Update your local config.js.", "error");
    return;
  }

  session = await requireSession();
  if (!session) {
    return;
  }

  draftKey = `group-draft-v1:${session.user.id}`;
  bindSessionUi();
  await loadRemoteData();

  if (page === "families") {
    setupFamiliesPage();
    renderFamilyTable();
  }

  if (page === "group-editor") {
    setupGroupEditorPage();
    renderGroupEditorPage();
  }

  if (page === "saved-groups") {
    renderSavedGroupsTable();
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    redirectToLogin();
    return null;
  }
  return data.session;
}

function bindSessionUi() {
  if (userEmail) {
    userEmail.textContent = session.user.email || "Logged in";
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await supabase.auth.signOut();
      redirectToLogin();
    });
  }
}

function redirectToLogin() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/login.html?returnTo=${encodeURIComponent(returnTo)}`;
}

async function fetchGroupEntries(groupIds) {
  if (groupIds.length === 0) {
    return [];
  }

  schemaSupportsEntryType = true;
  schemaSupportsTeacherCounts = true;

  let entriesRes = await supabase
    .from("group_entries")
    .select("id,group_id,family_id,boys,girls,entry_type,male_teachers,female_teachers")
    .in("group_id", groupIds);

  if (entriesRes.error && String(entriesRes.error.message || "").includes("entry_type")) {
    schemaSupportsEntryType = false;
    entriesRes = await supabase
      .from("group_entries")
      .select("id,group_id,family_id,boys,girls,male_teachers,female_teachers")
      .in("group_id", groupIds);
  }

  if (entriesRes.error && String(entriesRes.error.message || "").includes("male_teachers")) {
    schemaSupportsTeacherCounts = false;
    entriesRes = await supabase.from("group_entries").select("id,group_id,family_id,boys,girls").in("group_id", groupIds);
  }

  if (entriesRes.error) {
    throw new Error(entriesRes.error.message);
  }

  return entriesRes.data || [];
}

async function loadRemoteData() {
  const familiesRes = await supabase
    .from("families")
    .select("id,last_name,address,phone,has_dog,has_cat,created_at")
    .order("created_at", { ascending: false });

  if (familiesRes.error) {
    setFeedback(`Failed loading families: ${familiesRes.error.message}`, "error");
    return;
  }

  families = (familiesRes.data || []).map((row) => ({
    id: row.id,
    lastName: row.last_name,
    address: row.address,
    phone: row.phone,
    hasDog: row.has_dog,
    hasCat: row.has_cat,
  }));

  const groupsRes = await supabase
    .from("groups")
    .select("id,title,professores,drivers,target_kids,arrival_date,departure_date")
    .order("arrival_date", { ascending: false });

  if (groupsRes.error) {
    setFeedback(`Failed loading groups: ${groupsRes.error.message}`, "error");
    return;
  }

  const groupRows = groupsRes.data || [];
  const groupIds = groupRows.map((row) => row.id);
  const entriesByGroupId = new Map();

  try {
    const entries = await fetchGroupEntries(groupIds);
    for (const entry of entries) {
      const list = entriesByGroupId.get(entry.group_id) || [];
      list.push({
        id: entry.id,
        familyId: entry.family_id,
        boys: entry.boys || 0,
        girls: entry.girls || 0,
        entryType: entry.entry_type || "family",
        maleTeachers: entry.male_teachers || 0,
        femaleTeachers: entry.female_teachers || 0,
      });
      entriesByGroupId.set(entry.group_id, list);
    }
  } catch (error) {
    setFeedback(`Failed loading group entries: ${error.message}`, "error");
    return;
  }

  groups = groupRows.map((row) => ({
    id: row.id,
    title: row.title,
    professores: row.professores || 0,
    groupDrivers: row.drivers || 0,
    targetKids: row.target_kids || 0,
    arrivalDate: row.arrival_date,
    departureDate: row.departure_date,
    entries: entriesByGroupId.get(row.id) || [],
  }));
}

function setupFamiliesPage() {
  if (!familyForm) {
    return;
  }

  familyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const lastName = document.getElementById("lastName").value.trim();
    const address = document.getElementById("address").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const hasDog = document.getElementById("hasDog").value;
    const hasCat = document.getElementById("hasCat").value;

    if (!lastName || !address || !phone) {
      setFeedback("Last name, address and phone are required.", "error");
      return;
    }

    if (editingFamilyId) {
      const updateRes = await supabase
        .from("families")
        .update({ last_name: lastName, address, phone, has_dog: hasDog, has_cat: hasCat })
        .eq("id", editingFamilyId);

      if (updateRes.error) {
        setFeedback(`Failed editing family: ${updateRes.error.message}`, "error");
        return;
      }

      setFeedback("Family updated.", "success");
    } else {
      const insertRes = await supabase.from("families").insert({
        user_id: session.user.id,
        last_name: lastName,
        address,
        phone,
        has_dog: hasDog,
        has_cat: hasCat,
      });

      if (insertRes.error) {
        setFeedback(`Failed adding family: ${insertRes.error.message}`, "error");
        return;
      }

      setFeedback("Family added.", "success");
    }

    resetFamilyForm();
    await loadRemoteData();
    renderFamilyTable();
  });

  if (familyCancelEditBtn) {
    familyCancelEditBtn.addEventListener("click", () => {
      resetFamilyForm();
      setFeedback("Edit canceled.", "info");
    });
  }
}

function resetFamilyForm() {
  editingFamilyId = null;
  familyForm?.reset();
  if (familySubmitBtn) {
    familySubmitBtn.textContent = "Add family";
  }
  if (familyCancelEditBtn) {
    familyCancelEditBtn.style.display = "none";
  }
}

function setupGroupEditorPage() {
  currentGroup = loadDraftGroup() || createEmptyGroup();

  const groupId = urlParams.get("groupId");
  const duplicateId = urlParams.get("duplicateId");

  if (groupId) {
    const found = groups.find((group) => group.id === groupId);
    if (found) {
      currentGroup = structuredClone(found);
      saveDraftGroup();
    }
  }

  if (duplicateId) {
    const found = groups.find((group) => group.id === duplicateId);
    if (found) {
      currentGroup = structuredClone(found);
      currentGroup.id = null;
      currentGroup.title = `${found.title} (copy)`;
      currentGroup.entries = currentGroup.entries.map((entry) => ({ ...entry, id: crypto.randomUUID() }));
      saveDraftGroup();
      setFeedback("Group duplicated. Review dates, then save.", "info");
    }
  }

  if (addToListButton) {
    addToListButton.addEventListener("click", () => {
      syncCurrentGroupFromForm();

      if (!isDateRangeValid(currentGroup.arrivalDate, currentGroup.departureDate)) {
        setFeedback("Please set a valid arrival/departure date before importing families.", "error");
        return;
      }

      const familyId = familyPicker.value;
      const family = families.find((item) => item.id === familyId);
      if (!family) {
        return;
      }

      const entryType = entryKindSelect?.value === "staff" ? "staff" : "family";
      const duplicate = currentGroup.entries.some((entry) => entry.familyId === familyId);
      if (duplicate) {
        setFeedback("This family is already in this group.", "info");
        return;
      }

      const conflict = findFamilyConflictAcrossGroups(familyId, currentGroup);
      if (conflict) {
        setFeedback(
          `This family is already in overlapping dates: ${conflict.title} (${conflict.arrivalDate} to ${conflict.departureDate}).`,
          "error"
        );
        return;
      }

      currentGroup.entries.push({
        id: crypto.randomUUID(),
        familyId,
        boys: 0,
        girls: 0,
        entryType,
        maleTeachers: 0,
        femaleTeachers: 0,
      });

      saveDraftGroup();
      renderGroupTable();
      renderGroupSummary();
      setFeedback(`Family '${family.lastName}' imported.`, "success");
    });
  }

  if (saveGroupButton) {
    saveGroupButton.addEventListener("click", async () => {
      syncCurrentGroupFromForm();

      if (!currentGroup.title) {
        setFeedback("Group title is required.", "error");
        return;
      }

      if (!isDateRangeValid(currentGroup.arrivalDate, currentGroup.departureDate)) {
        setFeedback("Arrival date must be before or equal to departure date.", "error");
        return;
      }

      const conflict = findGroupWideConflict(currentGroup);
      if (conflict) {
        setFeedback(
          `Cannot save. Family '${conflict.familyName}' conflicts with group '${conflict.groupTitle}'.`,
          "error"
        );
        return;
      }

      const needsStaffType = currentGroup.entries.some((entry) => (entry.entryType || "family") === "staff");
      const needsTeacherCounts = currentGroup.entries.some((entry) => (entry.maleTeachers || 0) + (entry.femaleTeachers || 0) > 0);

      if (needsStaffType && !schemaSupportsEntryType) {
        setFeedback("Database migration required: add column group_entries.entry_type before saving staff rows.", "error");
        return;
      }

      if (needsTeacherCounts && !schemaSupportsTeacherCounts) {
        setFeedback("Database migration required: add columns group_entries.male_teachers and group_entries.female_teachers before saving teacher counts.", "error");
        return;
      }

      const payload = {
        user_id: session.user.id,
        title: currentGroup.title,
        professores: currentGroup.professores,
        drivers: currentGroup.groupDrivers,
        target_kids: currentGroup.targetKids,
        arrival_date: currentGroup.arrivalDate,
        departure_date: currentGroup.departureDate,
      };

      if (!currentGroup.id) {
        const insertRes = await supabase.from("groups").insert(payload).select("id").single();
        if (insertRes.error) {
          setFeedback(`Failed saving group: ${insertRes.error.message}`, "error");
          return;
        }

        currentGroup.id = insertRes.data.id;
      } else {
        const updateRes = await supabase.from("groups").update(payload).eq("id", currentGroup.id);
        if (updateRes.error) {
          setFeedback(`Failed updating group: ${updateRes.error.message}`, "error");
          return;
        }

        const deleteEntriesRes = await supabase.from("group_entries").delete().eq("group_id", currentGroup.id);
        if (deleteEntriesRes.error) {
          setFeedback(`Failed updating group entries: ${deleteEntriesRes.error.message}`, "error");
          return;
        }
      }

      const withAllFieldsRows = currentGroup.entries.map((entry) => ({
        group_id: currentGroup.id,
        family_id: entry.familyId,
        boys: entry.boys,
        girls: entry.girls,
        entry_type: entry.entryType || "family",
        male_teachers: entry.maleTeachers || 0,
        female_teachers: entry.femaleTeachers || 0,
        user_id: session.user.id,
      }));

      const withTypeRows = currentGroup.entries.map((entry) => ({
        group_id: currentGroup.id,
        family_id: entry.familyId,
        boys: entry.boys,
        girls: entry.girls,
        entry_type: entry.entryType || "family",
        user_id: session.user.id,
      }));

      const fallbackRows = currentGroup.entries.map((entry) => ({
        group_id: currentGroup.id,
        family_id: entry.familyId,
        boys: entry.boys,
        girls: entry.girls,
        user_id: session.user.id,
      }));

      if (withAllFieldsRows.length > 0) {
        let entriesRes = await supabase.from("group_entries").insert(withAllFieldsRows);

        if (entriesRes.error && String(entriesRes.error.message || "").includes("male_teachers")) {
          entriesRes = await supabase.from("group_entries").insert(withTypeRows);
        }

        if (entriesRes.error && String(entriesRes.error.message || "").includes("entry_type")) {
          entriesRes = await supabase.from("group_entries").insert(fallbackRows);
        }

        if (entriesRes.error) {
          setFeedback(`Failed saving group entries: ${entriesRes.error.message}`, "error");
          return;
        }
      }

      saveDraftGroup();
      await loadRemoteData();
      setFeedback("Group saved.", "success");
    });
  }

  if (newGroupButton) {
    newGroupButton.addEventListener("click", () => {
      currentGroup = createEmptyGroup();
      saveDraftGroup();
      setFormFromCurrentGroup();
      renderGroupTable();
      renderGroupSummary();
      setFeedback("Ready to create a new group.", "info");
    });
  }

  [groupTitleInput, professoresInput, groupDriversInput, targetKidsInput, arrivalDateInput, departureDateInput].forEach((input) => {
    if (!input) {
      return;
    }

    input.addEventListener("input", () => {
      syncCurrentGroupFromForm();
      saveDraftGroup();
      renderGroupSummary();
    });
  });
}

function renderGroupEditorPage() {
  setDefaultDates();
  setFormFromCurrentGroup();
  renderFamilyPicker();
  renderGroupTable();
  renderGroupSummary();
}

function renderFamilyTable() {
  if (!familyTableBody) {
    return;
  }

  familyTableBody.innerHTML = "";

  families.forEach((family) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(family.lastName)}</td>
      <td>${escapeHtml(family.address)}</td>
      <td>${escapeHtml(family.phone)}</td>
      <td>${escapeHtml(family.hasDog)}</td>
      <td>${escapeHtml(family.hasCat)}</td>
      <td>
        <div class="inline-actions">
          <button type="button" data-edit-family="${family.id}">Modify</button>
          <button type="button" class="danger" data-remove-family="${family.id}">Remove</button>
        </div>
      </td>
    `;
    familyTableBody.appendChild(row);
  });

  familyTableBody.querySelectorAll("[data-edit-family]").forEach((button) => {
    button.addEventListener("click", () => {
      const family = families.find((item) => item.id === button.dataset.editFamily);
      if (!family) {
        return;
      }

      editingFamilyId = family.id;
      document.getElementById("lastName").value = family.lastName;
      document.getElementById("address").value = family.address;
      document.getElementById("phone").value = family.phone;
      document.getElementById("hasDog").value = family.hasDog;
      document.getElementById("hasCat").value = family.hasCat;

      if (familySubmitBtn) {
        familySubmitBtn.textContent = "Save changes";
      }
      if (familyCancelEditBtn) {
        familyCancelEditBtn.style.display = "inline-block";
      }

      setFeedback(`Editing '${family.lastName}'.`, "info");
    });
  });

  familyTableBody.querySelectorAll("[data-remove-family]").forEach((button) => {
    button.addEventListener("click", async () => {
      const removeRes = await supabase.from("families").delete().eq("id", button.dataset.removeFamily);
      if (removeRes.error) {
        setFeedback(`Failed removing family: ${removeRes.error.message}`, "error");
        return;
      }

      await loadRemoteData();
      renderFamilyTable();
      setFeedback("Family removed.", "success");
    });
  });
}

function renderFamilyPicker() {
  if (!familyPicker) {
    return;
  }

  familyPicker.innerHTML = "";

  if (families.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No families saved";
    familyPicker.appendChild(option);
    return;
  }

  families.forEach((family) => {
    const option = document.createElement("option");
    option.value = family.id;
    option.textContent = `${family.lastName} - ${family.address}`;
    familyPicker.appendChild(option);
  });
}

function renderGroupTable() {
  if (!groupTableBody) {
    return;
  }

  groupTableBody.innerHTML = "";

  currentGroup.entries.forEach((entry) => {
    const family = families.find((item) => item.id === entry.familyId);
    if (!family) {
      return;
    }

    const isStaff = entry.entryType === "staff";
    if (isStaff) {
      entry.boys = 0;
      entry.girls = 0;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(family.lastName)}</td>
      <td>${escapeHtml(family.address)}</td>
      <td>${escapeHtml(family.phone)}</td>
      <td>${isStaff ? "Teacher/Driver" : "Family"}</td>
      <td>${escapeHtml(family.hasDog)}</td>
      <td>${escapeHtml(family.hasCat)}</td>
      <td><input type="number" class="small-input" min="0" value="${entry.boys}" data-boys="${entry.id}" ${isStaff ? "disabled" : ""} /></td>
      <td><input type="number" class="small-input" min="0" value="${entry.girls}" data-girls="${entry.id}" ${isStaff ? "disabled" : ""} /></td>
      <td><input type="number" class="small-input" min="0" value="${entry.maleTeachers || 0}" data-male-teachers="${entry.id}" /></td>
      <td><input type="number" class="small-input" min="0" value="${entry.femaleTeachers || 0}" data-female-teachers="${entry.id}" /></td>
      <td><button type="button" class="danger" data-remove-entry="${entry.id}">Remove</button></td>
    `;

    groupTableBody.appendChild(row);
  });

  groupTableBody.querySelectorAll("[data-remove-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      currentGroup.entries = currentGroup.entries.filter((entry) => entry.id !== button.dataset.removeEntry);
      saveDraftGroup();
      renderGroupTable();
      renderGroupSummary();
    });
  });

  groupTableBody.querySelectorAll("[data-boys]").forEach((input) => {
    input.addEventListener("input", () => {
      const entry = currentGroup.entries.find((item) => item.id === input.dataset.boys);
      if (!entry || entry.entryType === "staff") {
        return;
      }
      entry.boys = Math.max(0, Number(input.value) || 0);
      saveDraftGroup();
      renderGroupSummary();
    });
  });

  groupTableBody.querySelectorAll("[data-girls]").forEach((input) => {
    input.addEventListener("input", () => {
      const entry = currentGroup.entries.find((item) => item.id === input.dataset.girls);
      if (!entry || entry.entryType === "staff") {
        return;
      }
      entry.girls = Math.max(0, Number(input.value) || 0);
      saveDraftGroup();
      renderGroupSummary();
    });
  });

  groupTableBody.querySelectorAll("[data-male-teachers]").forEach((input) => {
    input.addEventListener("input", () => {
      const entry = currentGroup.entries.find((item) => item.id === input.dataset.maleTeachers);
      if (!entry) {
        return;
      }
      entry.maleTeachers = Math.max(0, Number(input.value) || 0);
      saveDraftGroup();
      renderGroupSummary();
    });
  });

  groupTableBody.querySelectorAll("[data-female-teachers]").forEach((input) => {
    input.addEventListener("input", () => {
      const entry = currentGroup.entries.find((item) => item.id === input.dataset.femaleTeachers);
      if (!entry) {
        return;
      }
      entry.femaleTeachers = Math.max(0, Number(input.value) || 0);
      saveDraftGroup();
      renderGroupSummary();
    });
  });
}

function renderSavedGroupsTable() {
  if (!savedGroupsBody) {
    return;
  }

  savedGroupsBody.innerHTML = "";

  groups.forEach((group) => {
    const totals = getTotals(group.entries);
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(group.title)}</td>
      <td>${escapeHtml(group.arrivalDate)}</td>
      <td>${escapeHtml(group.departureDate)}</td>
      <td>${group.professores}</td>
      <td>${group.groupDrivers}</td>
      <td>${group.targetKids}</td>
      <td>${totals.families}</td>
      <td>${totals.boys}</td>
      <td>${totals.girls}</td>
      <td>${totals.children}</td>
      <td>
        <div class="inline-actions">
          <button type="button" data-open-group="${group.id}">Open</button>
          <button type="button" data-duplicate-group="${group.id}">Duplicate</button>
          <button type="button" data-pdf-group="${group.id}">PDF</button>
          <button type="button" class="danger" data-delete-group="${group.id}">Delete</button>
        </div>
      </td>
    `;

    savedGroupsBody.appendChild(row);
  });

  savedGroupsBody.querySelectorAll("[data-open-group]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = `/group-editor.html?groupId=${encodeURIComponent(button.dataset.openGroup)}`;
    });
  });

  savedGroupsBody.querySelectorAll("[data-duplicate-group]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = `/group-editor.html?duplicateId=${encodeURIComponent(button.dataset.duplicateGroup)}`;
    });
  });

  savedGroupsBody.querySelectorAll("[data-pdf-group]").forEach((button) => {
    button.addEventListener("click", () => exportGroupPdf(button.dataset.pdfGroup));
  });

  savedGroupsBody.querySelectorAll("[data-delete-group]").forEach((button) => {
    button.addEventListener("click", async () => {
      const deleteRes = await supabase.from("groups").delete().eq("id", button.dataset.deleteGroup);
      if (deleteRes.error) {
        setFeedback(`Failed deleting group: ${deleteRes.error.message}`, "error");
        return;
      }

      await loadRemoteData();
      renderSavedGroupsTable();
      setFeedback("Group deleted.", "success");
    });
  });
}

function findFamilyConflictAcrossGroups(familyId, candidateGroup) {
  return groups.find((group) => {
    if (group.id === candidateGroup.id) {
      return false;
    }

    const hasFamily = group.entries.some((entry) => entry.familyId === familyId);
    if (!hasFamily) {
      return false;
    }

    return rangesOverlap(candidateGroup.arrivalDate, candidateGroup.departureDate, group.arrivalDate, group.departureDate);
  });
}

function findGroupWideConflict(candidateGroup) {
  for (const entry of candidateGroup.entries) {
    const conflictGroup = findFamilyConflictAcrossGroups(entry.familyId, candidateGroup);
    if (conflictGroup) {
      const family = families.find((item) => item.id === entry.familyId);
      return {
        groupTitle: conflictGroup.title,
        familyName: family ? family.lastName : "Unknown",
      };
    }
  }

  return null;
}

function renderGroupSummary() {
  if (!groupSummary) {
    return;
  }

  const totals = getTotals(currentGroup.entries);
  const targetKids = currentGroup.targetKids ?? 0;
  const diff = totals.children - targetKids;
  const sign = diff > 0 ? "+" : "";

  if (kidsTotal) {
    kidsTotal.textContent = `Total kids: ${totals.children}`;
  }

  if (kidsCompare) {
    kidsCompare.textContent = `Target kids: ${targetKids} | Difference: ${sign}${diff}`;
  }

  groupSummary.textContent = `Group summary: total kids ${totals.children}.`;
}

function exportGroupPdf(groupId) {
  const group = groups.find((item) => item.id === groupId);
  if (!group) {
    return;
  }

  const html = buildPrintableGroupHtml(group);
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    setFeedback("Unable to open print window. Please allow popups.", "error");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function buildPrintableGroupHtml(group) {
  const totals = getTotals(group.entries);

  const familyRows = group.entries
    .filter((entry) => !isTeacherOnlyEntry(entry))
    .map((entry) => {
      const family = families.find((item) => item.id === entry.familyId);
      if (!family) {
        return "";
      }

      return `
        <tr>
          <td>${escapeHtml(family.lastName)}</td>
          <td>${escapeHtml(family.address)}</td>
          <td>${escapeHtml(family.phone)}</td>
          <td>${formatPetLabelFr(family.hasDog)}</td>
          <td>${formatPetLabelFr(family.hasCat)}</td>
          <td>${entry.boys}</td>
          <td>${entry.girls}</td>
        </tr>
      `;
    })
    .join("");

  const staffRows = group.entries
    .filter((entry) => isTeacherOnlyEntry(entry))
    .map((entry) => {
      const family = families.find((item) => item.id === entry.familyId);
      if (!family) {
        return "";
      }

      return `
        <tr>
          <td>${escapeHtml(family.lastName)}</td>
          <td>${escapeHtml(family.address)}</td>
          <td>${escapeHtml(family.phone)}</td>
          <td>${entry.maleTeachers || 0}</td>
          <td>${entry.femaleTeachers || 0}</td>
        </tr>
      `;
    })
    .join("");

  const teacherMaleTotal = group.entries.reduce((sum, entry) => sum + (entry.maleTeachers || 0), 0);
  const teacherFemaleTotal = group.entries.reduce((sum, entry) => sum + (entry.femaleTeachers || 0), 0);
  const driverFamilyNames = [...new Set(group.entries
    .filter((entry) => isTeacherOnlyEntry(entry))
    .map((entry) => {
      const family = families.find((item) => item.id === entry.familyId);
      return family ? escapeHtml(family.lastName) : "";
    })
    .filter(Boolean))].join(", ");

  return `
    <html>
      <head>
        <title>${escapeHtml(group.title)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 20px; }
          th, td { border: 1px solid #999; padding: 8px; text-align: left; }
          h1 { margin-bottom: 6px; }
          h3 { margin-top: 20px; margin-bottom: 8px; }
          p { margin: 4px 0; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(group.title)}</h1>
        <p>Arrivée: ${escapeHtml(group.arrivalDate)} | Départ: ${escapeHtml(group.departureDate)}</p>
        <p>Professeurs: ${teacherMaleTotal}+${teacherFemaleTotal} | Chauffeurs: ${group.groupDrivers || 0}${driverFamilyNames ? " (" + driverFamilyNames + ")" : ""}</p>
        <p>Total enfants: ${totals.children}</p>

        <h3>Tableau familles</h3>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Adresse</th>
              <th>Téléphone</th>
              <th>Chien</th>
              <th>Chat</th>
              <th>Garçons</th>
              <th>Filles</th>
            </tr>
          </thead>
          <tbody>${familyRows}</tbody>
        </table>

        <h3>Tableau professeurs/chauffeurs</h3>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Adresse</th>
              <th>Téléphone</th>
              <th>Profs H</th>
              <th>Profs F</th>
            </tr>
          </thead>
          <tbody>${staffRows}</tbody>
        </table>
      </body>
    </html>
  `;
}

function isTeacherOnlyEntry(entry) {
  const teachers = (entry.maleTeachers || 0) + (entry.femaleTeachers || 0);
  return entry.entryType === "staff" || teachers > 0;
}

function getTotals(entries) {
  const familyEntries = entries.filter((entry) => !isTeacherOnlyEntry(entry));
  const staffEntries = entries.filter((entry) => isTeacherOnlyEntry(entry));

  const boys = familyEntries.reduce((sum, entry) => sum + (entry.boys || 0), 0);
  const girls = familyEntries.reduce((sum, entry) => sum + (entry.girls || 0), 0);
  const teacherCount = entries.reduce((sum, entry) => sum + (entry.maleTeachers || 0) + (entry.femaleTeachers || 0), 0);

  return {
    families: familyEntries.length,
    staffCount: staffEntries.length,
    boys,
    girls,
    children: boys + girls,
    teacherCount,
  };
}

function createEmptyGroup() {
  const today = formatDate(new Date());
  return {
    id: null,
    title: "",
    professores: 0,
    groupDrivers: 0,
    targetKids: 0,
    arrivalDate: today,
    departureDate: today,
    entries: [],
  };
}

function setDefaultDates() {
  if (!currentGroup.arrivalDate) {
    currentGroup.arrivalDate = formatDate(new Date());
  }
  if (!currentGroup.departureDate) {
    currentGroup.departureDate = formatDate(new Date());
  }
}

function setFormFromCurrentGroup() {
  if (!groupTitleInput || !professoresInput || !groupDriversInput || !targetKidsInput || !arrivalDateInput || !departureDateInput) {
    return;
  }

  groupTitleInput.value = currentGroup.title;
  professoresInput.value = currentGroup.professores;
  groupDriversInput.value = currentGroup.groupDrivers ?? 0;
  targetKidsInput.value = currentGroup.targetKids ?? 0;
  arrivalDateInput.value = currentGroup.arrivalDate;
  departureDateInput.value = currentGroup.departureDate;
}

function syncCurrentGroupFromForm() {
  if (!groupTitleInput || !professoresInput || !groupDriversInput || !targetKidsInput || !arrivalDateInput || !departureDateInput) {
    return;
  }

  currentGroup.title = groupTitleInput.value.trim();
  currentGroup.professores = Math.max(0, Number(professoresInput.value) || 0);
  currentGroup.groupDrivers = Math.max(0, Number(groupDriversInput.value) || 0);
  currentGroup.targetKids = Math.max(0, Number(targetKidsInput.value) || 0);
  currentGroup.arrivalDate = arrivalDateInput.value;
  currentGroup.departureDate = departureDateInput.value;
}

function saveDraftGroup() {
  localStorage.setItem(draftKey, JSON.stringify(currentGroup));
}

function loadDraftGroup() {
  const raw = localStorage.getItem(draftKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      id: parsed.id || null,
      title: parsed.title || "",
      professores: Math.max(0, Number(parsed.professores) || 0),
      groupDrivers: Math.max(0, Number(parsed.groupDrivers) || 0),
      targetKids: Math.max(0, Number(parsed.targetKids) || 0),
      arrivalDate: parsed.arrivalDate || formatDate(new Date()),
      departureDate: parsed.departureDate || formatDate(new Date()),
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.map((entry) => ({
            ...entry,
            entryType: entry.entryType || "family",
            maleTeachers: Math.max(0, Number(entry.maleTeachers) || 0),
            femaleTeachers: Math.max(0, Number(entry.femaleTeachers) || 0),
          }))
        : [],
    };
  } catch {
    return null;
  }
}

function isDateRangeValid(arrivalDate, departureDate) {
  return Boolean(arrivalDate && departureDate && arrivalDate <= departureDate);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA <= endB && startB <= endA;
}

function formatPetLabelFr(value) {
  if (value === "in") {
    return "intérieur";
  }
  if (value === "out") {
    return "extérieur";
  }
  return "aucun";
}

function setFeedback(message, type = "info") {
  if (!feedback) {
    return;
  }

  feedback.className = `feedback show feedback-${type}`;
  feedback.textContent = message;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
