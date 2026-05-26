const STATUSES = ["Backlog", "Planned", "In Progress", "Blocked", "Done", "Reviewed"];

const STATUS_META = {
  Backlog: { color: "#657089" },
  Planned: { color: "#2877d4" },
  "In Progress": { color: "#7c5cff" },
  Blocked: { color: "#ff725e" },
  Done: { color: "#39c58a" },
  Reviewed: { color: "#f35ca2" },
};

const DEFAULT_REPO = {
  owner: "divyam-gupta97",
  repo: "I-check-me",
  branch: "main",
  path: "data/itrackme-store.json",
};

const STORE_KEYS = {
  localStore: "itrackme.localStore",
  repo: "itrackme.repoSettings",
  token: "itrackme.githubToken",
  user: "itrackme.userName",
};

const EPIC_COLORS = ["#49b6ff", "#ff725e", "#39c58a", "#ffd166", "#7c5cff", "#f35ca2"];

const memoryStorage = new Map();

const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) || null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memoryStorage.delete(key);
    }
  },
};

const elements = {};

const state = {
  store: null,
  sha: null,
  repo: loadRepoSettings(),
  token: storage.get(STORE_KEYS.token) || "",
  currentUser: storage.get(STORE_KEYS.user) || "Local user",
  connected: false,
  sharedReadOnly: false,
  selectedDate: toISODate(new Date()),
  filters: {
    search: "",
    epic: "all",
  },
  activeView: "boardView",
  selectedTaskId: null,
  detailSearch: "",
  activeSummary: null,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init() {
  bindViewTabs();
  bindElements();
  bindEvents();
  hydrateFormDefaults();
  state.store = loadLocalStore();
  if (runAutoSummaries()) {
    storage.set(STORE_KEYS.localStore, JSON.stringify(state.store));
  }
  render();

  if (state.token) {
    connectToGitHub({ quiet: true });
  } else {
    loadPublicStoreFromGitHub({ quiet: true });
  }
}

function bindViewTabs() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.viewTarget));
  });
}

function bindElements() {
  [
    "syncStatus",
    "saveState",
    "boardTab",
    "tasksTab",
    "summariesTab",
    "settingsTab",
    "boardView",
    "taskDetailsView",
    "summariesView",
    "settingsView",
    "reloadButton",
    "newTaskButton",
    "repoOwner",
    "repoName",
    "repoBranch",
    "repoPath",
    "githubToken",
    "connectButton",
    "saveNowButton",
    "clearTokenButton",
    "epicForm",
    "epicName",
    "epicColor",
    "epicList",
    "epicCount",
    "statsGrid",
    "planDate",
    "taskSearch",
    "epicFilter",
    "plannerTitle",
    "plannerMetrics",
    "addPlannedTaskButton",
    "board",
    "taskListCount",
    "detailSearch",
    "createTaskFromDetailsButton",
    "detailTaskList",
    "taskDetailsMode",
    "taskDetailsTitle",
    "backToBoardButton",
    "taskDetailsEmpty",
    "dailySummaryState",
    "dailySummaryPreview",
    "saveDailySummaryButton",
    "exportDailyButton",
    "printDailyButton",
    "weeklySummaryState",
    "weeklySummaryPreview",
    "saveWeeklySummaryButton",
    "exportWeeklyButton",
    "printWeeklyButton",
    "summaryCount",
    "summaryList",
    "taskForm",
    "taskId",
    "taskTitle",
    "taskDetails",
    "taskEpic",
    "taskStatus",
    "taskPlannedDate",
    "taskPriority",
    "taskCreatedMeta",
    "taskHistory",
    "deleteTaskButton",
    "resetTaskButton",
    "summaryDialog",
    "summaryDialogTitle",
    "summaryDialogBody",
    "closeSummaryDialog",
    "summaryMarkdownButton",
    "summaryPrintButton",
    "toast",
    "printArea",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  elements.reloadButton.addEventListener("click", reloadData);
  elements.newTaskButton.addEventListener("click", () => openTaskDetails());
  elements.addPlannedTaskButton.addEventListener("click", () => openTaskDetails({ plannedDate: state.selectedDate, status: "Planned" }));
  elements.connectButton.addEventListener("click", () => connectToGitHub());
  elements.saveNowButton.addEventListener("click", () => persist("Manual save"));
  elements.clearTokenButton.addEventListener("click", clearToken);
  elements.epicForm.addEventListener("submit", addEpic);
  elements.planDate.addEventListener("change", (event) => {
    state.selectedDate = event.target.value || toISODate(new Date());
    render();
  });
  elements.taskSearch.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderBoard();
  });
  elements.epicFilter.addEventListener("change", (event) => {
    state.filters.epic = event.target.value;
    render();
  });
  elements.detailSearch.addEventListener("input", (event) => {
    state.detailSearch = event.target.value.trim().toLowerCase();
    renderTaskDetailsList();
  });
  elements.createTaskFromDetailsButton.addEventListener("click", () => openTaskDetails());
  elements.backToBoardButton.addEventListener("click", () => showView("boardView"));
  elements.saveDailySummaryButton.addEventListener("click", () => saveSummary("daily"));
  elements.saveWeeklySummaryButton.addEventListener("click", () => saveSummary("weekly"));
  elements.exportDailyButton.addEventListener("click", () => downloadSummary(getDailySummaryForSelectedDate(), "markdown"));
  elements.exportWeeklyButton.addEventListener("click", () => downloadSummary(getWeeklySummaryForSelectedDate(), "markdown"));
  elements.printDailyButton.addEventListener("click", () => printSummary(getDailySummaryForSelectedDate()));
  elements.printWeeklyButton.addEventListener("click", () => printSummary(getWeeklySummaryForSelectedDate()));
  elements.taskForm.addEventListener("submit", saveTaskFromForm);
  elements.deleteTaskButton.addEventListener("click", deleteCurrentTask);
  elements.resetTaskButton.addEventListener("click", resetTaskForm);
  elements.closeSummaryDialog.addEventListener("click", () => elements.summaryDialog.close());
  elements.summaryMarkdownButton.addEventListener("click", () => downloadSummary(state.activeSummary, "markdown"));
  elements.summaryPrintButton.addEventListener("click", () => printSummary(state.activeSummary));
}

function hydrateFormDefaults() {
  elements.repoOwner.value = state.repo.owner;
  elements.repoName.value = state.repo.repo;
  elements.repoBranch.value = state.repo.branch;
  elements.repoPath.value = state.repo.path;
  elements.githubToken.value = state.token;
  elements.planDate.value = state.selectedDate;

  elements.taskStatus.innerHTML = STATUSES.map((status) => `<option>${escapeHTML(status)}</option>`).join("");
}

function createDefaultStore() {
  const now = new Date().toISOString();
  return {
    version: 1,
    app: "ITrackMe",
    updatedAt: now,
    epics: [
      createEpic("School Wins", "#49b6ff"),
      createEpic("Coding Quest", "#7c5cff"),
      createEpic("Home Base", "#39c58a"),
    ],
    tasks: [],
    summaries: {
      daily: {},
      weekly: {},
    },
    meta: {
      createdAt: now,
      lastSummaryRunAt: now,
    },
  };
}

function loadLocalStore() {
  const raw = storage.get(STORE_KEYS.localStore);
  if (!raw) {
    return createDefaultStore();
  }

  try {
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    console.warn(error);
    return createDefaultStore();
  }
}

function loadRepoSettings() {
  const hostedRepo = getHostedRepoSettings();
  const defaultRepo = hostedRepo || DEFAULT_REPO;
  const raw = storage.get(STORE_KEYS.repo);
  if (!raw) {
    return { ...defaultRepo };
  }

  try {
    const saved = { ...DEFAULT_REPO, ...JSON.parse(raw) };
    if (hostedRepo) {
      return {
        ...saved,
        owner: hostedRepo.owner,
        repo: hostedRepo.repo,
      };
    }
    return saved;
  } catch (error) {
    console.warn(error);
    return { ...defaultRepo };
  }
}

function getHostedRepoSettings() {
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith(".github.io")) {
    return null;
  }

  const repo = window.location.pathname.split("/").filter(Boolean)[0];
  if (!repo) {
    return null;
  }

  return {
    owner: host.replace(".github.io", ""),
    repo,
    branch: DEFAULT_REPO.branch,
    path: DEFAULT_REPO.path,
  };
}

function normalizeStore(store) {
  const base = createDefaultStore();
  const next = { ...base, ...store };
  next.epics = Array.isArray(store.epics) && store.epics.length ? store.epics : base.epics;
  next.tasks = Array.isArray(store.tasks) ? store.tasks : [];
  next.summaries = {
    daily: store.summaries?.daily || {},
    weekly: store.summaries?.weekly || {},
  };
  next.meta = { ...base.meta, ...(store.meta || {}) };
  next.tasks = next.tasks.map((task) => ({
    details: "",
    priority: "Medium",
    history: [],
    ...task,
  }));
  return next;
}

function createEpic(name, color) {
  return {
    id: createId("epic"),
    name,
    color,
    createdAt: new Date().toISOString(),
  };
}

function createId(prefix) {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return `${prefix}-${randomUUID.call(globalThis.crypto)}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function connectToGitHub(options = {}) {
  const repo = getRepoSettingsFromForm();
  const token = elements.githubToken.value.trim();

  if (!token) {
    state.connected = false;
    storage.remove(STORE_KEYS.token);
    renderConnection();
    showToast("Add a GitHub token to turn on shared sync.");
    return;
  }

  state.repo = repo;
  state.token = token;
  storage.set(STORE_KEYS.repo, JSON.stringify(repo));
  storage.set(STORE_KEYS.token, token);

  setSaveState("Connecting");
  try {
    const user = await githubRequest("/user");
    state.currentUser = user.login || user.name || "GitHub user";
    storage.set(STORE_KEYS.user, state.currentUser);

    const result = await loadStoreFromGitHub({ createIfMissing: true });
    state.store = result.store;
    state.sha = result.sha;
    state.connected = true;
    state.sharedReadOnly = false;
    const summariesChanged = runAutoSummaries();
    storage.set(STORE_KEYS.localStore, JSON.stringify(state.store));
    render();
    if (summariesChanged) {
      state.store.updatedAt = new Date().toISOString();
      const saved = await saveStoreToGitHub(state.store, state.sha, "Save automatic summaries");
      state.sha = saved.content?.sha || state.sha;
    }
    setSaveState("Synced");
    if (!options.quiet) {
      showToast(`Connected as ${state.currentUser}.`);
    }
  } catch (error) {
    state.connected = false;
    state.sharedReadOnly = false;
    renderConnection();
    setSaveState("Local");
    showToast(getFriendlyError(error));
  }
}

async function loadPublicStoreFromGitHub(options = {}) {
  setSaveState("Loading");
  try {
    const result = await loadRawStoreFromGitHub();
    state.store = result.store;
    state.sha = result.sha;
    state.connected = false;
    state.sharedReadOnly = true;
    storage.set(STORE_KEYS.localStore, JSON.stringify(state.store));
    render();
    setSaveState("Read only");
    if (!options.quiet) {
      showToast("Loaded shared GitHub data. Connect in Settings to save changes for everyone.");
    }
  } catch (error) {
    try {
      const result = await loadStoreFromGitHub({ createIfMissing: false, publicRead: true });
      state.store = result.store;
      state.sha = result.sha;
      state.connected = false;
      state.sharedReadOnly = true;
      storage.set(STORE_KEYS.localStore, JSON.stringify(state.store));
      render();
      setSaveState("Read only");
      if (!options.quiet) {
        showToast("Loaded shared GitHub data. Connect in Settings to save changes for everyone.");
      }
    } catch (apiError) {
      state.sharedReadOnly = false;
      renderConnection();
      setSaveState("Local");
      if (!options.quiet) {
        showToast(`Shared data could not be loaded: ${getFriendlyError(apiError)}`);
      }
    }
  }
}

async function loadRawStoreFromGitHub() {
  const url = getRawStoreUrl();
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = new Error(`Raw GitHub data failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return {
    store: normalizeStore(await response.json()),
    sha: null,
  };
}

function getRawStoreUrl() {
  return [
    "https://raw.githubusercontent.com",
    encodeURIComponent(state.repo.owner),
    encodeURIComponent(state.repo.repo),
    encodeURIComponent(state.repo.branch),
    ...state.repo.path.split("/").map(encodeURIComponent),
  ].join("/") + `?cache_bust=${Date.now()}`;
}

async function loadStoreFromGitHub(options = {}) {
  const createIfMissing = options.createIfMissing ?? Boolean(state.token);
  const contentPath = `/repos/${state.repo.owner}/${state.repo.repo}/contents/${encodeURIComponentPath(state.repo.path)}?ref=${encodeURIComponent(state.repo.branch)}&cache_bust=${Date.now()}`;

  try {
    const file = await githubRequest(contentPath, { publicRead: options.publicRead });
    const text = decodeBase64(file.content || "");
    return {
      store: normalizeStore(JSON.parse(text)),
      sha: file.sha,
    };
  } catch (error) {
    if (error.status === 404 && createIfMissing) {
      const store = normalizeStore(state.store || createDefaultStore());
      const saved = await saveStoreToGitHub(store, null, "Create ITrackMe data store");
      return { store, sha: saved.content?.sha || null };
    }

    throw error;
  }
}

async function saveStoreToGitHub(store, sha, message) {
  const body = {
    message,
    content: encodeBase64(JSON.stringify(store, null, 2)),
    branch: state.repo.branch,
  };

  if (sha) {
    body.sha = sha;
  }

  return githubRequest(`/repos/${state.repo.owner}/${state.repo.repo}/contents/${encodeURIComponentPath(state.repo.path)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function githubRequest(path, options = {}) {
  const { publicRead = false, ...fetchOptions } = options;
  const url = path.startsWith("https://") ? path : `https://api.github.com${path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    ...(fetchOptions.headers || {}),
  };
  if (!publicRead) {
    headers["X-GitHub-Api-Version"] = "2022-11-28";
  }
  if (state.token && !publicRead) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = new Error(`GitHub request failed with ${response.status}`);
    error.status = response.status;
    try {
      error.details = await response.json();
    } catch {
      error.details = null;
    }
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

async function reloadData() {
  if (!state.connected) {
    await loadPublicStoreFromGitHub();
    return;
  }

  setSaveState("Reloading");
  try {
    const result = await loadStoreFromGitHub({ createIfMissing: true });
    state.store = result.store;
    state.sha = result.sha;
    const summariesChanged = runAutoSummaries();
    storage.set(STORE_KEYS.localStore, JSON.stringify(state.store));
    render();
    if (summariesChanged) {
      state.store.updatedAt = new Date().toISOString();
      const saved = await saveStoreToGitHub(state.store, state.sha, "Save automatic summaries");
      state.sha = saved.content?.sha || state.sha;
    }
    setSaveState("Synced");
    showToast("Shared data reloaded.");
  } catch (error) {
    setSaveState("Issue");
    showToast(getFriendlyError(error));
  }
}

async function persist(message) {
  state.store.updatedAt = new Date().toISOString();
  runAutoSummaries();
  storage.set(STORE_KEYS.localStore, JSON.stringify(state.store));
  render();

  if (!state.connected) {
    setSaveState("Local");
    if (state.sharedReadOnly) {
      showToast("Saved in this browser. Connect in Settings to save for everyone.");
    } else {
      showToast("Saved locally.");
    }
    return;
  }

  setSaveState("Saving");
  try {
    const result = await saveStoreToGitHub(state.store, state.sha, message || "Update ITrackMe data");
    state.sha = result.content?.sha || state.sha;
    setSaveState("Synced");
    showToast("Saved to GitHub.");
  } catch (error) {
    if (error.status === 409) {
      setSaveState("Conflict");
      showToast("The shared file changed. Reload, then try the save again.");
      return;
    }
    setSaveState("Issue");
    showToast(getFriendlyError(error));
  }
}

function clearToken() {
  state.token = "";
  state.connected = false;
  state.sharedReadOnly = false;
  state.sha = null;
  elements.githubToken.value = "";
  storage.remove(STORE_KEYS.token);
  renderConnection();
  setSaveState("Local");
  showToast("GitHub token cleared.");
}

function getRepoSettingsFromForm() {
  return {
    owner: elements.repoOwner.value.trim() || DEFAULT_REPO.owner,
    repo: elements.repoName.value.trim() || DEFAULT_REPO.repo,
    branch: elements.repoBranch.value.trim() || DEFAULT_REPO.branch,
    path: elements.repoPath.value.trim() || DEFAULT_REPO.path,
  };
}

function addEpic(event) {
  event.preventDefault();
  const name = elements.epicName.value.trim();
  if (!name) {
    return;
  }

  const color = elements.epicColor.value || EPIC_COLORS[state.store.epics.length % EPIC_COLORS.length];
  state.store.epics.push(createEpic(name, color));
  elements.epicName.value = "";
  elements.epicColor.value = EPIC_COLORS[state.store.epics.length % EPIC_COLORS.length];
  persist(`Add epic: ${name}`);
}

function deleteEpic(epicId) {
  const hasTasks = state.store.tasks.some((task) => task.epicId === epicId);
  if (hasTasks) {
    showToast("Move or delete this epic's tasks first.");
    return;
  }

  state.store.epics = state.store.epics.filter((epic) => epic.id !== epicId);
  persist("Delete epic");
}

function showView(viewId) {
  state.activeView = viewId;
  document.querySelectorAll(".app-view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTarget === viewId);
  });
}

function openTaskDetails(seed = {}) {
  const editing = Boolean(seed.id);
  const task = editing ? getTask(seed.id) : seed;
  state.selectedTaskId = task.id || null;
  showView("taskDetailsView");
  elements.taskDetailsMode.textContent = editing ? "Edit" : "New";
  elements.taskDetailsTitle.textContent = editing ? "Update task" : "Create task";
  elements.taskDetailsEmpty.classList.add("hidden");
  elements.taskForm.classList.remove("hidden");
  elements.taskId.value = task.id || "";
  elements.taskTitle.value = task.title || "";
  elements.taskDetails.value = task.details || "";
  elements.taskPlannedDate.value = task.plannedDate || state.selectedDate;
  elements.taskPriority.value = task.priority || "Medium";
  renderTaskEpicOptions(task.epicId);
  elements.taskStatus.value = task.status || "Backlog";
  elements.deleteTaskButton.style.visibility = editing ? "visible" : "hidden";
  renderTaskDetailsMeta(editing ? task : null);
  renderTaskHistory(editing ? task : null);
  renderTaskDetailsList();
  setTimeout(() => elements.taskTitle.focus(), 50);
}

function showEmptyTaskDetails() {
  state.selectedTaskId = null;
  elements.taskDetailsMode.textContent = "Select";
  elements.taskDetailsTitle.textContent = "Task details";
  elements.taskDetailsEmpty.classList.remove("hidden");
  elements.taskForm.classList.add("hidden");
  elements.taskForm.reset();
}

function resetTaskForm() {
  const id = elements.taskId.value;
  if (id) {
    openTaskDetails(getTask(id));
    return;
  }

  openTaskDetails();
}

function saveTaskFromForm(event) {
  event.preventDefault();
  const now = new Date().toISOString();
  const existingId = elements.taskId.value;
  const status = elements.taskStatus.value;
  const previous = existingId ? getTask(existingId) : null;
  const task = {
    id: existingId || createId("task"),
    title: elements.taskTitle.value.trim(),
    details: elements.taskDetails.value.trim(),
    epicId: elements.taskEpic.value,
    status,
    plannedDate: elements.taskPlannedDate.value,
    priority: elements.taskPriority.value,
    createdAt: previous?.createdAt || now,
    createdBy: previous?.createdBy || state.currentUser,
    updatedAt: now,
    updatedBy: state.currentUser,
    achievedAt: previous?.achievedAt || null,
    reviewedAt: previous?.reviewedAt || null,
    history: previous?.history || [],
  };

  if (!task.title) {
    showToast("Give the task a title.");
    return;
  }

  applyAchievementDates(task, previous?.status);

  if (previous) {
    task.history = [
      ...task.history,
      createHistoryEntry("Edited", previous.status, task.status),
    ];
    state.store.tasks = state.store.tasks.map((item) => (item.id === task.id ? task : item));
  } else {
    task.history = [createHistoryEntry("Created", null, task.status)];
    state.store.tasks.unshift(task);
  }

  state.selectedTaskId = task.id;
  elements.taskDetailsMode.textContent = "Edit";
  elements.taskDetailsTitle.textContent = "Update task";
  elements.taskId.value = task.id;
  elements.deleteTaskButton.style.visibility = "visible";
  renderTaskDetailsMeta(task);
  renderTaskHistory(task);
  renderTaskDetailsList();
  persist(previous ? `Update task: ${task.title}` : `Create task: ${task.title}`);
}

function deleteCurrentTask() {
  const id = elements.taskId.value;
  if (!id) {
    return;
  }

  const task = getTask(id);
  state.store.tasks = state.store.tasks.filter((item) => item.id !== id);
  showEmptyTaskDetails();
  renderTaskDetailsList();
  persist(`Delete task: ${task?.title || "task"}`);
}

function updateTaskStatus(taskId, status) {
  const task = getTask(taskId);
  if (!task || task.status === status) {
    return;
  }

  const previousStatus = task.status;
  task.status = status;
  task.updatedAt = new Date().toISOString();
  task.updatedBy = state.currentUser;
  applyAchievementDates(task, previousStatus);
  task.history = task.history || [];
  task.history.push(createHistoryEntry("State changed", previousStatus, status));
  persist(`Move task: ${task.title} to ${status}`);
}

function updateTaskPlanDate(taskId, plannedDate) {
  const task = getTask(taskId);
  if (!task || task.plannedDate === plannedDate) {
    return;
  }

  task.plannedDate = plannedDate;
  task.updatedAt = new Date().toISOString();
  task.updatedBy = state.currentUser;
  task.history = task.history || [];
  task.history.push(createHistoryEntry("Plan date changed", null, plannedDate || "Unplanned"));
  persist(`Plan task: ${task.title}`);
}

function applyAchievementDates(task, previousStatus) {
  const now = new Date().toISOString();
  const movedIntoAchieved = ["Done", "Reviewed"].includes(task.status) && !["Done", "Reviewed"].includes(previousStatus);
  if (movedIntoAchieved && !task.achievedAt) {
    task.achievedAt = now;
  }

  if (task.status === "Reviewed" && previousStatus !== "Reviewed" && !task.reviewedAt) {
    task.reviewedAt = now;
  }
}

function createHistoryEntry(action, from, to) {
  return {
    at: new Date().toISOString(),
    user: state.currentUser,
    action,
    from,
    to,
  };
}

function getTask(id) {
  return state.store.tasks.find((task) => task.id === id);
}

function render() {
  renderConnection();
  renderEpicOptions();
  renderEpics();
  renderStats();
  renderPlanner();
  renderBoard();
  renderTaskDetailsList();
  renderSummaries();
}

function renderConnection() {
  if (state.connected) {
    elements.syncStatus.textContent = `GitHub: ${state.repo.owner}/${state.repo.repo}`;
  } else if (state.sharedReadOnly) {
    elements.syncStatus.textContent = `Read only: ${state.repo.owner}/${state.repo.repo}`;
  } else {
    elements.syncStatus.textContent = "Local demo";
  }
  elements.syncStatus.classList.toggle("offline", !state.connected && !state.sharedReadOnly);
}

function setSaveState(label) {
  elements.saveState.textContent = label;
}

function renderEpicOptions() {
  const current = state.filters.epic;
  elements.epicFilter.innerHTML = [
    `<option value="all">All epics</option>`,
    ...state.store.epics.map((epic) => `<option value="${escapeHTML(epic.id)}">${escapeHTML(epic.name)}</option>`),
  ].join("");
  elements.epicFilter.value = state.store.epics.some((epic) => epic.id === current) ? current : "all";
  state.filters.epic = elements.epicFilter.value;
}

function renderTaskEpicOptions(selectedEpicId) {
  if (!state.store.epics.length) {
    state.store.epics.push(createEpic("General", "#49b6ff"));
  }

  elements.taskEpic.innerHTML = state.store.epics
    .map((epic) => `<option value="${escapeHTML(epic.id)}">${escapeHTML(epic.name)}</option>`)
    .join("");
  elements.taskEpic.value = selectedEpicId || state.store.epics[0].id;
}

function renderEpics() {
  elements.epicCount.textContent = String(state.store.epics.length);
  elements.epicList.innerHTML = state.store.epics
    .map((epic) => {
      const count = state.store.tasks.filter((task) => task.epicId === epic.id).length;
      return `
        <div class="epic-item">
          <span class="epic-dot" style="background:${escapeHTML(epic.color)}"></span>
          <span class="epic-name" title="${escapeHTML(epic.name)}">${escapeHTML(epic.name)}</span>
          <button class="icon-button" type="button" title="Delete epic" aria-label="Delete epic" data-action="delete-epic" data-epic-id="${escapeHTML(epic.id)}">x</button>
          <span></span>
          <span class="epic-count">${count} task${count === 1 ? "" : "s"}</span>
          <span></span>
        </div>
      `;
    })
    .join("");

  elements.epicList.querySelectorAll("[data-action='delete-epic']").forEach((button) => {
    button.addEventListener("click", () => deleteEpic(button.dataset.epicId));
  });
}

function renderStats() {
  const tasks = state.store.tasks;
  const plannedToday = tasks.filter((task) => task.plannedDate === state.selectedDate).length;
  const achievedToday = tasks.filter((task) => isSameLocalDate(task.achievedAt, state.selectedDate)).length;
  const reviewed = tasks.filter((task) => task.status === "Reviewed").length;
  const blocked = tasks.filter((task) => task.status === "Blocked").length;
  const stats = [
    ["Tasks", tasks.length],
    ["Planned", plannedToday],
    ["Achieved", achievedToday],
    ["Reviewed", reviewed],
    ["Blocked", blocked],
    ["Epics", state.store.epics.length],
  ];

  elements.statsGrid.innerHTML = stats
    .map(
      ([label, value]) => `
        <div class="stat-tile">
          <span class="stat-number">${value}</span>
          <span class="stat-label">${escapeHTML(label)}</span>
        </div>
      `,
    )
    .join("");
}

function renderPlanner() {
  elements.planDate.value = state.selectedDate;
  elements.plannerTitle.textContent = formatDateLong(state.selectedDate);
  const planned = state.store.tasks.filter((task) => task.plannedDate === state.selectedDate);
  const achieved = planned.filter((task) => ["Done", "Reviewed"].includes(task.status));
  const blocked = planned.filter((task) => task.status === "Blocked");
  const reviewed = planned.filter((task) => task.status === "Reviewed");
  const unplanned = state.store.tasks.filter((task) => !task.plannedDate).length;

  const metrics = [
    ["Planned", planned.length],
    ["Achieved", achieved.length],
    ["Reviewed", reviewed.length],
    ["Unplanned", unplanned],
  ];

  if (blocked.length) {
    metrics[3] = ["Blocked", blocked.length];
  }

  elements.plannerMetrics.innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="metric-pill">
          <strong>${value}</strong>
          <span>${escapeHTML(label)}</span>
        </div>
      `,
    )
    .join("");
}

function renderBoard() {
  const tasks = getFilteredTasks();
  elements.board.innerHTML = STATUSES.map((status) => {
    const laneTasks = tasks.filter((task) => task.status === status);
    return `
      <section class="lane" data-status="${escapeHTML(status)}">
        <div class="lane-header" style="background:${STATUS_META[status].color}">
          <h2>${escapeHTML(status)}</h2>
          <span class="lane-count">${laneTasks.length}</span>
        </div>
        <div class="lane-body" data-drop-status="${escapeHTML(status)}">
          ${
            laneTasks.length
              ? laneTasks.map(renderTaskCard).join("")
              : `<div class="empty-state">Drop tasks here</div>`
          }
        </div>
      </section>
    `;
  }).join("");

  elements.board.querySelectorAll("[data-action='edit-task']").forEach((button) => {
    button.addEventListener("click", () => openTaskDetails(getTask(button.dataset.taskId)));
  });
  elements.board.querySelectorAll("[data-action='status-select']").forEach((select) => {
    select.addEventListener("change", () => updateTaskStatus(select.dataset.taskId, select.value));
  });
  elements.board.querySelectorAll("[data-action='plan-date']").forEach((input) => {
    input.addEventListener("change", () => updateTaskPlanDate(input.dataset.taskId, input.value));
  });
  elements.board.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", card.dataset.taskId);
      event.dataTransfer.effectAllowed = "move";
    });
  });
  elements.board.querySelectorAll("[data-drop-status]").forEach((lane) => {
    lane.addEventListener("dragover", (event) => {
      event.preventDefault();
      lane.classList.add("drop-ready");
    });
    lane.addEventListener("dragleave", () => lane.classList.remove("drop-ready"));
    lane.addEventListener("drop", (event) => {
      event.preventDefault();
      lane.classList.remove("drop-ready");
      const taskId = event.dataTransfer.getData("text/plain");
      updateTaskStatus(taskId, lane.dataset.dropStatus);
    });
  });
}

function renderTaskCard(task) {
  const epic = getEpic(task.epicId);
  const epicName = epic?.name || "No epic";
  const epicColor = epic?.color || "#49b6ff";
  return `
    <article class="task-card" draggable="true" data-task-id="${escapeHTML(task.id)}" style="border-left-color:${escapeHTML(epicColor)}">
      <div class="task-topline">
        <span class="epic-chip" style="background:${hexToSoftBackground(epicColor)}">${escapeHTML(epicName)}</span>
        <span class="priority-chip priority-${escapeHTML(task.priority || "Medium")}">${escapeHTML(task.priority || "Medium")}</span>
      </div>
      <h3>${escapeHTML(task.title)}</h3>
      ${task.details ? `<p>${escapeHTML(task.details)}</p>` : ""}
      <div class="task-footer">
        <span class="date-chip">${task.plannedDate ? escapeHTML(formatDateShort(task.plannedDate)) : "Unplanned"}</span>
        <button class="button button-ghost" type="button" data-action="edit-task" data-task-id="${escapeHTML(task.id)}">Details</button>
      </div>
      <div class="task-actions">
        <input type="date" value="${escapeHTML(task.plannedDate || "")}" data-action="plan-date" data-task-id="${escapeHTML(task.id)}" title="Planned date" />
        <select data-action="status-select" data-task-id="${escapeHTML(task.id)}" title="State">
          ${STATUSES.map((status) => `<option ${status === task.status ? "selected" : ""}>${escapeHTML(status)}</option>`).join("")}
        </select>
      </div>
    </article>
  `;
}

function renderTaskDetailsList() {
  const search = state.detailSearch;
  const tasks = state.store.tasks
    .filter((task) => {
      if (!search) {
        return true;
      }
      return `${task.title} ${task.details || ""}`.toLowerCase().includes(search);
    })
    .sort((a, b) => {
      const aDate = a.plannedDate || "9999-12-31";
      const bDate = b.plannedDate || "9999-12-31";
      if (aDate !== bDate) {
        return aDate.localeCompare(bDate);
      }
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });

  elements.taskListCount.textContent = String(tasks.length);
  if (!tasks.length) {
    elements.detailTaskList.innerHTML = `<div class="empty-state">No tasks found</div>`;
    return;
  }

  elements.detailTaskList.innerHTML = tasks.map((task) => {
    const epic = getEpic(task.epicId);
    return `
      <button class="detail-task-button ${task.id === state.selectedTaskId ? "active" : ""}" type="button" data-task-id="${escapeHTML(task.id)}">
        <span class="detail-task-title">${escapeHTML(task.title)}</span>
        <span class="detail-task-meta">${escapeHTML(task.status)} - ${escapeHTML(epic?.name || "No epic")}</span>
      </button>
    `;
  }).join("");

  elements.detailTaskList.querySelectorAll("[data-task-id]").forEach((button) => {
    button.addEventListener("click", () => openTaskDetails(getTask(button.dataset.taskId)));
  });
}

function renderTaskDetailsMeta(task) {
  if (!task) {
    elements.taskCreatedMeta.innerHTML = "";
    return;
  }

  elements.taskCreatedMeta.innerHTML = `
    <span>Created by ${escapeHTML(task.createdBy || "Unknown")} on ${escapeHTML(formatDateTime(task.createdAt))}</span>
    <span>Last updated by ${escapeHTML(task.updatedBy || "Unknown")} on ${escapeHTML(formatDateTime(task.updatedAt || task.createdAt))}</span>
  `;
}

function renderTaskHistory(task) {
  if (!task || !task.history?.length) {
    elements.taskHistory.innerHTML = `<h3>History</h3><p>No changes yet.</p>`;
    return;
  }

  elements.taskHistory.innerHTML = `
    <h3>History</h3>
    <div class="history-list">
      ${task.history
        .slice()
        .reverse()
        .slice(0, 8)
        .map(
          (entry) => `
            <div class="history-item">
              <strong>${escapeHTML(entry.action)}</strong>
              <span>${escapeHTML(entry.user || "Unknown")} - ${escapeHTML(formatDateTime(entry.at))}</span>
              ${entry.from || entry.to ? `<span>${escapeHTML(entry.from || "")}${entry.from && entry.to ? " to " : ""}${escapeHTML(entry.to || "")}</span>` : ""}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function getFilteredTasks() {
  const search = state.filters.search;
  return state.store.tasks
    .filter((task) => state.filters.epic === "all" || task.epicId === state.filters.epic)
    .filter((task) => {
      if (!search) {
        return true;
      }
      return `${task.title} ${task.details || ""}`.toLowerCase().includes(search);
    })
    .sort((a, b) => {
      const aDate = a.plannedDate || "9999-12-31";
      const bDate = b.plannedDate || "9999-12-31";
      if (aDate !== bDate) {
        return aDate.localeCompare(bDate);
      }
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });
}

function getEpic(epicId) {
  return state.store.epics.find((epic) => epic.id === epicId);
}

function renderSummaries() {
  const daily = getDailySummaryForSelectedDate();
  const weekly = getWeeklySummaryForSelectedDate();
  elements.dailySummaryState.textContent = state.store.summaries.daily[state.selectedDate] ? "Saved" : "Live";
  elements.weeklySummaryState.textContent = state.store.summaries.weekly[weekly.id] ? "Saved" : "Live";
  elements.dailySummaryPreview.innerHTML = renderSummaryPreview(daily);
  elements.weeklySummaryPreview.innerHTML = renderSummaryPreview(weekly);
  renderSummaryArchive();
}

function renderSummaryPreview(summary) {
  return `
    <h3>${escapeHTML(summary.title)}</h3>
    <div class="summary-meter">
      <div><strong>${summary.plannedCount}</strong><span>Planned</span></div>
      <div><strong>${summary.achievedCount}</strong><span>Achieved</span></div>
      <div><strong>${summary.reviewedCount}</strong><span>Reviewed</span></div>
    </div>
    <p>${escapeHTML(summary.note)}</p>
  `;
}

function renderSummaryArchive() {
  const summaries = [
    ...Object.values(state.store.summaries.daily || {}),
    ...Object.values(state.store.summaries.weekly || {}),
  ].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  elements.summaryCount.textContent = String(summaries.length);
  if (!summaries.length) {
    elements.summaryList.innerHTML = `<div class="empty-state">Saved summaries will appear here</div>`;
    return;
  }

  elements.summaryList.innerHTML = summaries
    .slice(0, 16)
    .map(
      (summary) => `
        <div class="summary-item">
          <span class="summary-item-title">${escapeHTML(summary.title)}</span>
          <span class="summary-item-meta">${summary.plannedCount} planned - ${summary.achievedCount} achieved - ${summary.reviewedCount} reviewed</span>
          <button class="button button-soft" type="button" data-action="open-summary" data-summary-type="${escapeHTML(summary.type)}" data-summary-id="${escapeHTML(summary.id)}">Open</button>
        </div>
      `,
    )
    .join("");

  elements.summaryList.querySelectorAll("[data-action='open-summary']").forEach((button) => {
    button.addEventListener("click", () => openSummary(button.dataset.summaryType, button.dataset.summaryId));
  });
}

function getDailySummaryForSelectedDate() {
  return state.store.summaries.daily[state.selectedDate] || buildDailySummary(state.selectedDate, false);
}

function getWeeklySummaryForSelectedDate() {
  const start = weekStartISO(state.selectedDate);
  const id = weekId(start);
  return state.store.summaries.weekly[id] || buildWeeklySummary(start, false);
}

function saveSummary(type) {
  if (type === "daily") {
    state.store.summaries.daily[state.selectedDate] = buildDailySummary(state.selectedDate, true);
    persist(`Save daily summary: ${state.selectedDate}`);
    return;
  }

  const start = weekStartISO(state.selectedDate);
  const id = weekId(start);
  state.store.summaries.weekly[id] = buildWeeklySummary(start, true);
  persist(`Save weekly summary: ${id}`);
}

function runAutoSummaries() {
  if (!state.store) {
    return false;
  }

  const today = toISODate(new Date());
  let changed = false;
  const activeDates = collectActiveDates().filter((date) => date < today);
  activeDates.forEach((date) => {
    if (!state.store.summaries.daily[date]) {
      state.store.summaries.daily[date] = buildDailySummary(date, true, "auto");
      changed = true;
    }
  });

  const weekStarts = [...new Set(activeDates.map(weekStartISO))].filter((start) => weekEndISO(start) < today);
  weekStarts.forEach((start) => {
    const id = weekId(start);
    if (!state.store.summaries.weekly[id]) {
      state.store.summaries.weekly[id] = buildWeeklySummary(start, true, "auto");
      changed = true;
    }
  });

  if (changed) {
    state.store.meta.lastSummaryRunAt = new Date().toISOString();
  }

  return changed;
}

function collectActiveDates() {
  const dates = new Set();
  state.store.tasks.forEach((task) => {
    if (task.plannedDate) {
      dates.add(task.plannedDate);
    }
    if (task.achievedAt) {
      dates.add(toISODate(new Date(task.achievedAt)));
    }
    if (task.reviewedAt) {
      dates.add(toISODate(new Date(task.reviewedAt)));
    }
  });
  return [...dates].sort();
}

function buildDailySummary(date, saved, source = "manual") {
  const plannedTasks = state.store.tasks.filter((task) => task.plannedDate === date);
  const achievedTasks = state.store.tasks.filter((task) => isSameLocalDate(task.achievedAt, date));
  const reviewedTasks = state.store.tasks.filter((task) => isSameLocalDate(task.reviewedAt, date));
  const openPlannedTasks = plannedTasks.filter((task) => !["Done", "Reviewed"].includes(task.status));

  return {
    id: date,
    type: "daily",
    title: `Daily summary: ${formatDateLong(date)}`,
    date,
    source,
    saved,
    createdAt: new Date().toISOString(),
    plannedCount: plannedTasks.length,
    achievedCount: uniqueTasks(achievedTasks).length,
    reviewedCount: uniqueTasks(reviewedTasks).length,
    openCount: openPlannedTasks.length,
    plannedTaskIds: plannedTasks.map((task) => task.id),
    achievedTaskIds: uniqueTasks(achievedTasks).map((task) => task.id),
    reviewedTaskIds: uniqueTasks(reviewedTasks).map((task) => task.id),
    openTaskIds: openPlannedTasks.map((task) => task.id),
    note: summaryNote(plannedTasks.length, uniqueTasks(achievedTasks).length, uniqueTasks(reviewedTasks).length, openPlannedTasks.length),
  };
}

function buildWeeklySummary(start, saved, source = "manual") {
  const end = weekEndISO(start);
  const plannedTasks = state.store.tasks.filter((task) => task.plannedDate && task.plannedDate >= start && task.plannedDate <= end);
  const achievedTasks = state.store.tasks.filter((task) => task.achievedAt && timestampDateInRange(task.achievedAt, start, end));
  const reviewedTasks = state.store.tasks.filter((task) => task.reviewedAt && timestampDateInRange(task.reviewedAt, start, end));
  const openPlannedTasks = plannedTasks.filter((task) => !["Done", "Reviewed"].includes(task.status));

  return {
    id: weekId(start),
    type: "weekly",
    title: `Weekly summary: ${formatDateShort(start)} to ${formatDateShort(end)}`,
    start,
    end,
    source,
    saved,
    createdAt: new Date().toISOString(),
    plannedCount: plannedTasks.length,
    achievedCount: uniqueTasks(achievedTasks).length,
    reviewedCount: uniqueTasks(reviewedTasks).length,
    openCount: openPlannedTasks.length,
    plannedTaskIds: plannedTasks.map((task) => task.id),
    achievedTaskIds: uniqueTasks(achievedTasks).map((task) => task.id),
    reviewedTaskIds: uniqueTasks(reviewedTasks).map((task) => task.id),
    openTaskIds: openPlannedTasks.map((task) => task.id),
    note: summaryNote(plannedTasks.length, uniqueTasks(achievedTasks).length, uniqueTasks(reviewedTasks).length, openPlannedTasks.length),
  };
}

function summaryNote(planned, achieved, reviewed, open) {
  if (!planned && !achieved && !reviewed) {
    return "No planned or achieved tasks were recorded for this period.";
  }

  if (open === 0 && planned > 0) {
    return "Everything planned for this period is now in Done or Reviewed.";
  }

  if (achieved > 0 || reviewed > 0) {
    return `${achieved + reviewed} achievement marker${achieved + reviewed === 1 ? "" : "s"} landed, with ${open} planned task${open === 1 ? "" : "s"} still open.`;
  }

  return `${open} planned task${open === 1 ? "" : "s"} still need attention.`;
}

function uniqueTasks(tasks) {
  const seen = new Set();
  return tasks.filter((task) => {
    if (seen.has(task.id)) {
      return false;
    }
    seen.add(task.id);
    return true;
  });
}

function timestampDateInRange(timestamp, start, end) {
  const date = toISODate(new Date(timestamp));
  return date >= start && date <= end;
}

function openSummary(type, id) {
  const summary = type === "daily" ? state.store.summaries.daily[id] : state.store.summaries.weekly[id];
  if (!summary) {
    return;
  }

  state.activeSummary = summary;
  elements.summaryDialogTitle.textContent = summary.title;
  elements.summaryDialogBody.innerHTML = renderSummaryDetail(summary);
  elements.summaryDialog.showModal();
}

function renderSummaryDetail(summary) {
  return `
    ${renderSummaryPreview(summary)}
    <h3>Planned</h3>
    ${renderTaskList(summary.plannedTaskIds)}
    <h3>Achieved</h3>
    ${renderTaskList(summary.achievedTaskIds)}
    <h3>Reviewed</h3>
    ${renderTaskList(summary.reviewedTaskIds)}
    <h3>Still Open</h3>
    ${renderTaskList(summary.openTaskIds)}
  `;
}

function renderTaskList(ids) {
  if (!ids || !ids.length) {
    return `<p>None</p>`;
  }

  return `<ul>${ids.map((id) => `<li>${escapeHTML(getTask(id)?.title || "Deleted task")}</li>`).join("")}</ul>`;
}

function downloadSummary(summary) {
  if (!summary) {
    return;
  }

  const markdown = summaryToMarkdown(summary);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${summary.id.replaceAll(":", "-")}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printSummary(summary) {
  if (!summary) {
    return;
  }

  elements.printArea.innerHTML = `
    <h1>${escapeHTML(summary.title)}</h1>
    ${renderSummaryDetail(summary)}
  `;
  window.print();
}

function summaryToMarkdown(summary) {
  return [
    `# ${summary.title}`,
    "",
    `Created: ${formatDateTime(summary.createdAt)}`,
    "",
    `- Planned: ${summary.plannedCount}`,
    `- Achieved: ${summary.achievedCount}`,
    `- Reviewed: ${summary.reviewedCount}`,
    `- Still open from plan: ${summary.openCount}`,
    "",
    summary.note,
    "",
    "## Planned",
    taskListMarkdown(summary.plannedTaskIds),
    "",
    "## Achieved",
    taskListMarkdown(summary.achievedTaskIds),
    "",
    "## Reviewed",
    taskListMarkdown(summary.reviewedTaskIds),
    "",
    "## Still Open",
    taskListMarkdown(summary.openTaskIds),
    "",
  ].join("\n");
}

function taskListMarkdown(ids) {
  if (!ids || !ids.length) {
    return "- None";
  }

  return ids.map((id) => {
    const task = getTask(id);
    if (!task) {
      return "- Deleted task";
    }
    const epic = getEpic(task.epicId)?.name || "No epic";
    return `- [${task.status}] ${task.title} (${epic})`;
  }).join("\n");
}

function getFriendlyError(error) {
  if (error.status === 401) {
    return "GitHub rejected the token. Check that it has repo Contents read/write access.";
  }
  if (error.status === 403) {
    return "GitHub blocked the request. The token may need access to this repo.";
  }
  if (error.status === 404) {
    return "GitHub could not find that repo, branch, or data file.";
  }
  return error.details?.message || error.message || "Something went wrong.";
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(base64) {
  const clean = base64.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeURIComponentPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(isoDate, days) {
  const date = parseISODate(isoDate);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function weekStartISO(isoDate) {
  const date = parseISODate(isoDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toISODate(date);
}

function weekEndISO(start) {
  return addDays(start, 6);
}

function weekId(start) {
  return `${start}_to_${weekEndISO(start)}`;
}

function isSameLocalDate(timestamp, isoDate) {
  if (!timestamp) {
    return false;
  }

  return toISODate(new Date(timestamp)) === isoDate;
}

function formatDateShort(isoDate) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parseISODate(isoDate));
}

function formatDateLong(isoDate) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseISODate(isoDate));
}

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function hexToSoftBackground(hex) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return "rgba(73, 182, 255, 0.16)";
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.16)`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 3600);
}
