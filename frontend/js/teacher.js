const user = FSL.requireAuth("teacher");
if (!user) throw new Error("redirect");
FSL.renderNavbar(user);
document.getElementById("teacher-name").textContent = user.full_name?.split(" ")[0] || user.username;

let classrooms = [];
let selectedClassroomId = null;
let hands = null;
let camera = null;
let recognizing = false;
let lastSend = 0;
const SEND_INTERVAL_MS = 350;

// Tactile click animations
document.querySelectorAll('.btn-tactile').forEach(button => {
  button.addEventListener('mousedown', () => button.classList.add('scale-95'));
  button.addEventListener('mouseup', () => button.classList.remove('scale-95'));
  button.addEventListener('mouseleave', () => button.classList.remove('scale-95'));
});

async function loadOverview() {
  classrooms = await FSL.api("/classrooms/mine");
  const grid = document.getElementById("overview-classrooms");
  grid.innerHTML = "";
  if (!classrooms.length) {
    grid.innerHTML = `
      <div class="bg-surface-container-lowest p-6 rounded-xl border border-dashed border-outline-variant text-center col-span-full py-12 animate-[fade-in_0.5s]">
        <span class="material-symbols-outlined text-4xl text-outline mb-2">meeting_room</span>
        <p class="text-on-surface-variant text-sm mb-3">No classrooms set up yet.</p>
        <button class="btn-tactile px-5 py-2.5 bg-primary text-on-primary rounded-full font-label-md text-white font-bold" onclick="openCreateModal()">Create classroom</button>
      </div>`;
  }
  for (const c of classrooms) {
    const students = await FSL.api(`/classrooms/${c.id}/students`).catch(() => []);
    const firstFew = students.slice(0, 3);
    const remainingCount = students.length - firstFew.length;
    
    const card = document.createElement("div");
    card.className = "bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between";
    card.innerHTML = `
      <div>
        <div class="flex justify-between items-start mb-4">
          <div class="p-3 bg-primary-fixed text-primary rounded-xl">
            <span class="material-symbols-outlined">history_edu</span>
          </div>
          <div class="relative inline-block text-left">
            <button class="text-on-surface-variant hover:text-primary p-1 rounded-full hover:bg-surface-container" onclick="toggleCardDropdown(event)">
              <span class="material-symbols-outlined">more_vert</span>
            </button>
            <div class="card-dropdown hidden absolute right-0 mt-2 w-48 rounded-xl shadow-lg bg-surface-container-lowest border border-outline-variant ring-1 ring-black ring-opacity-5 z-30">
              <div class="py-1" role="menu">
                <button class="flex items-center gap-2 w-full text-left px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container font-semibold transition-colors" onclick="event.stopPropagation(); viewClassroom(${c.id})">
                  <span class="material-symbols-outlined text-sm">school</span> View Roster
                </button>
                <button class="flex items-center gap-2 w-full text-left px-4 py-2.5 text-xs text-on-surface hover:bg-surface-container font-semibold transition-colors" onclick="event.stopPropagation(); openEditModal(${c.id})">
                  <span class="material-symbols-outlined text-sm">edit</span> Edit Details
                </button>
                <button class="flex items-center gap-2 w-full text-left px-4 py-2.5 text-xs text-error hover:bg-error-container/30 font-semibold transition-colors" onclick="event.stopPropagation(); confirmDeleteClassroom(${c.id})">
                  <span class="material-symbols-outlined text-sm text-error">delete</span> Delete Classroom
                </button>
              </div>
            </div>
          </div>
        </div>
        <h3 class="font-headline-md text-headline-md mb-1">${escapeHtml(c.name)}</h3>
        <div class="flex items-center gap-2 mb-6 flex-wrap">
          <span class="px-3 py-1 bg-surface-container text-primary font-label-sm rounded-full">Code: ${c.code}</span>
          <span class="text-label-sm text-on-surface-variant flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">group</span>
            ${students.length} Student${students.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div class="flex items-center justify-between pt-4 border-t border-outline-variant">
        <div class="flex -space-x-2 overflow-hidden">
          ${firstFew.map(s => `
            <div class="w-8 h-8 rounded-full border-2 border-white bg-primary-fixed flex items-center justify-center text-[10px] font-bold text-primary font-quicksand uppercase">
              ${s.avatar || s.full_name?.charAt(0) || "?"}
            </div>
          `).join("")}
          ${remainingCount > 0 ? `
            <div class="w-8 h-8 rounded-full border-2 border-white bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface-variant">+${remainingCount}</div>
          ` : ""}
          ${students.length === 0 ? `<span class="text-[11px] text-on-surface-variant font-medium">Empty roster</span>` : ""}
        </div>
        <button class="text-primary font-label-md flex items-center gap-1 hover:underline text-xs font-bold" onclick="viewClassroom(${c.id})">
          Details
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>`;
    grid.appendChild(card);
  }

  // Populate filters & classroom page list
  const listGrid = document.getElementById("classrooms-list");
  if (listGrid) {
    listGrid.innerHTML = grid.innerHTML + `
      <div class="bg-background border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-md cursor-pointer hover:bg-surface-container transition-colors group py-8" onclick="openCreateModal()">
        <div class="w-12 h-12 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center text-outline group-hover:scale-110 transition-transform">
          <span class="material-symbols-outlined">add</span>
        </div>
        <p class="mt-4 font-label-md text-on-surface-variant text-xs font-bold">Create classroom</p>
      </div>
    `;
  }
  
  const sel = document.getElementById("classroom-select");
  sel.innerHTML = `<option value="">Select classroom…</option>` + classrooms.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  if (selectedClassroomId) sel.value = selectedClassroomId;
}

function viewClassroom(id) {
  selectedClassroomId = id;
  const sel = document.getElementById("classroom-select");
  if (sel) sel.value = id;
  showView("students");
  loadClassroomRoster(id);
}

async function loadStudents() {
  const id = document.getElementById("classroom-select").value;
  const tbody = document.getElementById("students-tbody");
  if (!id) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-on-surface-variant font-medium">Select a classroom from the top-right filter to load rosters.</td></tr>`;
    return;
  }
  selectedClassroomId = +id;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8"><div class="spinner mx-auto"></div></td></tr>`;
  try {
    const students = await FSL.api(`/classrooms/${id}/students`);
    if (!students.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-on-surface-variant font-medium">No students enrolled yet. Share the code with them!</td></tr>`;
      return;
    }
    let modules = [];
    try { modules = await FSL.api("/modules"); } catch (_) {}
    const lessonMap = {};
    for (const m of modules) {
      try {
        const ls = await FSL.api("/lessons?module=" + m.id);
        lessonMap[m.id] = { title: m.title, ids: ls.map((l) => l.id) };
      } catch (_) {
        lessonMap[m.id] = { title: m.id, ids: [] };
      }
    }
    tbody.innerHTML = students.map((s) => {
      const p = s.progress || {};
      const completed = new Set(p.completed_lessons || []);
      const bars = Object.keys(lessonMap).map((mid) => {
        const info = lessonMap[mid];
        const done = info.ids.filter((id) => completed.has(id)).length;
        const pct = info.ids.length ? Math.round((done / info.ids.length) * 100) : 0;
        return `<div class="flex items-center gap-2 mb-1 min-w-[150px]">
          <span class="text-[10px] text-on-surface-variant w-14 truncate font-semibold">${info.title}</span>
          <div class="flex-1 bg-surface-container h-1.5 rounded-full overflow-hidden border border-outline-variant/30">
            <div class="h-full rounded-full transition-all duration-300" style="width:${pct}%;background:${FSL.progressColor(pct)}"></div>
          </div>
          <span class="text-[9px] font-bold text-on-surface-variant w-6 text-right">${pct}%</span>
        </div>`;
      }).join("");
      return `<tr class="hover:bg-surface-container-low transition-colors">
        <td class="px-md py-4 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center font-bold text-secondary text-xs font-quicksand uppercase">
            ${s.avatar || s.full_name?.charAt(0) || "?"}
          </div>
          <span class="font-body-md font-semibold text-xs">${escapeHtml(s.full_name)}</span>
        </td>
        <td class="px-md py-4 text-on-surface-variant text-xs">@${escapeHtml(s.username)}</td>
        <td class="px-md py-4 text-xs" colspan="2">${bars || "—"}</td>
        <td class="px-md py-4 text-on-surface-variant text-xs font-semibold">${FSL.formatDate(p.last_activity)}</td>
        <td class="px-md py-4">
          <div class="flex items-center gap-1">
            <button class="btn-edit-student p-1.5 rounded-lg hover:bg-primary-fixed text-primary transition-colors"
              data-sid="${s.id}" data-cid="${selectedClassroomId}"
              data-name="${escapeHtml(s.full_name)}" data-username="${escapeHtml(s.username)}" data-email="${escapeHtml(s.email || '')}"
              title="Edit student">
              <span class="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button class="btn-delete-student p-1.5 rounded-lg hover:bg-error-container text-error transition-colors"
              data-sid="${s.id}" data-cid="${selectedClassroomId}" data-name="${escapeHtml(s.full_name)}"
              title="Remove student">
              <span class="material-symbols-outlined text-[16px]">person_remove</span>
            </button>
          </div>
        </td>
      </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-error font-semibold">${e.message}</td></tr>`;
  }
}

async function loadContent() {
  const box = document.getElementById("content-modules");
  if (!box) return;
  box.innerHTML = `<div class="text-on-surface-variant text-xs py-4">Loading library modules…</div>`;
  try {
    const modules = await FSL.api("/modules");
    if (!modules || !modules.length) {
      box.innerHTML = `<p class="text-on-surface-variant text-xs">No library modules available.</p>`;
      return;
    }
    box.innerHTML = modules.map((m) => `
      <div class="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl hover:-translate-y-1 transition-all cursor-pointer shadow-sm flex flex-col justify-between" onclick="showModuleLessons('${m.id}')">
        <div>
          <div class="w-12 h-12 rounded-xl bg-surface-container text-primary flex items-center justify-center text-2xl mb-3 border border-outline-variant/40">${m.icon || "📚"}</div>
          <h3 class="font-quicksand font-bold text-base text-primary mb-1">${m.title}</h3>
          <p class="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">${m.description || ""}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between text-xs text-text-muted font-bold">
          <span>${m.total_lessons || 0} lessons</span>
          <span class="px-2 py-0.5 bg-surface-container text-[10px] uppercase rounded border border-outline-variant/30">${m.subtitle || m.id}</span>
        </div>
      </div>`).join("");
  } catch (e) {
    box.innerHTML = `<p class="text-error font-semibold">Could not load library: ${e.message}</p>`;
  }
}

async function showModuleLessons(moduleId) {
  const lessons = await FSL.api(`/lessons?module=${moduleId}`);
  document.getElementById("content-lessons").innerHTML = `
    <h2 class="font-quicksand font-bold text-lg text-primary mb-4 mt-6">${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)} Lessons</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${lessons.map((l) => `
        <div class="bg-surface-container-lowest border border-outline-variant p-5 rounded-2xl flex flex-col justify-between shadow-sm">
          <div>
            <span class="inline-block px-2.5 py-0.5 bg-surface-container text-primary font-bold text-xs uppercase rounded border border-outline-variant/40">${l.sign || l.title}</span>
            <h4 class="font-quicksand font-bold text-base text-on-surface mt-3 mb-1">${escapeHtml(l.title)}</h4>
            <p class="text-xs text-on-surface-variant leading-relaxed line-clamp-3">${escapeHtml(l.description)}</p>
          </div>
          <div class="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant font-semibold">
            <span>~${l.estimated_minutes} min</span>
            <span>Diff: ${l.difficulty}/3</span>
          </div>
        </div>`).join("")}
    </div>`;
  document.getElementById("content-lessons").scrollIntoView({ behavior: "smooth", block: "start" });
}

function setRecogStatus(text, cls) {
  const el = document.getElementById("recog-status");
  el.textContent = text;
  el.className = "recog-status mb-4 inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container border border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase rounded-full" + (cls ? " " + cls : "");
}

async function startRecognition() {
  if (recognizing) return;
  const video = document.getElementById("input-video");
  const placeholder = document.getElementById("cam-placeholder");
  setRecogStatus("Starting camera…");
  document.getElementById("btn-start-cam").disabled = true;
  try {
    hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
    hands.onResults(onHandResults);
    camera = new Camera(video, {
      onFrame: async () => { if (hands && recognizing) await hands.send({ image: video }); },
      width: 640, height: 480,
    });
    await camera.start();
    recognizing = true;
    placeholder.style.display = "none";
    document.getElementById("btn-stop-cam").disabled = false;
    setRecogStatus("● Live", "text-secondary border-secondary/40 bg-secondary-container/40");
    FSL.toast("Camera started — show a fingerspelling letter");
  } catch (err) {
    console.error(err);
    setRecogStatus("Camera error", "text-error border-error/45 bg-error-container");
    document.getElementById("btn-start-cam").disabled = false;
    FSL.toast("Could not access camera: " + err.message, "error");
  }
}

function stopRecognition() {
  recognizing = false;
  if (camera) { try { camera.stop(); } catch (_) {} camera = null; }
  hands = null;
  const video = document.getElementById("input-video");
  if (video.srcObject) { video.srcObject.getTracks().forEach((t) => t.stop()); video.srcObject = null; }
  document.getElementById("cam-placeholder").style.display = "flex";
  document.getElementById("btn-start-cam").disabled = false;
  document.getElementById("btn-stop-cam").disabled = true;
  setRecogStatus("Stopped");
  document.getElementById("recog-letter").textContent = "—";
  document.getElementById("recog-conf").textContent = "Confidence: —";
  document.getElementById("recog-bar-fill").style.width = "0%";
  document.getElementById("recog-top").innerHTML = "";
}

function onHandResults(results) {
  const canvas = document.getElementById("output-canvas");
  const video = document.getElementById("input-video");
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    if (typeof drawConnectors === "function") {
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: "rgba(0, 74, 198, 0.7)", lineWidth: 3 });
      drawLandmarks(ctx, landmarks, { color: "#0053db", lineWidth: 1, radius: 4 });
    }
    const now = Date.now();
    if (now - lastSend >= SEND_INTERVAL_MS) {
      lastSend = now;
      const flat = [];
      for (const lm of landmarks) flat.push(lm.x, lm.y, lm.z);
      sendLandmarks(flat);
    }
  } else {
    document.getElementById("recog-letter").textContent = "—";
    document.getElementById("recog-conf").textContent = "No hand detected";
    document.getElementById("recog-bar-fill").style.width = "0%";
  }
  ctx.restore();
}

async function sendLandmarks(flat) {
  try {
    const res = await FSL.api("/recognize", { method: "POST", body: { landmarks: flat } });
    document.getElementById("recog-letter").textContent = res.letter || "?";
    const confPct = Math.round((res.confidence || 0) * 100);
    document.getElementById("recog-conf").textContent = "Confidence: " + confPct + "%";
    document.getElementById("recog-bar-fill").style.width = confPct + "%";
    if (res.top && res.top.length) {
      document.getElementById("recog-top").innerHTML =
        '<div class="text-[11px] font-bold text-on-surface-variant mb-2 text-left uppercase tracking-wider font-quicksand">Top predictions</div>' +
        res.top.map((t) => `<div class="flex justify-between py-1 border-b border-outline-variant/35 text-xs text-on-surface-variant font-medium"><span><strong>${t.letter}</strong></span><span>${Math.round(t.confidence * 100)}%</span></div>`).join("");
    }
  } catch (e) { console.warn("recognize error", e); }
}

function loadProfile() {
  const u = FSL.user || {};
  const n = document.getElementById("prof-name");
  const un = document.getElementById("prof-user");
  const em = document.getElementById("prof-email");
  if (n) n.value = u.full_name || "";
  if (un) un.value = u.username || "";
  if (em) em.value = u.email || "";
}
function saveProfile() { FSL.toast("Profile settings saved! 💾", "success"); }

function logout() {
  if (typeof recognizing !== "undefined" && recognizing) stopRecognition();
  FSL.logout();
}

function showView(name, el) {
  if (name !== "recognize" && recognizing) stopRecognition();

  // Show/hide view content panels
  ["content", "profile", "overview", "students", "recognize"].forEach((v) => {
    const pane = document.getElementById("view-" + v);
    if (pane) pane.classList.toggle("hidden", v !== name);
  });

  // Update desktop sidebar button highlights
  document.querySelectorAll(".sidebar-nav-item").forEach((btn) => {
    const matches = btn.getAttribute("data-view") === name;
    const icon = btn.querySelector(".material-symbols-outlined");
    if (matches) {
      btn.className = "sidebar-nav-item flex items-center gap-3 bg-primary-container text-on-primary-container rounded-xl px-4 py-3 mx-2 transition-all active translate-y-0.5";
      if (icon) icon.classList.add("filled-icon");
    } else {
      btn.className = "sidebar-nav-item flex items-center gap-3 text-on-surface-variant px-4 py-3 mx-2 hover:bg-surface-variant rounded-xl transition-all";
      if (icon) icon.classList.remove("filled-icon");
    }
  });

  // Update mobile bottom nav highlights
  document.querySelectorAll(".bottom-nav-item").forEach((btn) => {
    const matches = btn.getAttribute("data-view") === name;
    const icon = btn.querySelector(".material-symbols-outlined");
    if (matches) {
      btn.className = "bottom-nav-item flex flex-col items-center gap-1 text-primary active";
      if (icon) icon.classList.add("filled-icon");
    } else {
      btn.className = "bottom-nav-item flex flex-col items-center gap-1 text-on-surface-variant";
      if (icon) icon.classList.remove("filled-icon");
    }
  });

  if (name === "content") loadContent();
  if (name === "profile") loadProfile();
  if (name === "students" && selectedClassroomId) {
    loadStudents();
    loadClassroomRoster(selectedClassroomId);
  }
}

function regenStudentCreds() {
  const u = "stu" + Math.random().toString(36).slice(2, 8);
  const p = Math.random().toString(36).slice(-10);
  const ue = document.getElementById("stu-user");
  const pe = document.getElementById("stu-pass");
  if (ue) ue.value = u;
  if (pe) pe.value = p;
}
function openAddStudentModal() {
  regenStudentCreds();
  const sel = document.getElementById("classroom-select");
  const cid = selectedClassroomId || (sel ? +sel.value : null);
  if (!cid) { FSL.toast("Select a classroom first", "error"); return; }
  document.getElementById("created-creds").classList.add("hidden");
  const m = document.getElementById("modal-add-student");
  m.classList.remove("hidden"); m.style.display = "grid";
}
function closeAddStudentModal() {
  const m = document.getElementById("modal-add-student");
  m.classList.add("hidden"); m.style.display = "none";
}
async function createStudent(e) {
  e.preventDefault();
  const sel = document.getElementById("classroom-select");
  const cid = selectedClassroomId || (sel ? +sel.value : null);
  if (!cid) { FSL.toast("Select a classroom first", "error"); return; }
  const fd = new FormData(e.target);
  try {
    const res = await FSL.api(`/classrooms/${cid}/students`, {
      method: "POST",
      body: {
        full_name: fd.get("full_name"),
        username: fd.get("username"),
        password: fd.get("password"),
        email: fd.get("email") || null,
      },
    });
    const box = document.getElementById("created-creds");
    box.classList.remove("hidden");
    box.innerHTML = `<strong>Account Created! Share these details:</strong><br>
      Username: <code class="bg-surface-container px-1 py-0.5 rounded text-primary">${res.credentials.username}</code><br>
      Password: <code class="bg-surface-container px-1 py-0.5 rounded text-primary">${res.credentials.password}</code>`;
    FSL.toast("Student created and enrolled successfully");
    e.target.reset();
    loadStudents();
    loadClassroomRoster(cid);
  } catch (err) { FSL.toast(err.message, "error"); }
}

function openCreateModal() {
  const m = document.getElementById("modal-create");
  m.classList.remove("hidden");
  m.style.display = "grid";
}
function closeCreateModal() {
  const m = document.getElementById("modal-create");
  m.classList.add("hidden");
  m.style.display = "none";
}

async function createClassroom(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const c = await FSL.api("/classrooms", { method: "POST", body: { name: fd.get("name"), description: fd.get("description") } });
    FSL.toast("Classroom created! Code: " + c.code);
    closeCreateModal();
    e.target.reset();
    await loadOverview();
    showView("overview");
  } catch (err) { FSL.toast(err.message, "error"); }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toggleSidebar() {
  const nav = document.querySelector(".sidebar-nav");
  const main = document.querySelector("main");
  const isCollapsed = nav.classList.toggle("sidebar-collapsed");
  main.classList.toggle("main-expanded", isCollapsed);
  
  const icon = document.getElementById("toggle-sidebar-icon");
  if (icon) {
    icon.textContent = isCollapsed ? "chevron_right" : "chevron_left";
  }
  localStorage.setItem("sidebar-collapsed", isCollapsed ? "true" : "false");
}

// Initialize sidebar state on page load
(function() {
  if (localStorage.getItem("sidebar-collapsed") === "true") {
    const nav = document.querySelector(".sidebar-nav");
    const main = document.querySelector("main");
    if (nav && main) {
      nav.classList.add("sidebar-collapsed");
      main.classList.add("main-expanded");
      const icon = document.getElementById("toggle-sidebar-icon");
      if (icon) icon.textContent = "chevron_right";
    }
  }
})();

// Load Signy mascot in sidebar overview
(function() {
  const sidebar = document.querySelector(".sidebar-nav");
  if (sidebar) {
    const div = document.createElement("div");
    div.className = "px-4 mt-6 text-center border-t border-outline-variant/30 pt-4 sidebar-brand";
    div.innerHTML = `
      <div class="mb-2 bg-surface-container p-3 rounded-2xl border border-outline-variant/40 text-xs font-semibold text-on-surface-variant leading-relaxed">
        Let's help Pagadian students master sign language today!
      </div>
      ${FSL.getSignySVG("neutral")}
    `;
    sidebar.appendChild(div);
  }
})();

// Card Action Dropdowns
function toggleCardDropdown(event) {
  event.stopPropagation();
  const btn = event.currentTarget || event.target;
  const parent = btn.closest(".relative");
  if (!parent) return;
  const dropdown = parent.querySelector(".card-dropdown");
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains("hidden");
  // Close all other dropdowns
  document.querySelectorAll(".card-dropdown").forEach(d => d.classList.add("hidden"));
  if (isHidden) {
    dropdown.classList.remove("hidden");
  }
}

// Global click handler to close card dropdowns
document.addEventListener("click", () => {
  document.querySelectorAll(".card-dropdown").forEach(d => {
    d.classList.add("hidden");
  });
});

// Edit Classroom Modal Logic
function openEditModal(id) {
  const c = classrooms.find(x => x.id == id);
  if (!c) return;
  document.getElementById("edit-classroom-id").value = c.id;
  document.getElementById("edit-classroom-name").value = c.name;
  document.getElementById("edit-classroom-desc").value = c.description || "";
  const m = document.getElementById("modal-edit");
  m.classList.remove("hidden");
  m.style.display = "grid";
}

function closeEditModal() {
  const m = document.getElementById("modal-edit");
  m.classList.add("hidden");
  m.style.display = "none";
}

async function editClassroom(e) {
  e.preventDefault();
  const id = document.getElementById("edit-classroom-id").value;
  const name = document.getElementById("edit-classroom-name").value;
  const description = document.getElementById("edit-classroom-desc").value;
  try {
    await FSL.api(`/classrooms/${id}`, {
      method: "PUT",
      body: { name, description }
    });
    FSL.toast("Classroom updated successfully!");
    closeEditModal();
    await loadOverview();
    if (selectedClassroomId === +id) {
      loadClassroomRoster(selectedClassroomId);
    }
  } catch (err) {
    FSL.toast(err.message, "error");
  }
}

// Delete Classroom Modal Logic
function confirmDeleteClassroom(id) {
  const c = classrooms.find(x => x.id == id);
  if (!c) return;
  document.getElementById("delete-classroom-id").value = c.id;
  document.getElementById("delete-classroom-name-display").textContent = c.name;
  const m = document.getElementById("modal-delete");
  m.classList.remove("hidden");
  m.style.display = "grid";
}

function closeDeleteModal() {
  const m = document.getElementById("modal-delete");
  m.classList.add("hidden");
  m.style.display = "none";
}

async function deleteClassroomConfirm() {
  const id = document.getElementById("delete-classroom-id").value;
  try {
    await FSL.api(`/classrooms/${id}`, {
      method: "DELETE"
    });
    FSL.toast("Classroom deleted successfully!");
    closeDeleteModal();
    
    if (selectedClassroomId === +id) {
      selectedClassroomId = null;
      const sel = document.getElementById("classroom-select");
      if (sel) sel.value = "";
      loadStudents();
      loadClassroomRoster(null);
    }
    
    await loadOverview();
  } catch (err) {
    FSL.toast(err.message, "error");
  }
}

// Load Detailed Classroom Roster in view-students pane
async function loadClassroomRoster(id) {
  const section = document.getElementById("classroom-roster-section");
  const tbody = document.getElementById("classroom-students-tbody");
  if (!section || !tbody) return;

  if (!id) {
    section.classList.add("hidden");
    return;
  }
  
  const c = classrooms.find(x => x.id == id);
  if (c) {
    document.getElementById("roster-classroom-title").textContent = c.name + " Roster";
    document.getElementById("roster-classroom-code").textContent = "Code: " + c.code;
  }
  
  section.classList.remove("hidden");
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8"><div class="spinner mx-auto"></div></td></tr>`;
  
  try {
    const students = await FSL.api(`/classrooms/${id}/students`);
    if (!students.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-on-surface-variant font-medium">No students enrolled yet. Share the code with them!</td></tr>`;
      return;
    }
    let modules = [];
    try { modules = await FSL.api("/modules"); } catch (_) {}
    const lessonMap = {};
    for (const m of modules) {
      try {
        const ls = await FSL.api("/lessons?module=" + m.id);
        lessonMap[m.id] = { title: m.title, ids: ls.map((l) => l.id) };
      } catch (_) {
        lessonMap[m.id] = { title: m.id, ids: [] };
      }
    }
    tbody.innerHTML = students.map((s) => {
      const p = s.progress || {};
      const completed = new Set(p.completed_lessons || []);
      const bars = Object.keys(lessonMap).map((mid) => {
        const info = lessonMap[mid];
        const done = info.ids.filter((lid) => completed.has(lid)).length;
        const pct = info.ids.length ? Math.round((done / info.ids.length) * 100) : 0;
        return `<div class="flex items-center gap-2 mb-1 min-w-[150px]">
          <span class="text-[10px] text-on-surface-variant w-14 truncate font-semibold">${info.title}</span>
          <div class="flex-1 bg-surface-container h-1.5 rounded-full overflow-hidden border border-outline-variant/30">
            <div class="h-full rounded-full transition-all duration-300" style="width:${pct}%;background:${FSL.progressColor(pct)}"></div>
          </div>
          <span class="text-[9px] font-bold text-on-surface-variant w-6 text-right">${pct}%</span>
        </div>`;
      }).join("");
      return `<tr class="hover:bg-surface-container-low transition-colors">
        <td class="px-md py-4 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center font-bold text-secondary text-xs font-quicksand uppercase">
            ${s.avatar || s.full_name?.charAt(0) || "?"}
          </div>
          <span class="font-body-md font-semibold text-xs">${escapeHtml(s.full_name)}</span>
        </td>
        <td class="px-md py-4 text-on-surface-variant text-xs">@${escapeHtml(s.username)}</td>
        <td class="px-md py-4 text-xs" colspan="2">${bars || "—"}</td>
        <td class="px-md py-4 text-on-surface-variant text-xs font-semibold">${FSL.formatDate(p.last_activity)}</td>
        <td class="px-md py-4">
          <div class="flex items-center gap-1">
            <button class="btn-edit-student p-1.5 rounded-lg hover:bg-primary-fixed text-primary transition-colors"
              data-sid="${s.id}" data-cid="${id}"
              data-name="${escapeHtml(s.full_name)}" data-username="${escapeHtml(s.username)}" data-email="${escapeHtml(s.email || '')}"
              title="Edit student">
              <span class="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button class="btn-delete-student p-1.5 rounded-lg hover:bg-error-container text-error transition-colors"
              data-sid="${s.id}" data-cid="${id}" data-name="${escapeHtml(s.full_name)}"
              title="Remove student">
              <span class="material-symbols-outlined text-[16px]">person_remove</span>
            </button>
          </div>
        </td>
      </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-error font-semibold">${e.message}</td></tr>`;
  }
}

loadOverview();
loadContent();
showView('overview');

// ========== Event delegation for student action buttons ==========
document.addEventListener('click', function(e) {
  const editBtn = e.target.closest('.btn-edit-student');
  if (editBtn) {
    e.stopPropagation();
    openEditStudentModal(
      editBtn.dataset.sid,
      editBtn.dataset.cid,
      editBtn.dataset.name,
      editBtn.dataset.username,
      editBtn.dataset.email
    );
    return;
  }
  const delBtn = e.target.closest('.btn-delete-student');
  if (delBtn) {
    e.stopPropagation();
    confirmDeleteStudent(
      delBtn.dataset.sid,
      delBtn.dataset.cid,
      delBtn.dataset.name
    );
    return;
  }
});

// ========== Edit Student Modal ==========
function openEditStudentModal(studentId, classroomId, fullName, username, email) {
  document.getElementById("edit-student-id").value = studentId;
  document.getElementById("edit-student-classroom-id").value = classroomId;
  document.getElementById("edit-student-name").value = fullName;
  document.getElementById("edit-student-username").value = username;
  document.getElementById("edit-student-email").value = email || "";
  document.getElementById("edit-student-pass").value = "";
  const m = document.getElementById("modal-edit-student");
  m.classList.remove("hidden");
  m.style.display = "grid";
}

function closeEditStudentModal() {
  const m = document.getElementById("modal-edit-student");
  m.classList.add("hidden");
  m.style.display = "none";
}

async function saveStudentEdit(e) {
  e.preventDefault();
  const studentId = document.getElementById("edit-student-id").value;
  const classroomId = document.getElementById("edit-student-classroom-id").value;
  const full_name = document.getElementById("edit-student-name").value;
  const email = document.getElementById("edit-student-email").value;
  const password = document.getElementById("edit-student-pass").value;
  const body = { full_name, email: email || null };
  if (password) body.password = password;
  try {
    await FSL.api(`/classrooms/${classroomId}/students/${studentId}`, {
      method: "PUT",
      body,
    });
    FSL.toast("Student updated successfully! ✏️", "success");
    closeEditStudentModal();
    loadStudents();
    loadClassroomRoster(+classroomId);
  } catch (err) {
    FSL.toast(err.message, "error");
  }
}

// ========== Delete Student Modal ==========
function confirmDeleteStudent(studentId, classroomId, fullName) {
  document.getElementById("delete-student-id").value = studentId;
  document.getElementById("delete-student-classroom-id").value = classroomId;
  document.getElementById("delete-student-name-display").textContent = fullName;
  const m = document.getElementById("modal-delete-student");
  m.classList.remove("hidden");
  m.style.display = "grid";
}

function closeDeleteStudentModal() {
  const m = document.getElementById("modal-delete-student");
  m.classList.add("hidden");
  m.style.display = "none";
}

async function deleteStudentConfirm() {
  const studentId = document.getElementById("delete-student-id").value;
  const classroomId = document.getElementById("delete-student-classroom-id").value;
  try {
    await FSL.api(`/classrooms/${classroomId}/students/${studentId}`, {
      method: "DELETE",
    });
    FSL.toast("Student removed successfully.", "success");
    closeDeleteStudentModal();
    loadStudents();
    loadClassroomRoster(+classroomId);
  } catch (err) {
    FSL.toast(err.message, "error");
  }
}
