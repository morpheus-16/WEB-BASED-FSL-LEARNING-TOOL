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
  box.innerHTML = `<p class="text-on-surface-variant font-bold text-center col-span-3 py-12 animate-pulse font-quicksand">Loading lessons...</p>`;
  try {
    const modules = await FSL.api("/modules");
    box.innerHTML = (modules || []).map((m) => `
      <div class="glass-card rounded-2xl p-6 hover:-translate-y-1 hover:shadow-lg transition-all cursor-pointer border border-outline-variant/30 flex flex-col justify-between" onclick="openModule('${m.id}')">
        <div>
          <h3 class="font-quicksand font-bold text-2xl text-primary mb-2">${escapeHtml(m.title)}</h3>
          <p class="text-base text-on-surface-variant font-semibold leading-relaxed">${escapeHtml(m.subtitle || m.description || m.id)}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-outline-variant/30">
          <span class="text-lg text-on-surface-variant font-bold">${m.total_lessons || 0} lessons</span>
        </div>
      </div>`).join("") || `<p class="text-sm text-on-surface-variant text-center col-span-3 py-12">No learning levels available</p>`;
    document.getElementById("learn-lessons").innerHTML = "";
    document.getElementById("lesson-detail").classList.add("hidden");
    document.getElementById("module-quiz-area").innerHTML = "";
    stopRecognition(true);
  } catch (e) {
    box.innerHTML = `<p class="text-error font-bold text-center col-span-3 py-12">${escapeHtml(e.message)}</p>`;
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

    <div class="duo-path-container relative mt-8">
      <svg class="duo-svg-path" id="duo-svg-path" viewBox="0 0 400 ${moduleLessonList.length * 110}">
        <path id="duo-line-path" d="" fill="none" stroke="#e5eefd" stroke-dasharray="8 6" stroke-width="6" stroke-linecap="round"/>
      </svg>
      
      ${nodesHtml}
      
      <div id="duo-tooltip" class="duo-tooltip"></div>
    </div>

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

  // Render curvy snake path line through the points
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpY1 = p0.y + 40;
    const cpY2 = p1.y - 40;
    d += ` C ${p0.x} ${cpY1}, ${p1.x} ${cpY2}, ${p1.x} ${p1.y}`;
  }
  
  pathEl.setAttribute("d", d);
}

// Recalculate winding paths on window resize
window.addEventListener("resize", () => {
  if (currentModule) drawConnectingLine();
});

// ---------------- SHOW TOOLTIP ON CLICK ----------------
function showDuoTooltip(nodeEl, lesson, status) {
  const tooltip = document.getElementById("duo-tooltip");
  if (!tooltip) return;

  const container = document.querySelector(".duo-path-container");
  const containerRect = container.getBoundingClientRect();
  const nodeRect = nodeEl.getBoundingClientRect();

  // Position tooltip centrally above node
  const left = (nodeRect.left + nodeRect.right) / 2 - containerRect.left;
  const top = nodeRect.top - containerRect.top;

  let actionText = "Start learning";
  if (status === "completed") actionText = "Practice again";

  tooltip.innerHTML = `
    <div class="font-quicksand font-bold text-sm text-primary mb-1">${escapeHtml(lesson.title)}</div>
    <p class="text-[10px] text-on-surface-variant leading-tight mb-2">Shape: ${escapeHtml(lesson.vocab || "")}</p>
    <button class="w-full bg-primary text-white text-[11px] font-bold py-1.5 px-3 rounded-lg hover:bg-primary-container transition-all" onclick="openLesson('${lesson.id}')">
      ${actionText}
    </button>
  `;
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.display = "block";

  // Close tooltip if clicked elsewhere
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
  
  // Smooth scroll down to interactive viewport
  detail.scrollIntoView({ behavior: "smooth", block: "start" });

  document.getElementById("lesson-title").textContent = lesson.title;
  document.getElementById("lesson-vocab").textContent = lesson.vocab;
  
  const videoPlaceholder = document.getElementById("video-placeholder");
  if (lesson.video_url) {
    videoPlaceholder.innerHTML = `
      <video class="w-full h-full object-cover rounded-2xl border border-outline-variant/35" controls autoplay loop muted>
        <source src="${escapeHtml(lesson.video_url)}" type="video/mp4" />
      </video>
    `;
  } else {
    // Default placeholder card structure
    videoPlaceholder.innerHTML = `
      <div class="flex flex-col items-center text-center p-6 bg-slate-900/10 rounded-2xl justify-center h-full w-full">
        <span class="material-symbols-outlined text-4xl text-outline-variant">movie</span>
        <p class="text-xs text-on-surface-variant font-medium mt-1">Video sign demo not loaded.</p>
      </div>
    `;
  }

  // Preset lesson practice details 
  document.getElementById("webcam-target-hint").textContent = "Show sign shape: " + lesson.vocab;
  document.getElementById("btn-start-recognition").onclick = () => startRecognition("lesson", lesson.vocab, lesson.id);
  
  // Clear camera feeds
  document.getElementById("webcam-preview").classList.add("hidden");
  document.getElementById("camera-placeholder").classList.remove("hidden");
}

// ---------------- MEDIA RECOGNITION (Webcam & MediaPipe) ----------------
function initMediaPipe() {
  if (hands) return; // already loaded
  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults(onHandResults);
}

function startRecognition(mode, target, lessonId) {
  if (recognizing) return;
  initMediaPipe();
  
  quizMode = mode;
  quizTargetLetter = target ? target.trim().toUpperCase() : null;
  quizLessonId = lessonId;
  holdStart = null;
  updateHoldRing(0);

  const videoElement = document.getElementById("student-webcam");
  const canvasElement = document.getElementById("student-canvas");
  const ctx = canvasElement.getContext("2d");

  camera = new Camera(videoElement, {
    onFrame: async () => {
      if (!recognizing) return;
      await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
  });

  recognizing = true;
  camera.start();

  // Switch display elements
  document.getElementById("webcam-preview").classList.remove("hidden");
  document.getElementById("camera-placeholder").classList.add("hidden");
  document.getElementById("btn-start-recognition").classList.add("hidden");
  document.getElementById("btn-stop-recognition").classList.remove("hidden");
  
  updateSigny("neutral");
}

function stopRecognition(silent = false) {
  recognizing = false;
  if (camera) {
    try { camera.stop(); } catch (_) {}
    camera = null;
  }
  
  const webPreview = document.getElementById("webcam-preview");
  if (webPreview) webPreview.classList.add("hidden");
  
  const camPlaceholder = document.getElementById("camera-placeholder");
  if (camPlaceholder) camPlaceholder.classList.remove("hidden");
  
  const btnStart = document.getElementById("btn-start-recognition");
  if (btnStart) btnStart.classList.remove("hidden");
  
  const btnStop = document.getElementById("btn-stop-recognition");
  if (btnStop) btnStop.classList.add("hidden");

  holdStart = null;
  updateHoldRing(0);

  if (!silent) {
    FSL.toast("Camera feed paused.");
  }
}

function updateHoldRing(percentage) {
  const ring = document.getElementById("hold-progress-ring");
  if (!ring) return;
  const val = Math.min(100, Math.max(0, percentage));
  ring.style.width = val + "%";
}

// ---------------- CANVAS KEYPOINT RENDERING & PREDICTIONS ----------------
async function onHandResults(results) {
  if (!recognizing) return;
  
  const canvasElement = document.getElementById("student-canvas");
  const ctx = canvasElement.getContext("2d");
  
  // Clear Canvas
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
    // Draw joints visual lines locally
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#004ac6', lineWidth: 3 });
      drawLandmarks(ctx, landmarks, { color: '#86f2e4', lineWidth: 1, radius: 3 });
    }

    const now = Date.now();
    if (now - lastSend > SEND_INTERVAL_MS) {
      lastSend = now;
      const landmarks = results.multiHandLandmarks[0];
      await predictFrame(landmarks);
    }
  } else {
    // No hands present - decay hold progress bar
    if (holdStart) {
      holdStart = null;
      updateHoldRing(0);
    }
    const st = document.getElementById("webcam-target-hint");
    if (st && quizTargetLetter) {
      st.textContent = `Show letter: ${quizTargetLetter} (Searching for hands...)`;
    }
  }
}

async function predictFrame(landmarks) {
  try {
    const res = await FSL.api("/predict", {
      method: "POST",
      body: { landmarks }
    });
    
    const letter = res.letter;
    const st = document.getElementById("webcam-target-hint");

    if (letter && letter.toUpperCase() === quizTargetLetter) {
      if (!holdStart) {
        holdStart = Date.now();
      }
      
      const elapsed = Date.now() - holdStart;
      const pct = (elapsed / HOLD_MS) * 100;
      updateHoldRing(pct);

      if (st) st.textContent = `Recognized target: ${letter}! Hold sign ... ${Math.max(0, Math.ceil((HOLD_MS - elapsed) / 1000))}s`;

      if (elapsed >= HOLD_MS) {
        // Mastered / passed node trigger!
        stopRecognition(true);
        updateSigny("happy");
        
        if (quizMode === "lesson") {
          await markLessonPassed(quizLessonId, quizTargetLetter);
        } else if (quizMode === "module") {
          // Progress level quiz sequence 
          moduleExamIndex++;
          if (moduleExamIndex >= ALPHA_LETTERS.length) {
            // Complete exam level
            triggerConfetti();
            showFeedbackTray(true, "Level Mastered! 🎉", "Sensational job! You passed the entire Alphabet Exam challenge.");
            const area = document.getElementById("module-quiz-area");
            area.innerHTML = "";
          } else {
            quizTargetLetter = ALPHA_LETTERS[moduleExamIndex];
            holdStart = null;
            updateHoldRing(0);
            
            const areaTarget = document.getElementById("quiz-module-target-letter");
            const pr = document.getElementById("quiz-module-progress-text");
            if (areaTarget) areaTarget.textContent = quizTargetLetter;
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
      if (icon) {
        icon.textContent = "chevron_right";
      }
    }
  }
  // Load initially home screen contents 
  showView("home");
})();

// ---------------- FEEDBACK TRANSITION TRAY ----------------
function showFeedbackTray(success, title, subtitle, onContinue) {
  const tray = document.getElementById("feedback-tray");
  if (!tray) return;

  const tEl = document.getElementById("feedback-title");
  const sEl = document.getElementById("feedback-text");
  const iEl = document.getElementById("feedback-icon");
  const btn = document.getElementById("feedback-btn-continue");

  tEl.textContent = title || "Notification";
  sEl.textContent = subtitle || "";
  
  if (success) {
    tray.className = "feedback-tray feedback-success active";
    iEl.textContent = "check_circle";
  } else {
    tray.className = "feedback-tray feedback-error active";
    iEl.textContent = "error";
  }

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
        body: {
          classroom_id: currentClassroomId,
          lesson_id: lessonId,
          vocabulary: vocab || null
        },
      });
    } catch (e) {
      console.warn(e);
    }
  }
  
  completedSet.add(lessonId);
  triggerConfetti();

  const idx = moduleLessonList.findIndex((l) => l.id === lessonId);
  const next = idx >= 0 ? moduleLessonList[idx + 1] : null;

  showFeedbackTray(true, "Lesson Passed!", "Fantastic! You've mastered this node progress path.", () => {
    stopRecognition(true);
    if (next) {
      document.getElementById("module-quiz-area").innerHTML = `
        <div class="glass-card rounded-2xl p-6 text-center shadow-lg border border-outline-variant/30 max-w-sm mx-auto">
          <span class="material-symbols-outlined text-4xl text-primary animate-bounce">arrow_circle_right</span>
          <h4 class="font-quicksand font-bold text-base text-primary mt-2">Next Node Unlocked</h4>
          <p class="text-xs text-on-surface-variant mt-1 mb-4">You are ready to learn: <strong>${escapeHtml(next.title)}</strong></p>
          <button class="btn-3d w-full bg-primary text-white font-semibold text-xs py-2.5 rounded-lg uppercase" onclick="openLesson('${next.id}')">
            Continue Journey
          </button>
        </div>
      `;
      document.getElementById("module-quiz-area").scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Re-initialize path update visual
      openModule(currentModule);
    }
  });
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
      <div class="glass-card rounded-2xl p-6 text-center max-w-md mx-auto border border-outline-variant/30">
        <h3 class="font-quicksand font-bold text-lg text-primary mb-1">Live Webcam Level Exam</h3>
        <p class="text-xs text-on-surface-variant">Perform each sign shape cleanly. Complete all 25 handshapes to pass!</p>
        
        <div class="my-6">
          <div class="text-xs font-bold text-text-muted">SIGN THIS LETTER (<span id="quiz-module-progress-text">1</span>/25)</div>
          <div class="text-5xl font-black font-quicksand text-primary mt-1 animate-[bounce_1s_infinite]" id="quiz-module-target-letter">${quizTargetLetter}</div>
        </div>

        <button class="btn-3d w-full bg-primary text-white font-semibold text-xs py-3 rounded-xl uppercase tracking-wider mb-2" id="btn-start-exam-recognition">
          Start Webcam Exam
        </button>
        <button class="btn-tactile w-full bg-surface-container-high border border-outline-variant text-on-surface font-semibold text-xs py-3 rounded-xl uppercase tracking-wider hidden" id="btn-stop-exam-recognition">
          Pause webcam
        </button>
      </div>
    `;

    document.getElementById("btn-start-exam-recognition").onclick = () => {
      startRecognition("module", quizTargetLetter, null);
      document.getElementById("btn-start-exam-recognition").classList.add("hidden");
      document.getElementById("btn-stop-exam-recognition").classList.remove("hidden");
    };

    document.getElementById("btn-stop-exam-recognition").onclick = () => {
      stopRecognition(true);
      document.getElementById("btn-start-exam-recognition").classList.remove("hidden");
      document.getElementById("btn-stop-exam-recognition").classList.add("hidden");
    };

    area.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    // Generate text/image level quiz cards for regular vocabulary
    generateVocabularyQuiz(moduleId);
  }
}

async function generateVocabularyQuiz(moduleId) {
  const area = document.getElementById("module-quiz-area");
  area.innerHTML = `<p class="text-muted text-center py-6">Compiling quiz challenges ...</p>`;

  // Get active module signs
  const lessons = await FSL.api("/lessons?module=" + moduleId);
  if (!lessons.length) {
    area.innerHTML = `<p class="text-xs text-on-surface-variant text-center">No questions available.</p>`;
    return;
  }

  // Create multi-choice question list structure
  const questions = lessons.map((l, idx) => {
    const wrong = lessons.filter(x => x.id !== l.id).map(x => x.vocab);
    // Shuffle wrong items
    const distractorPool = [...new Set(wrong)].sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [l.vocab, ...distractorPool].sort(() => 0.5 - Math.random());
    
    return {
      lesson_id: l.id,
      correct: l.vocab,
      options,
      video: l.video_url
    };
  });

  let curIdx = 0;
  const renderQuestion = (st) => {
    if (!st) {
      // Completed entire exam sequence successfully
      triggerConfetti();
      showFeedbackTray(true, "Vocabulary Level Complete!", "Splendid! You passed all visual vocabulary questions.");
      area.innerHTML = "";
      return;
    }

    area.innerHTML = `
      <div class="glass-card rounded-2xl p-6 max-w-sm mx-auto border border-outline-variant/30">
        <span class="inline-block px-2 py-0.5 bg-surface-container text-primary text-[10px] font-bold uppercase rounded border border-outline-variant/30">Q ${st.idx + 1}/${questions.length}</span>
        
        <div class="flex flex-col justify-center items-center aspect-video max-h-[160px] bg-slate-900 rounded-xl" style="margin:1.25rem 0;">
          ${st.video 
            ? `<video class="w-full h-full object-cover rounded-xl" autoplay loop muted><source src="${escapeHtml(st.video)}" type="video/mp4" /></video>`
            : `<div class="placeholder flex flex-col items-center"><span class="material-symbols-outlined text-white text-3xl mb-1">movie</span><div class="font-quicksand font-bold text-white text-xs">Sign Demo</div></div>`
          }
        </div>

        <h4 class="font-quicksand font-bold text-sm text-on-surface mb-3">Which word matches this sign?</h4>
        
        <div class="space-y-2" id="quiz-options-box">
          ${st.options.map(o => `
            <div class="option hover:bg-surface-container flex items-center justify-between border border-outline-variant p-4 rounded-xl cursor-pointer text-xs font-bold select-none transition-all active:scale-[0.98]" data-val="${escapeHtml(o)}">
              <span>${escapeHtml(o)}</span>
              <span class="material-symbols-outlined text-outline-variant text-sm">radio_button_unchecked</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    document.querySelectorAll("#quiz-options-box .option").forEach(el => {
      el.onclick = () => {
        const val = el.dataset.val;
        if (val === st.correct) {
          el.className = "option bg-green-500/10 border-green-500 text-green-700 flex items-center justify-between border p-4 rounded-xl cursor-pointer text-xs font-bold select-none";
          el.querySelector("span:last-child").innerHTML = "check_circle";
          el.querySelector("span:last-child").className = "material-symbols-outlined text-green-600 text-sm";
          updateSigny("happy");
          
          showFeedbackTray(true, "Correct Sign!", `"${st.correct}" is correct!`, () => {
            curIdx++;
            renderQuestion(questions[curIdx] ? { ...questions[curIdx], idx: curIdx } : null);
          });
        } else {
          el.className = "option bg-red-500/10 border-red-500 text-red-700 flex items-center justify-between border p-4 rounded-xl cursor-pointer text-xs font-bold select-none";
          el.querySelector("span:last-child").innerHTML = "cancel";
          el.querySelector("span:last-child").className = "material-symbols-outlined text-red-600 text-sm";
          updateSigny("sad");
          
          showFeedbackTray(false, "Incorrect", `That is not the correct sign. Try again!`, () => {
            // Allow re-selecting
            el.className = "option hover:bg-surface-container flex items-center justify-between border border-outline-variant p-4 rounded-xl cursor-pointer text-xs font-bold select-none transition-all active:scale-[0.98]";
            el.querySelector("span:last-child").innerHTML = "radio_button_unchecked";
            el.querySelector("span:last-child").className = "material-symbols-outlined text-outline-variant text-sm";
          });
        }
      };
    });
  };

  renderQuestion({ ...questions[0], idx: 0 });
  area.scrollIntoView({ behavior: "smooth", block: "start" });
}