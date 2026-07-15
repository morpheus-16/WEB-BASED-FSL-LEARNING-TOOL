const user = FSL.requireAuth("student");
let classrooms = [];
let currentClassroomId = null;
let currentModule = null;
let moduleLessonList = [];
let completedSet = new Set();

// Camera & media variables
let hands = null;
let camera = null;
let recognizing = false;
let lastSend = 0;
const SEND_INTERVAL_MS = 300;
const HOLD_MS = 3000;
let holdStart = null;
let quizMode = null; // null | 'lesson' | 'module'
let quizTargetLetter = null;
let quizLessonId = null;
let moduleExamIndex = 0;
const ALPHA_LETTERS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

// Speech Bubble quotes for Signy
const SIGNY_QUOTES = {
  neutral: [
    "Welcome! Let's master Filipino Sign Language today!",
    "Practice makes perfect! Tap on a lesson node above to begin.",
    "Did you know? Sign language has its own grammar and syntax!",
    "Show your signs clearly in a well-lit area for the webcam!"
  ],
  happy: [
    "Yes! You got it! Signy is so proud of you! 🎉",
    "Spectacular job! That's correct!",
    "Incredible sign accuracy! Keep this streak going! ⭐",
    "Wow! You are becoming a true FSL master!"
  ],
  sad: [
    "Oh, so close! Let's try that shape one more time.",
    "No worries, mistakes help us learn! Try repositioning your hand.",
    "Don't give up! Signy is right here with you.",
    "Let's show the hand shape closer to the camera lens!"
  ]
};

if (user) {
  document.getElementById("student-name").textContent = (user.full_name || "Student").split(" ")[0];
  FSL.renderNavbar(user);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------- CONFETTI RENDER ENGINE ----------------
function triggerConfetti() {
  const colors = ["#ff5964", "#35a7ff", "#38b000", "#ffca3a", "#ff924c", "#9d4edd"];
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.pointerEvents = "none";
  container.style.zIndex = "99999";
  document.body.appendChild(container);

  for (let i = 0; i < 75; i++) {
    const p = document.createElement("div");
    p.className = "confetti-particle";
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = Math.random() * 100 + "vw";
    p.style.transform = `scale(${Math.random() * 0.7 + 0.4})`;
    p.style.animationDelay = Math.random() * 1.5 + "s";
    p.style.animationDuration = Math.random() * 2 + 1.5 + "s";
    container.appendChild(p);
  }

  setTimeout(() => container.remove(), 4500);
}

// ---------------- MASCOT CONTROLLER ----------------
function updateSigny(expression = "neutral") {
  const SpeechBubble = document.getElementById("mascot-speech");
  const Container = document.getElementById("sidebar-mascot-container");
  
  if (Container) {
    Container.innerHTML = FSL.getSignySVG(expression);
  }
  if (SpeechBubble) {
    const list = SIGNY_QUOTES[expression] || SIGNY_QUOTES.neutral;
    SpeechBubble.textContent = list[Math.floor(Math.random() * list.length)];
  }
}

// Initialize Signy in Sidebar on page load
(function initMascot() {
  const sidebar = document.querySelector(".sidebar-nav");
  if (sidebar) {
    const widget = document.createElement("div");
    widget.className = "px-4 mt-6 text-center border-t border-outline-variant/30 pt-4 sidebar-brand";
    widget.innerHTML = `
      <div class="mascot-bubble" id="mascot-speech">Let's learn fingerspelling! Complete lessons to see me happy!</div>
      <div id="sidebar-mascot-container" style="cursor:pointer;"></div>
    `;
    sidebar.appendChild(widget);
    
    // Tap mascot to trigger custom quotes
    widget.addEventListener("click", () => {
      updateSigny("neutral");
    });
  }
  setTimeout(() => updateSigny("neutral"), 100);
})();

// ---------------- NAVIGATION ----------------
function showView(name, el) {
  // Hide tooltips/trays on view switch
  hideDuoTooltip();
  hideFeedbackTray();

  ["home", "learn", "profile"].forEach((v) => {
    const n = document.getElementById("view-" + v);
    if (n) n.classList.toggle("hidden", v !== name);
  });
  
  document.querySelectorAll(".sidebar-nav button, .bottom-link").forEach((a) => {
    a.classList.remove("active");
  });
  
  document.querySelectorAll(`[data-view="${name}"]`).forEach((a) => {
    a.classList.add("active");
  });

  if (name === "home") loadHome();
  if (name === "learn") loadLearnModules();
  
  if (name === "profile") {
    const u = user || {};
    document.getElementById("prof-name").value = u.full_name || "";
    document.getElementById("prof-user").value = u.username || "";
    document.getElementById("prof-email").value = u.email || "";
  }
}

// ---------------- DATA UTILITIES ----------------
async function loadHome() {
  try { classrooms = await FSL.api("/classrooms/mine"); } catch { classrooms = []; }
  const grid = document.getElementById("my-classrooms");
  if (!classrooms.length) {
    grid.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center col-span-full"><p class="text-on-surface-variant text-sm">You are not added in a classroom yet. Please contact your teacher.</p></div>`;
  } else {
    let modules = [];
    try { modules = await FSL.api("/modules"); } catch (_) {}
    const cards = [];
    for (const c of classrooms) {
      let completed = new Set();
      try {
        const prog = await FSL.api("/progress?classroom_id=" + c.id);
        const p = Array.isArray(prog) ? prog[0] : prog;
        completed = new Set(p && p.completed_lessons ? p.completed_lessons : []);
      } catch (_) {}
      const levels = [];
      for (const m of modules) {
        let lessons = [];
        try { lessons = await FSL.api("/lessons?module=" + m.id); } catch (_) {}
        const ids = lessons.map((l) => l.id);
        const done = ids.filter((id) => completed.has(id)).length;
        const pct = ids.length ? Math.round((done / ids.length) * 100) : 0;
        levels.push(`<div class="mt-3">
          <div class="flex justify-between text-xs font-bold text-on-surface-variant">
            <span>${escapeHtml(m.title)}</span><span>${pct}%</span>
          </div>
          <div class="w-full bg-surface-2 h-2.5 rounded-full overflow-hidden border border-outline-variant/35 mt-1">
            <div class="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-300" style="width:${pct}%"></div>
          </div>
          <div class="text-[10px] text-text-muted mt-0.5 font-semibold">${done}/${ids.length} signs mastered</div>
        </div>`);
      }
      cards.push(`<div class="glass-card rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <h3 class="font-quicksand font-bold text-base text-primary">${escapeHtml(c.name)}</h3>
          <p class="text-xs text-on-surface-variant">${escapeHtml(c.description || "")}</p>
          <p class="text-xs text-on-surface mt-2"><span class="text-text-muted">Teacher:</span> <strong>${escapeHtml(c.teacher_name || "—")}</strong></p>
          <span class="inline-flex items-center px-2 py-0.5 bg-tertiary-fixed text-[11px] font-bold text-on-tertiary-fixed rounded-md mt-2">🔑 ${escapeHtml(c.code || "")}</span>
        </div>
        <hr class="my-4 border-outline-variant/30" />
        <div class="space-y-1">
          <strong class="text-xs text-on-surface font-quicksand font-bold">My level progress</strong>
          ${levels.join("") || "<p class='text-xs text-text-muted'>No learning paths loaded</p>"}
        </div>
      </div>`);
    }
    grid.innerHTML = cards.join("");
  }
  const sel = document.getElementById("learn-classroom");
  if (sel) {
    sel.innerHTML = classrooms.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")
      || `<option value="">No classrooms</option>`;
    if (classrooms.length && !currentClassroomId) {
      currentClassroomId = classrooms[0].id;
      sel.value = currentClassroomId;
    }
  }
}

function onClassroomChange() {
  const v = document.getElementById("learn-classroom").value;
  currentClassroomId = v ? +v : null;
}

async function refreshCompleted() {
  completedSet = new Set();
  if (!currentClassroomId) return;
  try {
    const prog = await FSL.api("/progress?classroom_id=" + currentClassroomId);
    const p = Array.isArray(prog) ? prog[0] : prog;
    completedSet = new Set(p && p.completed_lessons ? p.completed_lessons : []);
  } catch (_) {}
}

async function loadLearnModules() {
  const box = document.getElementById("learn-modules");
  box.innerHTML = `<p class="text-muted">Loading modules…</p>`;
  try {
    const modules = await FSL.api("/modules");
    box.innerHTML = (modules || []).map((m) => `
      <div class="glass-card rounded-2xl p-5 hover:-translate-y-1 hover:shadow-lg transition-all cursor-pointer border border-outline-variant/30 flex flex-col justify-between" onclick="openModule('${m.id}')">
        <div>
          <div class="w-12 h-12 rounded-xl bg-surface-container text-primary flex items-center justify-center text-2xl mb-3 border border-outline-variant/40">${m.icon || "📚"}</div>
          <h3 class="font-quicksand font-bold text-base text-primary mb-1">${escapeHtml(m.title)}</h3>
          <p class="text-xs text-on-surface-variant line-clamp-3">${escapeHtml(m.description || "")}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-outline-variant/30 flex items-center justify-between text-xs text-text-muted font-bold">
          <span>${m.total_lessons || 0} lessons</span>
          <span class="px-2 py-0.5 bg-surface-container text-[10px] uppercase rounded border border-outline-variant/30">${escapeHtml(m.subtitle || m.id)}</span>
        </div>
      </div>`).join("") || `<p class="text-sm text-on-surface-variant">No learning levels available</p>`;
    document.getElementById("learn-lessons").innerHTML = "";
    document.getElementById("lesson-detail").classList.add("hidden");
    document.getElementById("module-quiz-area").innerHTML = "";
    stopRecognition(true);
  } catch (e) {
    box.innerHTML = `<p style="color:var(--danger)">${escapeHtml(e.message)}</p>`;
  }
}

// ---------------- DUOLINGO SNAKE PATH GENERATOR ----------------
async function openModule(moduleId) {
  currentModule = moduleId;
  stopRecognition(true);
  quizMode = null;
  await refreshCompleted();
  
  const lessons = await FSL.api("/lessons?module=" + moduleId);
  moduleLessonList = lessons.slice().sort((a, b) => (a.order || a.id) - (b.order || b.id));
  
  const title = moduleId.charAt(0).toUpperCase() + moduleId.slice(1);
  const isAlpha = moduleId === "alphabet";
  
  // Find current first uncompleted lesson to show as active node
  let activeIndex = moduleLessonList.findIndex(l => !completedSet.has(l.id));
  if (activeIndex === -1 && moduleLessonList.length > 0) {
    // All completed
    activeIndex = moduleLessonList.length; 
  }

  // Winding snake horizontal class patterns
  const shiftPatterns = ["shift-none", "shift-right-1", "shift-right-2", "shift-right-1", "shift-none", "shift-left-1", "shift-left-2", "shift-left-1"];

  // Generate learning nodes
  const nodesHtml = moduleLessonList.map((l, idx) => {
    const isCompleted = completedSet.has(l.id);
    const isActive = idx === activeIndex;
    const isLocked = idx > activeIndex;
    
    let nodeClass = "duo-node-locked";
    let icon = "lock";
    if (isCompleted) {
      nodeClass = "duo-node-completed";
      icon = "check";
    } else if (isActive) {
      nodeClass = "duo-node-active";
      icon = l.sign || "play_arrow";
    }

    const shift = shiftPatterns[idx % shiftPatterns.length];

    return `
      <div class="duo-node ${nodeClass} ${shift}" data-idx="${idx}" data-id="${l.id}">
        <span class="material-symbols-outlined text-3xl font-bold">${icon}</span>
      </div>
    `;
  }).join("");

  const allDone = moduleLessonList.length > 0 && activeIndex === moduleLessonList.length;

  document.getElementById("learn-lessons").innerHTML = `
    <div class="flex items-center gap-3 mt-6 mb-2">
      <button class="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center border border-outline-variant/40" onclick="loadLearnModules()">
        <span class="material-symbols-outlined font-bold">arrow_back</span>
      </button>
      <div>
        <h2 class="font-quicksand font-bold text-xl text-primary">${title} Path</h2>
        <p class="text-xs text-on-surface-variant">Master the path nodes. Challenge the level exam at the end!</p>
      </div>
    </div>

    <!-- Winding Path Area -->
    <div class="duo-path-container relative mt-8">
      <!-- Connection SVGs line background -->
      <svg class="duo-svg-path" id="duo-svg-path" viewBox="0 0 400 ${moduleLessonList.length * 110}">
        <path id="duo-line-path" d="" fill="none" stroke="#e5eefd" stroke-dasharray="8 6" stroke-width="6" stroke-linecap="round"/>
      </svg>
      
      ${nodesHtml}
      
      <!-- Duolingo Tooltip -->
      <div id="duo-tooltip" class="duo-tooltip"></div>
    </div>

    <!-- Level challenge footer -->
    <div class="glass-card rounded-2xl p-6 mt-8 border border-outline-variant/35 flex flex-col items-center justify-center text-center max-w-md mx-auto relative z-10" id="module-exam-card">
      <span class="material-symbols-outlined text-4xl text-primary mb-2">military_tech</span>
      <h3 class="font-quicksand font-bold text-lg text-primary mb-1">Level Challenge</h3>
      <p class="text-xs text-on-surface-variant max-w-sm mb-4">
        ${allDone 
          ? "Amazing! You mastered the entire track. Prove your sign skills in the webcam Level Challenge!"
          : "Unlock the Level Challenge by completing all winding path nodes above."}
      </p>
      <button class="btn-3d bg-primary text-white font-semibold text-xs py-3 px-8 rounded-xl uppercase tracking-wider ${allDone ? "" : "opacity-50 cursor-not-allowed"}" type="button" id="btn-module-exam" ${allDone ? "" : "disabled"}>
        ${isAlpha ? "Start Live Alphabet Quiz" : "Start Level Quiz"}
      </button>
    </div>
  `;

  document.getElementById("lesson-detail").classList.add("hidden");
  document.getElementById("module-quiz-area").innerHTML = "";

  // Wire up winding path node clicks
  document.querySelectorAll(".duo-node").forEach(node => {
    node.addEventListener("click", (e) => {
      const idx = +node.dataset.idx;
      const lesson = moduleLessonList[idx];
      const isLocked = idx > activeIndex;
      
      if (isLocked) {
        FSL.toast("This lesson is locked. Complete previous nodes!", "error");
        updateSigny("sad");
        return;
      }
      showDuoTooltip(node, lesson, completedSet.has(lesson.id) ? "completed" : "active");
    });
  });

  const examBtn = document.getElementById("btn-module-exam");
  if (examBtn && allDone) {
    examBtn.onclick = () => startModuleExam(moduleId);
  }

  // Draw connecting SVG line between node positions
  setTimeout(drawConnectingLine, 100);
}

// ---------------- DRAWS THE WINDING CONNECTION LINE ----------------
function drawConnectingLine() {
  const container = document.querySelector(".duo-path-container");
  const svg = document.getElementById("duo-svg-path");
  const pathEl = document.getElementById("duo-line-path");
  const nodes = document.querySelectorAll(".duo-node");
  
  if (!container || !svg || !pathEl || !nodes.length) return;
  
  const containerRect = container.getBoundingClientRect();
  let points = [];
  
  nodes.forEach(node => {
    const rect = node.getBoundingClientRect();
    const cx = (rect.left + rect.right) / 2 - containerRect.left;
    const cy = (rect.top + rect.bottom) / 2 - containerRect.top;
    points.push({ x: cx, y: cy });
  });

  if (points.length < 2) return;

  // Generate SVG path string with smooth bezier control curves
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i+1];
    const cpY1 = p0.y + 40;
    const cpY2 = p1.y - 40;
    d += ` C ${p0.x} ${cpY1}, ${p1.x} ${cpY2}, ${p1.x} ${p1.y}`;
  }
  
  pathEl.setAttribute("d", d);
}

// Recalculate curve line on screen resize
window.addEventListener("resize", () => {
  drawConnectingLine();
  hideDuoTooltip();
});

// ---------------- DUOLINGO TOOLTIP POPOVER ----------------
function showDuoTooltip(nodeEl, lesson, status) {
  const tooltip = document.getElementById("duo-tooltip");
  if (!tooltip) return;

  const nodeRect = nodeEl.getBoundingClientRect();
  const parentRect = nodeEl.offsetParent.getBoundingClientRect();
  
  // Set display block first to get accurate offsetWidth if needed
  tooltip.style.display = "block";
  const tooltipWidth = tooltip.offsetWidth || 260;
  
  // Calculate center offsets relative to the parent container
  const left = nodeRect.left - parentRect.left + (nodeRect.width / 2) - (tooltipWidth / 2);
  const top = nodeRect.bottom - parentRect.top + 12;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  
  const subtitle = status === "completed" ? "✓ Mastered (+10 XP)" : "Start Practice (+10 XP)";
  const btnText = status === "completed" ? "Practice Again" : "Start Lesson";

  tooltip.innerHTML = `
    <div class="text-[10px] uppercase font-bold text-primary tracking-wider mb-1">${subtitle}</div>
    <h4 class="font-quicksand font-bold text-sm text-on-surface mb-2">${escapeHtml(lesson.title)}</h4>
    <p class="text-[11px] text-on-surface-variant mb-4 leading-relaxed">${escapeHtml(lesson.description || "Learn FSL fingerspelling shapes.")}</p>
    <button class="feedback-btn feedback-btn-correct w-full text-xs py-2" id="tooltip-start-btn">${btnText}</button>
  `;

  document.getElementById("tooltip-start-btn").onclick = () => {
    hideDuoTooltip();
    openLesson(lesson.id);
  };

  // Close tooltip when clicking outside
  const closeHandler = (event) => {
    if (!tooltip.contains(event.target) && !nodeEl.contains(event.target)) {
      hideDuoTooltip();
      document.removeEventListener("click", closeHandler);
    }
  };
  
  // Delay slightly to prevent immediate auto-closing from same click event
  setTimeout(() => {
    document.addEventListener("click", closeHandler);
  }, 50);
}

function hideDuoTooltip() {
  const tooltip = document.getElementById("duo-tooltip");
  if (tooltip) tooltip.style.display = "none";
}

// ---------------- OPEN LESSON PANELS ----------------
async function openLesson(lessonId) {
  stopRecognition(true);
  quizMode = null;
  hideFeedbackTray();

  const lesson = await FSL.api("/lessons/" + lessonId);
  const detail = document.getElementById("lesson-detail");
  detail.classList.remove("hidden");
  const idx = moduleLessonList.findIndex((l) => l.id === lessonId);
  const big = escapeHtml(lesson.sign || lesson.title || "");
  
  detail.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
      <div class="lg:col-span-7 flex justify-center items-center p-4 bg-slate-900 rounded-2xl aspect-video border-3 border-outline-variant shadow-sm relative overflow-hidden" style="max-height: 380px;">
        ${lesson.image_placeholder ? `
          <img src="${escapeHtml(lesson.image_placeholder)}" alt="${big}" style="max-height:100%; object-fit:contain; border-radius:12px; display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'" />
          <div class="placeholder flex flex-col items-center justify-center text-center" style="display:none">
            <div class="font-quicksand font-bold text-6xl text-white mb-2">${big}</div>
            <p class="text-xs text-outline-variant">Visual sign visualizer placeholder</p>
          </div>` : `
          <div class="placeholder flex flex-col items-center justify-center text-center">
            <div class="font-quicksand font-bold text-8xl text-white mb-2">${big}</div>
            <p class="text-xs text-outline-variant">Visual sign visualizer placeholder</p>
          </div>`}
      </div>
      <div class="lg:col-span-5 glass-card rounded-2xl p-6 flex flex-col justify-between">
        <div>
          <span class="inline-block px-2.5 py-0.5 bg-surface-container text-primary font-bold text-xs uppercase rounded border border-outline-variant/40">${escapeHtml(lesson.module || "")} · Node ${idx + 1}/${moduleLessonList.length}</span>
          <h2 class="font-quicksand font-bold text-xl text-primary mt-3 mb-2">${escapeHtml(lesson.title)}</h2>
          <p class="text-xs text-on-surface-variant leading-relaxed mb-4">${escapeHtml(lesson.description || "")}</p>
          ${lesson.tips ? `<p class="text-xs text-on-surface font-medium bg-tertiary-fixed/60 border border-outline-variant/40 p-3 rounded-xl"><strong>Vocabulary Tip:</strong> ${escapeHtml(lesson.tips)}</p>` : ""}
        </div>
        <div class="flex flex-wrap gap-2 mt-6">
          <button class="btn-3d bg-primary text-white font-semibold text-xs py-3 px-6 rounded-xl flex items-center gap-1 uppercase tracking-wide" type="button" id="btn-lesson-quiz">Take practice quiz</button>
          <button class="px-4 py-2 border border-outline rounded-lg text-xs font-bold bg-surface-container hover:bg-surface-container-high transition-colors" type="button" onclick="document.getElementById('lesson-detail').classList.add('hidden')">Close panel</button>
        </div>
      </div>
    </div>`;
  detail.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("btn-lesson-quiz").onclick = () => startLessonQuiz(lesson);
}

// ---------------- LESSON QUIZZES ----------------
function startLessonQuiz(lesson) {
  const area = document.getElementById("module-quiz-area");
  document.getElementById("lesson-detail").classList.add("hidden");
  hideFeedbackTray();

  if (lesson.module === "alphabet") {
    quizMode = "lesson";
    quizLessonId = lesson.id;
    quizTargetLetter = (lesson.sign || "").toUpperCase();
    holdStart = null;
    area.innerHTML = `
      <div class="glass-card rounded-2xl p-5 mb-6 border border-primary-border">
        <h2 class="font-quicksand font-bold text-lg text-primary flex items-center gap-1.5"><span class="material-symbols-outlined text-xl">videocam</span> Show sign shape: <span style="font-size:2.2rem;font-weight:800;color:#004ac6">${escapeHtml(quizTargetLetter)}</span></h2>
        <p class="text-xs text-on-surface-variant leading-relaxed">Turn on your camera and show the hand shape. Hold still for 3 seconds while the loader ring fills up!</p>
      </div>
      ${cameraPanelHTML()}`;
    area.scrollIntoView({ behavior: "smooth", block: "start" });
    bindCameraButtons();
    setTimeout(() => startRecognition(), 300);
  } else {
    startLessonMcq(lesson);
  }
}

function cameraPanelHTML() {
  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div class="lg:col-span-7 camera-box" id="quiz-camera-box">
        <div class="placeholder flex flex-col items-center justify-center" id="cam-placeholder" style="position:absolute;inset:0;color:#b8cfe0;z-index:2;background:rgba(15,28,42,0.9)">
          <span class="material-symbols-outlined text-4xl mb-1">videocam</span>
          <span class="text-xs font-semibold">Click Start Camera below</span>
        </div>
        <video id="input-video" playsinline muted></video>
        <canvas id="output-canvas"></canvas>
        <div class="ring-overlay">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="8"/>
            <circle id="hold-ring-fg" cx="50" cy="50" r="42" fill="none" stroke="#60a5fa" stroke-width="8"
              stroke-linecap="round" transform="rotate(-90 50 50)"
              style="stroke-dasharray:264;stroke-dashoffset:264"/>
          </svg>
        </div>
      </div>
      <div class="lg:col-span-5 glass-card rounded-2xl p-6 flex flex-col items-center justify-center min-h-[280px] text-center">
        <div class="recog-status mb-4 inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container border border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase rounded-full" id="recog-status">Camera ready</div>
        <div class="flex gap-2 w-full mt-4 justify-center">
          <button class="btn-3d bg-primary text-white font-semibold text-xs py-2 px-4 rounded-xl flex items-center gap-1 uppercase tracking-wide" type="button" id="btn-start-cam">Start Camera</button>
          <button class="bg-surface-container border border-outline text-on-surface-variant font-semibold text-xs py-2 px-4 rounded-xl flex items-center gap-1 uppercase tracking-wide hover:bg-surface-container-high transition-colors" type="button" id="btn-stop-cam" disabled>Stop</button>
        </div>
        <p class="text-xs text-on-surface-variant mt-6 leading-relaxed">Position your hand clearly in front of the lens in a well-lit space. Let's do it!</p>
      </div>
    </div>`;
}

function bindCameraButtons() {
  const bs = document.getElementById("btn-start-cam");
  const be = document.getElementById("btn-stop-cam");
  if (bs) bs.onclick = () => startRecognition();
  if (be) be.onclick = () => stopRecognition(false);
}

function updateHoldRing(pct) {
  const ring = document.getElementById("hold-ring-fg");
  if (!ring) return;
  const c = 2 * Math.PI * 42;
  ring.style.strokeDasharray = c;
  ring.style.strokeDashoffset = String(c * (1 - Math.min(1, Math.max(0, pct))));
}

// ---------------- DUOLINGO FEEDBACK SLIDE UP TRAY ----------------
function showFeedbackTray(isCorrect, title, desc, onContinue) {
  const tray = document.getElementById("feedback-tray");
  const icon = document.getElementById("feedback-icon");
  const titleEl = document.getElementById("feedback-title");
  const descEl = document.getElementById("feedback-text");
  const btn = document.getElementById("feedback-btn");

  if (!tray) return;

  // Toggle feedback state styling classes
  if (isCorrect) {
    tray.className = "feedback-tray correct";
    icon.textContent = "check_circle";
    icon.className = "material-symbols-outlined text-4xl text-green-700 font-bold";
    titleEl.className = "font-quicksand font-bold text-lg text-green-900";
    descEl.className = "text-xs text-green-800 font-semibold";
    btn.className = "feedback-btn feedback-btn-correct";
    updateSigny("happy");
  } else {
    tray.className = "feedback-tray incorrect";
    icon.textContent = "error";
    icon.className = "material-symbols-outlined text-4xl text-red-700 font-bold";
    titleEl.className = "font-quicksand font-bold text-lg text-red-900";
    descEl.className = "text-xs text-red-800 font-semibold";
    btn.className = "feedback-btn feedback-btn-incorrect";
    updateSigny("sad");
  }

  titleEl.textContent = title;
  descEl.textContent = desc;

  btn.onclick = () => {
    hideFeedbackTray();
    if (onContinue) onContinue();
  };
}

function hideFeedbackTray() {
  const tray = document.getElementById("feedback-tray");
  if (tray) tray.className = "feedback-tray";
}

// ---------------- MARKING LESSON AS COMPLETED ----------------
async function markLessonPassed(lessonId, vocab) {
  if (currentClassroomId) {
    try {
      await FSL.api("/progress/complete-lesson", {
        method: "POST",
        body: { classroom_id: currentClassroomId, lesson_id: lessonId, vocabulary: vocab || null },
      });
    } catch (e) { console.warn(e); }
  }
  completedSet.add(lessonId);
  triggerConfetti();
  
  const idx = moduleLessonList.findIndex((l) => l.id === lessonId);
  const next = idx >= 0 ? moduleLessonList[idx + 1] : null;

  showFeedbackTray(true, "Lesson Passed!", "Fantastic! You've mastered this node progress path.", () => {
    stopRecognition(true);
    if (next) {
      document.getElementById("module-quiz-area").innerHTML =
        `<div class="glass-card rounded-2xl p-4 text-center text-sm font-semibold">Loading next node path…</div>`;
      setTimeout(() => openLesson(next.id), 300);
    } else {
      openModule(currentModule);
    }
  });
}

// ---------------- INTERACTIVE MCQ LAYOUT ----------------
function startLessonMcq(lesson) {
  const area = document.getElementById("module-quiz-area");
  const correct = lesson.sign || lesson.title;
  const others = moduleLessonList
    .filter((l) => l.id !== lesson.id)
    .map((l) => l.sign || l.title)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const options = [correct, ...others].sort(() => Math.random() - 0.5);
  
  area.innerHTML = `
    <div class="glass-card rounded-2xl p-6 space-y-4" style="margin-top:2rem;">
      <span class="inline-block px-2.5 py-0.5 bg-secondary-container/40 text-secondary-fixed-dim font-bold text-xs uppercase rounded border border-outline-variant/40">Node quiz</span>
      <div class="flex flex-col justify-center items-center aspect-video max-h-[180px] bg-slate-900 rounded-xl" style="margin:1.25rem 0;">
        <div class="placeholder flex flex-col items-center">
          <span class="material-symbols-outlined text-white text-3xl mb-1">movie</span>
          <div class="font-quicksand font-bold text-white text-sm">Visual Clue</div>
          <p class="text-[11px] text-outline-variant font-medium">${escapeHtml(lesson.description || "")}</p>
        </div>
      </div>
      <h3 class="font-quicksand font-bold text-base text-on-surface">What does this FSL sign represent?</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="lesson-mcq-opts">
        ${options.map((o) => `
          <div class="option hover:bg-surface-container flex items-center justify-between border border-outline p-4 rounded-xl cursor-pointer text-xs font-semibold select-none transition-all active:scale-[0.98]" data-opt="${escapeHtml(o)}">
            <span class="flex items-center gap-2"><span class="material-symbols-outlined text-sm text-primary">arrow_right</span> ${escapeHtml(o)}</span>
          </div>
        `).join("")}
      </div>
    </div>`;
    
  area.querySelectorAll(".option").forEach((el) => {
    el.addEventListener("click", () => {
      // Remove other select highlights
      area.querySelectorAll(".option").forEach(o => o.className = "option hover:bg-surface-container flex items-center justify-between border border-outline p-4 rounded-xl cursor-pointer text-xs font-semibold select-none transition-all active:scale-[0.98]");
      el.className = "option bg-primary-container text-on-primary-container flex items-center justify-between border-2 border-primary p-4 rounded-xl cursor-pointer text-xs font-bold select-none transition-all";
      
      const isRight = el.dataset.opt === correct;
      if (isRight) {
        showFeedbackTray(true, "Amazing Job!", "That is the correct meaning of this sign!", () => {
          markLessonPassed(lesson.id, correct);
        });
      } else {
        showFeedbackTray(false, "Let's Review", `Correct answer: ${correct}. Show correct hand shape!`, () => {
          // Allow re-selecting
          el.className = "option hover:bg-surface-container flex items-center justify-between border border-outline p-4 rounded-xl cursor-pointer text-xs font-semibold select-none transition-all active:scale-[0.98]";
        });
      }
    });
  });
  area.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------- MODULE LEVEL CHALLENGE EXAMS ----------------
function startModuleExam(moduleId) {
  const allDone = moduleLessonList.every((l) => completedSet.has(l.id));
  if (!allDone) {
    FSL.toast("Complete all sign nodes first!", "error");
    return;
  }
  hideFeedbackTray();
  if (moduleId === "alphabet") {
    quizMode = "module";
    moduleExamIndex = 0;
    quizTargetLetter = ALPHA_LETTERS[0];
    holdStart = null;
    const area = document.getElementById("module-quiz-area");
    area.innerHTML = `
      <div class="glass-card rounded-2xl p-6 mb-6">
        <h2 class="font-quicksand font-bold text-xl text-primary">Big Challenge: fingerspell letter <span style="color:#004ac6;font-size:3rem;font-weight:800;" id="exam-letter">${quizTargetLetter}</span></h2>
        <p class="text-xs text-on-surface-variant">Letter <span id="exam-progress" class="font-bold text-on-surface">1</span> of ${ALPHA_LETTERS.length}. Hold correct shape for 3 seconds.</p>
      </div>
      ${cameraPanelHTML()}`;
    bindCameraButtons();
    setTimeout(() => startRecognition(), 300);
  } else {
    startModuleMcqExam(moduleId);
  }
  document.getElementById("module-quiz-area").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function startModuleMcqExam(moduleId) {
  const area = document.getElementById("module-quiz-area");
  try {
    const quizzes = await FSL.api("/quizzes?module=" + moduleId);
    if (!quizzes.length) {
      area.innerHTML = `<p class="text-muted">No exam contents built.</p>`;
      return;
    }
    const full = await FSL.api("/quizzes/" + quizzes[0].id);
    window._mcq = { quiz: full, answers: {}, idx: 0 };
    renderModuleMcq();
  } catch (e) {
    area.innerHTML = `<p style="color:var(--danger)">${escapeHtml(e.message)}</p>`;
  }
}

function renderModuleMcq() {
  const area = document.getElementById("module-quiz-area");
  const st = window._mcq;
  const qs = st.quiz.questions || [];
  
  if (st.idx >= qs.length) {
    let correct = 0;
    qs.forEach((q) => { if (st.answers[q.id] === q.correct) correct++; });
    const score = Math.round((correct / qs.length) * 100);
    const pass = score >= (st.quiz.passing_score || 70);
    
    if (pass) {
      triggerConfetti();
      updateSigny("happy");
    } else {
      updateSigny("sad");
    }

    area.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center space-y-4">
      <span class="material-symbols-outlined text-4xl text-primary">${pass ? 'celebration' : 'sentiment_very_dissatisfied'}</span>
      <h2 class="font-quicksand font-bold text-2xl text-primary">Your Score: ${score}%</h2>
      <h3 class="font-quicksand font-bold text-base text-on-surface">${pass ? "Level Challenge Cleared!" : "Keep practicing!"}</h3>
      <p class="text-xs text-on-surface-variant max-w-sm mx-auto">${pass ? "Awesome! You passed the level exam and completed this module." : "Not yet passing. Review path nodes and try again!"}</p>
      <button class="btn-3d bg-primary text-white font-semibold text-xs py-3 px-8 rounded-xl uppercase tracking-wider mt-4" type="button" onclick="saveExamScore(${st.quiz.id},${score})">Save score & exit</button>
    </div>`;
    return;
  }
  
  const q = qs[st.idx];
  area.innerHTML = `
    <div class="glass-card rounded-2xl p-6 space-y-4">
      <span class="inline-block px-2 py-0.5 bg-surface-container text-primary font-bold text-xs uppercase rounded border border-outline-variant/30">Level Quiz Q ${st.idx + 1}/${qs.length}</span>
      <div class="flex flex-col justify-center items-center aspect-video max-h-[160px] bg-slate-900 rounded-xl" style="margin:1.25rem 0;">
        <div class="placeholder flex flex-col items-center"><span class="material-symbols-outlined text-white text-3xl mb-1">movie</span>
          <div class="font-quicksand font-bold text-white text-xs">${escapeHtml(q.sign_hint || "Visual Hint")}</div></div>
      </div>
      <h3 class="font-quicksand font-bold text-base text-on-surface">${escapeHtml(q.question)}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="exam-mcq-options">
        ${(q.options || []).map((o) => `
          <div class="option hover:bg-surface-container flex items-center justify-between border border-outline p-4 rounded-xl cursor-pointer text-xs font-semibold select-none transition-all active:scale-[0.98]" data-qid="${escapeHtml(q.id)}" data-opt="${escapeHtml(o)}">
            <span>${escapeHtml(o)}</span>
          </div>
        `).join("")}
      </div>
    </div>`;

  area.querySelectorAll(".option").forEach((el) => {
    el.onclick = () => {
      // Highlight selected
      area.querySelectorAll(".option").forEach(o => o.className = "option hover:bg-surface-container flex items-center justify-between border border-outline p-4 rounded-xl cursor-pointer text-xs font-semibold select-none transition-all active:scale-[0.98]");
      el.className = "option bg-primary-container text-on-primary-container flex items-center justify-between border-2 border-primary p-4 rounded-xl cursor-pointer text-xs font-bold select-none transition-all";
      
      const isRight = el.dataset.opt === q.correct;
      st.answers[el.dataset.qid] = el.dataset.opt;
      
      if (isRight) {
        showFeedbackTray(true, "Correct!", "Awesome! Moving to next challenge.", () => {
          st.idx++;
          renderModuleMcq();
        });
      } else {
        showFeedbackTray(false, "Incorrect", `The correct answer was: ${q.correct}`, () => {
          st.idx++;
          renderModuleMcq();
        });
      }
    };
  });
}

async function saveExamScore(quizId, score) {
  try {
    if (currentClassroomId) {
      await FSL.api("/quizzes/submit", {
        method: "POST",
        body: { classroom_id: currentClassroomId, quiz_id: quizId, score, answers: window._mcq?.answers || {} },
      });
    }
    FSL.toast("Exam saved: " + score + "%");
    openModule(currentModule);
  } catch (e) { FSL.toast(e.message, "error"); }
}

// ---------------- WEBCAM RECOGNITION HANDLERS ----------------
async function startRecognition() {
  const video = document.getElementById("input-video");
  if (!video) { FSL.toast("Camera panel not ready", "error"); return; }
  if (recognizing) return;
  const placeholder = document.getElementById("cam-placeholder");
  const bs = document.getElementById("btn-start-cam");
  const be = document.getElementById("btn-stop-cam");
  if (bs) bs.disabled = true;
  try {
    if (camera) { try { camera.stop(); } catch (_) {} camera = null; }
    hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
    hands.onResults(onHandResults);
    camera = new Camera(video, {
      onFrame: async () => { if (hands && recognizing) await hands.send({ image: video }); },
      width: 640, height: 480,
    });
    await camera.start();
    recognizing = true;
    if (placeholder) placeholder.style.display = "none";
    if (be) be.disabled = false;
    const st = document.getElementById("recog-status");
    if (st) st.textContent = "● Live — show sign";
  } catch (err) {
    console.error(err);
    if (bs) bs.disabled = false;
    FSL.toast("Camera: " + err.message, "error");
  }
}

function stopRecognition(clearQuiz) {
  recognizing = false;
  holdStart = null;
  updateHoldRing(0);
  if (camera) { try { camera.stop(); } catch (_) {} camera = null; }
  hands = null;
  const video = document.getElementById("input-video");
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
  const placeholder = document.getElementById("cam-placeholder");
  if (placeholder) placeholder.style.display = "flex";
  const bs = document.getElementById("btn-start-cam");
  const be = document.getElementById("btn-stop-cam");
  if (bs) bs.disabled = false;
  if (be) be.disabled = true;
  if (clearQuiz) quizMode = null;
}

function onHandResults(results) {
  const video = document.getElementById("input-video");
  const canvas = document.getElementById("output-canvas");
  if (!canvas || !video) return;
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
    const now = Date.now();
    if (now - lastSend >= SEND_INTERVAL_MS) {
      lastSend = now;
      const flat = [];
      for (const lm of results.multiHandLandmarks[0]) flat.push(lm.x, lm.y, lm.z);
      sendLandmarks(flat);
    }
  } else {
    holdStart = null;
    updateHoldRing(0);
  }
}

async function sendLandmarks(flat) {
  if (!quizMode || !quizTargetLetter) return;
  try {
    const res = await FSL.api("/recognize", { method: "POST", body: { landmarks: flat } });
    const letter = (res.letter || "?").toString().toUpperCase();
    const st = document.getElementById("recog-status");
    if (letter === quizTargetLetter) {
      if (!holdStart) holdStart = Date.now();
      const elapsed = Date.now() - holdStart;
      updateHoldRing(elapsed / HOLD_MS);
      if (st) st.textContent = "Great! Hold shape " + quizTargetLetter + "… " + Math.min(3, elapsed / 1000).toFixed(1) + "s";
      if (elapsed >= HOLD_MS) {
        holdStart = null;
        updateHoldRing(0);
        if (quizMode === "lesson") {
          await markLessonPassed(quizLessonId, quizTargetLetter);
        } else if (quizMode === "module") {
          moduleExamIndex++;
          if (moduleExamIndex >= ALPHA_LETTERS.length) {
            triggerConfetti();
            stopRecognition(true);
            showFeedbackTray(true, "Level Challenge Complete!", "Outstanding! You fingerspelled every letter perfectly.", () => {
              saveExamScore(1, 100);
            });
          } else {
            quizTargetLetter = ALPHA_LETTERS[moduleExamIndex];
            const el = document.getElementById("exam-letter");
            const pr = document.getElementById("exam-progress");
            if (el) el.textContent = quizTargetLetter;
            if (pr) pr.textContent = String(moduleExamIndex + 1);
            
            showFeedbackTray(true, "Correct Shape!", `Moving to letter: ${quizTargetLetter}`, () => {
              if (st) st.textContent = "Show letter: " + quizTargetLetter;
            });
          }
        }
      }
    } else {
      holdStart = null;
      updateHoldRing(0);
      if (st) st.textContent = "Show letter " + quizTargetLetter + " (Recognized: " + letter + ")";
    }
  } catch (e) { console.warn(e); }
}

function logout() {
  stopRecognition(true);
  FSL.logout();
}

function toggleSidebar() {
  const nav = document.querySelector(".sidebar-nav");
  const isCollapsed = nav.classList.toggle("sidebar-collapsed");
  
  const icon = document.getElementById("toggle-sidebar-icon");
  if (icon) {
    icon.textContent = isCollapsed ? "chevron_right" : "chevron_left";
  }
  localStorage.setItem("sidebar-collapsed", isCollapsed ? "true" : "false");
  
  // Redraw SVG path since positions shift
  setTimeout(drawConnectingLine, 350);
}

// Initialize sidebar state on page load
(function() {
  if (localStorage.getItem("sidebar-collapsed") === "true") {
    const nav = document.querySelector(".sidebar-nav");
    if (nav) {
      nav.classList.add("sidebar-collapsed");
      const icon = document.getElementById("toggle-sidebar-icon");
      if (icon) icon.textContent = "chevron_right";
    }
  }
})();

loadHome().then(() => { showView("learn"); loadLearnModules(); });
