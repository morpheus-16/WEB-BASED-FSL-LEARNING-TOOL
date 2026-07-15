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
let quizMode = null;
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
    
    widget.addEventListener("click", () => {
      updateSigny("neutral");
    });
  }
  setTimeout(() => updateSigny("neutral"), 100);
})();

function showView(name, el) {
  hideDuoTooltip();
  hideFeedbackTray();

  // Hide all views first
  document.querySelectorAll('.view-container').forEach(v => {
    v.classList.add('hidden');
  });

  if (name === "level") {
    const levelView = document.getElementById("view-level");
    if (levelView) {
      levelView.classList.remove("hidden");
    } else {
      const viewLearn = document.getElementById("view-learn");
      const levelView = document.createElement("div");
      levelView.id = "view-level";
      levelView.className = "view-container hidden";
      viewLearn.parentNode.insertBefore(levelView, viewLearn.nextSibling);
      
      const container = document.createElement("div");
      container.id = "level-content";
      levelView.appendChild(container);
      
      levelView.classList.remove("hidden");
    }
    document.getElementById("view-learn").classList.add("hidden");
    return;
  }

  if (name === "lesson-view") {
    document.getElementById("view-learn").classList.add("hidden");
    const lessonView = document.getElementById("view-lesson");
    if (lessonView) {
      lessonView.classList.remove("hidden");
    } else {
      const viewLearn = document.getElementById("view-learn");
      const lessonView = document.createElement("div");
      lessonView.id = "view-lesson";
      lessonView.className = "view-container hidden";
      viewLearn.parentNode.insertBefore(lessonView, viewLearn.nextSibling);
      
      const container = document.createElement("div");
      container.id = "lesson-content";
      lessonView.appendChild(container);
      
      lessonView.classList.remove("hidden");
    }
    return;
  }

  // Handle regular views
  ["home", "learn", "profile"].forEach((v) => {
    const n = document.getElementById("view-" + v);
    if (n) {
      if (v === name) {
        n.classList.remove("hidden");
      } else {
        n.classList.add("hidden");
      }
    }
  });
  
  const levelView = document.getElementById("view-level");
  if (levelView) levelView.classList.add("hidden");
  const lessonView = document.getElementById("view-lesson");
  if (lessonView) lessonView.classList.add("hidden");
  
  document.querySelectorAll(".sidebar-nav button, .bottom-link").forEach((a) => {
    a.classList.remove("active");
  });
  
  document.querySelectorAll(`[data-view="${name}"]`).forEach((a) => {
    a.classList.add("active");
  });

  if (name === "home") loadHome();
  if (name === "learn") {
    loadLearnModules();
  }
  if (name === "profile") {
    const u = user || {};
    document.getElementById("prof-name").value = u.full_name || "";
    document.getElementById("prof-user").value = u.username || "";
    document.getElementById("prof-email").value = u.email || "";
  }
}

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
  box.innerHTML = `
    <div class="col-span-3 flex justify-center py-12">
      <div class="spinner"></div>
    </div>
  `;
  
  try {
    const modules = await FSL.api("/modules");
    
    if (!modules || !modules.length) {
      box.innerHTML = `<p class="text-sm text-on-surface-variant text-center col-span-3 py-12">No learning levels available</p>`;
      return;
    }
    
    let completedSet = new Set();
    if (currentClassroomId) {
      try {
        const prog = await FSL.api("/progress?classroom_id=" + currentClassroomId);
        const p = Array.isArray(prog) ? prog[0] : prog;
        completedSet = new Set(p && p.completed_lessons ? p.completed_lessons : []);
      } catch (_) {}
    }
    
    let unlockedModules = [];
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      if (i === 0) {
        unlockedModules.push({ ...m, unlocked: true });
      } else {
        const prevModule = modules[i - 1];
        const prevLessons = await FSL.api("/lessons?module=" + prevModule.id);
        const allPrevDone = prevLessons.every(l => completedSet.has(l.id));
        unlockedModules.push({ ...m, unlocked: allPrevDone });
      }
    }
    
    box.innerHTML = unlockedModules.map((m) => {
      const isUnlocked = m.unlocked;
      const clickable = isUnlocked ? `onclick="navigateToLevel('${m.id}')"` : '';
      const cursorClass = isUnlocked ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-not-allowed opacity-60';
      const lockIcon = isUnlocked ? '' : '<span class="material-symbols-outlined text-2xl">lock</span>';
      
      let levelClass = '';
      if (m.id === 'alphabet') {
        levelClass = 'module-lvl-1';
      } else if (m.id === 'vocabulary' || m.id === 'basic') {
        levelClass = 'module-lvl-2';
      } else {
        levelClass = 'module-lvl-3';
      }
      
      return `
        <div class="learn-module-card ${levelClass} ${cursorClass}" ${clickable}>
          <h3 class="font-quicksand font-extrabold text-xl text-primary">${escapeHtml(m.title)}</h3>
          <p class="text-sm text-on-surface-variant font-semibold text-center">${escapeHtml(m.subtitle || m.description || '')}</p>
          <div class="mt-3 flex items-center gap-2 justify-center">
            <span class="text-xs font-bold text-on-surface-variant">${m.total_lessons || 0} lessons</span>
            ${!isUnlocked ? lockIcon : ''}
          </div>
          ${isUnlocked ? '<span class="text-xs font-bold text-success mt-1">✔ Ready to start</span>' : '<span class="text-xs font-bold text-muted mt-1">📌 Complete previous level</span>'}
        </div>
      `;
    }).join("");
    
    document.getElementById("learn-lessons").innerHTML = "";
    document.getElementById("module-quiz-area").innerHTML = "";
    stopRecognition(true);
    
  } catch (e) {
    box.innerHTML = `<p class="text-error font-bold text-center col-span-3 py-12">${escapeHtml(e.message)}</p>`;
  }
}

function navigateToLevel(moduleId) {
  sessionStorage.setItem("fsl_current_module", moduleId);
  if (currentClassroomId) {
    sessionStorage.setItem("fsl_classroom_id", currentClassroomId);
  }
  showView("level");
  loadLevelContent(moduleId);
}

async function loadLevelContent(moduleId) {
  currentModule = moduleId;
  stopRecognition(true);
  quizMode = null;
  await refreshCompleted();
  
  const lessons = await FSL.api("/lessons?module=" + moduleId);
  moduleLessonList = lessons.slice().sort((a, b) => (a.order || a.id) - (b.order || b.id));
  
  const title = moduleId.charAt(0).toUpperCase() + moduleId.slice(1);
  
  let activeIndex = moduleLessonList.findIndex(l => !completedSet.has(l.id));
  if (activeIndex === -1 && moduleLessonList.length > 0) {
    activeIndex = moduleLessonList.length; 
  }

  const shiftPatterns = ["shift-none", "shift-right-1", "shift-right-2", "shift-right-1", "shift-none", "shift-left-1", "shift-left-2", "shift-left-1"];

  const nodesHtml = moduleLessonList.map((l, idx) => {
    const isCompleted = completedSet.has(l.id);
    const isActive = idx === activeIndex;
    const isLocked = idx > activeIndex;
    
    let nodeClass = "duo-node-locked";
    let icon = "lock";
    let label = idx + 1;
    if (isCompleted) {
      nodeClass = "duo-node-completed";
      icon = "check";
    } else if (isActive) {
      nodeClass = "duo-node-active";
      icon = "play_arrow";
    }

    const shift = shiftPatterns[idx % shiftPatterns.length];

    return `
      <div class="duo-node ${nodeClass} ${shift}" data-idx="${idx}" data-id="${l.id}">
        <span class="text-xs font-bold absolute top-1 left-1/2 -translate-x-1/2 text-white/80">${label}</span>
        <span class="material-symbols-outlined text-2xl font-bold">${icon}</span>
      </div>
    `;
  }).join("");

  const allDone = moduleLessonList.length > 0 && activeIndex === moduleLessonList.length;

  const container = document.getElementById("level-content");
  if (!container) {
    const viewLearn = document.getElementById("view-learn");
    const levelView = document.createElement("div");
    levelView.id = "view-level";
    levelView.className = "hidden space-y-8";
    viewLearn.parentNode.insertBefore(levelView, viewLearn.nextSibling);
    
    const newContainer = document.createElement("div");
    newContainer.id = "level-content";
    levelView.appendChild(newContainer);
    
    document.getElementById("view-level").classList.remove("hidden");
    document.getElementById("view-learn").classList.add("hidden");
    
    const finalContainer = document.getElementById("level-content");
    finalContainer.innerHTML = `
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="font-quicksand font-bold text-2xl text-primary">${title} Path</h2>
          <p class="text-sm text-on-surface-variant">Master the path nodes. Challenge the level exam at the end!</p>
        </div>
        <button class="flex items-center gap-2 bg-surface-container border border-outline-variant text-on-surface-variant font-bold text-sm px-4 py-2 rounded-xl hover:bg-surface-container-high transition-colors" onclick="goBackToLevels()">
          <span class="material-symbols-outlined text-sm">arrow_back</span>
          Back to Levels
        </button>
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
        <p class="text-sm text-on-surface-variant max-w-sm mb-4">
          ${allDone 
            ? "Amazing! You mastered the entire track. Prove your sign skills in the webcam Level Challenge!"
            : "Unlock the Level Challenge by completing all winding path nodes above."}
        </p>
        <button class="btn-3d bg-primary text-white font-semibold text-sm py-3 px-8 rounded-xl uppercase tracking-wider ${allDone ? "" : "opacity-50 cursor-not-allowed"}" type="button" id="btn-module-exam" ${allDone ? "" : "disabled"}>
          ${moduleId === "alphabet" ? "Start Live Alphabet Quiz" : "Start Level Quiz"}
        </button>
      </div>
    `;

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

    setTimeout(drawConnectingLine, 100);
    return;
  }

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="font-quicksand font-bold text-2xl text-primary">${title} Path</h2>
        <p class="text-sm text-on-surface-variant">Master the path nodes. Challenge the level exam at the end!</p>
      </div>
      <button class="flex items-center gap-2 bg-surface-container border border-outline-variant text-on-surface-variant font-bold text-sm px-4 py-2 rounded-xl hover:bg-surface-container-high transition-colors" onclick="goBackToLevels()">
        <span class="material-symbols-outlined text-sm">arrow_back</span>
        Back to Levels
      </button>
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
      <p class="text-sm text-on-surface-variant max-w-sm mb-4">
        ${allDone 
          ? "Amazing! You mastered the entire track. Prove your sign skills in the webcam Level Challenge!"
          : "Unlock the Level Challenge by completing all winding path nodes above."}
      </p>
      <button class="btn-3d bg-primary text-white font-semibold text-sm py-3 px-8 rounded-xl uppercase tracking-wider ${allDone ? "" : "opacity-50 cursor-not-allowed"}" type="button" id="btn-module-exam" ${allDone ? "" : "disabled"}>
        ${moduleId === "alphabet" ? "Start Live Alphabet Quiz" : "Start Level Quiz"}
      </button>
    </div>
  `;

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

  setTimeout(drawConnectingLine, 100);
}

function goBackToLevels() {
  showView("learn");
  const levelView = document.getElementById("view-level");
  if (levelView) levelView.classList.add("hidden");
}

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

window.addEventListener("resize", () => {
  if (currentModule) drawConnectingLine();
});

function showDuoTooltip(nodeEl, lesson, status) {
  const tooltip = document.getElementById("duo-tooltip");
  if (!tooltip) return;

  const container = document.querySelector(".duo-path-container");
  const containerRect = container.getBoundingClientRect();
  const nodeRect = nodeEl.getBoundingClientRect();

  const left = (nodeRect.left + nodeRect.right) / 2 - containerRect.left;
  const top = nodeRect.top - containerRect.top;

  let actionText = "Start learning";
  if (status === "completed") actionText = "Practice again";

  tooltip.innerHTML = `
    <div class="font-quicksand font-bold text-base text-primary mb-2">${escapeHtml(lesson.title)}</div>
    <p class="text-sm text-on-surface-variant leading-tight mb-3">Shape: ${escapeHtml(lesson.vocab || "")}</p>
    <button class="w-full bg-primary text-white text-base font-bold py-3 px-6 rounded-xl hover:bg-primary-container transition-all shadow-lg" onclick="openLessonPage('${lesson.id}')">
      ${actionText}
    </button>
  `;
  
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.display = "block";

  const closeHandler = (event) => {
    if (!tooltip.contains(event.target) && !nodeEl.contains(event.target)) {
      hideDuoTooltip();
      document.removeEventListener("click", closeHandler);
    }
  };
  setTimeout(() => {
    document.addEventListener("click", closeHandler);
  }, 50);
}

function hideDuoTooltip() {
  const tooltip = document.getElementById("duo-tooltip");
  if (tooltip) tooltip.style.display = "none";
}

function goBackToLevelFromLesson() {
  showView("level");
  const lessonView = document.getElementById("view-lesson");
  if (lessonView) lessonView.classList.add("hidden");
  if (currentModule) {
    loadLevelContent(currentModule);
  }
}

async function openLessonPage(lessonId) {
  stopRecognition(true);
  quizMode = null;
  hideFeedbackTray();

  const lesson = await FSL.api("/lessons/" + lessonId);
  
  showView("lesson-view");
  
  const container = document.getElementById("lesson-content");
  if (!container) return;

  const currentIndex = moduleLessonList.findIndex(l => l.id === lessonId);
  const totalLessons = moduleLessonList.length;
  const isCompleted = completedSet.has(lessonId);
  const isLast = currentIndex === totalLessons - 1;
  const nextLesson = !isLast ? moduleLessonList[currentIndex + 1] : null;
  const prevLesson = currentIndex > 0 ? moduleLessonList[currentIndex - 1] : null;
  const isAlphabet = currentModule === 'alphabet';

  container.innerHTML = `
    <div class="h-full w-full flex flex-col bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <!-- Top Navigation Bar - Kid Friendly -->
      <div class="flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-sm border-b-4 border-primary/20 shrink-0">
        <button class="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-base px-5 py-2.5 rounded-2xl transition-all hover:scale-105 active:scale-95 border-2 border-primary/20" onclick="goBackToLevelFromLesson()">
          <span class="material-symbols-outlined">arrow_back</span>
          Back
        </button>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-md border-2 border-primary/10">
            <span class="text-sm font-bold text-primary">⭐ Lesson</span>
            <span class="text-sm font-bold text-on-surface-variant">${currentIndex + 1} of ${totalLessons}</span>
          </div>
          ${isCompleted ? '<span class="flex items-center gap-1 bg-green-100 text-green-700 font-bold text-sm px-4 py-2 rounded-2xl border-2 border-green-300"><span class="material-symbols-outlined text-sm">check_circle</span> Done!</span>' : ''}
        </div>
        <div class="flex gap-2">
          ${prevLesson ? `
            <button class="bg-white border-2 border-primary/20 text-primary font-bold text-sm px-5 py-2.5 rounded-2xl hover:bg-primary/5 transition-all hover:scale-105 active:scale-95 flex items-center gap-1 shadow-md" onclick="openLessonPage('${prevLesson.id}')">
              <span class="material-symbols-outlined text-sm">arrow_back</span>
              Prev
            </button>
          ` : ''}
          ${nextLesson ? `
            <button class="bg-gradient-to-r from-primary to-blue-600 text-white font-bold text-sm px-6 py-2.5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1" onclick="openLessonPage('${nextLesson.id}')">
              Next
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Main Content - Full remaining height -->
      <div class="flex-1 flex overflow-hidden p-4 gap-4">
        <!-- Left Side - Letter + Image -->
        <div class="flex-1 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-3xl border-2 border-primary/10 p-6 shadow-xl">
          <!-- Big Letter -->
          <div class="text-8xl md:text-9xl font-extrabold text-primary font-quicksand mb-4 drop-shadow-lg animate-bounce-slow">
            ${escapeHtml(lesson.vocab || lesson.title)}
          </div>
          <p class="text-2xl font-bold text-on-surface-variant mb-4">${escapeHtml(lesson.title)}</p>
          
          <!-- Image/Video -->
          <div class="w-full max-w-2xl flex-1 min-h-[200px]">
            ${lesson.video_url ? `
              <div class="rounded-2xl overflow-hidden bg-slate-800 h-full min-h-[200px] border-4 border-primary/20">
                <video class="w-full h-full object-cover" controls autoplay loop muted>
                  <source src="${escapeHtml(lesson.video_url)}" type="video/mp4" />
                </video>
              </div>
            ` : lesson.image_url ? `
              <div class="rounded-2xl overflow-hidden bg-white border-4 border-primary/20 h-full min-h-[200px] flex items-center justify-center">
                <img src="${escapeHtml(lesson.image_url)}" alt="${escapeHtml(lesson.title)}" class="w-full h-full object-contain" />
              </div>
            ` : `
              <div class="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100 border-4 border-dashed border-primary/30 flex items-center justify-center h-full min-h-[200px]">
                <div class="text-center">
                  <span class="material-symbols-outlined text-6xl text-primary/40">image</span>
                  <p class="text-sm text-on-surface-variant mt-2">No media available</p>
                </div>
              </div>
            `}
          </div>
        </div>

        <!-- Right Side - Camera/Recognition (Alphabet only) -->
        ${isAlphabet ? `
          <div class="w-[45%] min-w-[350px] flex flex-col bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-primary/20 p-4 shadow-xl">
            <div class="flex items-center gap-3 mb-3 shrink-0">
              <span class="material-symbols-outlined text-3xl text-primary">videocam</span>
              <h3 class="font-quicksand font-bold text-xl text-primary">Sign & Spell!</h3>
              <span class="ml-auto text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-1.5 rounded-full shadow-md">🎯 Alphabet</span>
            </div>
            
            <p class="text-sm text-on-surface-variant mb-3 shrink-0 font-medium">
              Show the sign for <strong class="text-2xl text-primary">${escapeHtml(lesson.vocab || lesson.title)}</strong>
            </p>
            
            <!-- Camera Area -->
            <div class="flex-1 relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl overflow-hidden border-4 border-primary/30 min-h-[250px]">
              <div id="camera-placeholder" class="absolute inset-0 flex flex-col items-center justify-center text-white/60">
                <span class="material-symbols-outlined text-7xl animate-pulse">videocam</span>
                <p class="text-base font-medium mt-3">📸 Ready!</p>
                <p class="text-sm opacity-60">Click Start to begin</p>
              </div>
              <video id="student-webcam" class="w-full h-full object-cover hidden" playsinline></video>
              <canvas id="student-canvas" class="w-full h-full object-cover absolute inset-0 hidden"></canvas>
              
              <!-- Recognition overlay -->
              <div class="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full border border-white/10">
                <span class="text-sm font-bold" id="recognized-letter">?</span>
              </div>
            </div>

            <!-- Controls -->
            <div class="mt-4 shrink-0">
              <div class="flex items-center gap-4">
                <div class="flex-1">
                  <div class="flex justify-between text-sm font-bold text-on-surface-variant mb-1">
                    <span>👋 Hold sign</span>
                    <span id="webcam-target-hint" class="text-primary">${escapeHtml(lesson.vocab || lesson.title)}</span>
                  </div>
                  <div class="w-full bg-blue-100 h-4 rounded-full overflow-hidden border-2 border-primary/20">
                    <div class="h-full bg-gradient-to-r from-primary to-green-400 rounded-full transition-all duration-300" id="hold-progress-ring" style="width:0%"></div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button class="bg-gradient-to-r from-primary to-blue-600 text-white font-bold text-sm py-3 px-6 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1" id="btn-start-recognition" onclick="startRecognition('lesson', '${escapeHtml(lesson.vocab || lesson.title)}', '${lesson.id}')">
                    <span class="material-symbols-outlined text-sm">play_arrow</span> Start
                  </button>
                  <button class="bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-sm py-3 px-6 rounded-2xl hidden hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1" id="btn-stop-recognition" onclick="stopRecognition()">
                    <span class="material-symbols-outlined text-sm">stop</span> Stop
                  </button>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <!-- Non-alphabet: Description panel -->
          <div class="w-[45%] min-w-[350px] flex flex-col bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-primary/20 p-6 shadow-xl items-center justify-center">
            <div class="max-w-md text-center">
              <span class="material-symbols-outlined text-7xl text-primary/30 mb-4">description</span>
              <h3 class="font-quicksand font-bold text-2xl text-primary mb-3">${escapeHtml(lesson.title)}</h3>
              ${lesson.description ? `
                <p class="text-base text-on-surface-variant leading-relaxed">${escapeHtml(lesson.description)}</p>
              ` : ''}
              ${lesson.instructions ? `
                <div class="mt-4 p-4 bg-blue-50 rounded-2xl border-2 border-primary/20">
                  <p class="text-sm text-on-surface-variant leading-relaxed">${escapeHtml(lesson.instructions)}</p>
                </div>
              ` : ''}
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  if (isAlphabet) {
    const video = document.getElementById("student-webcam");
    const canvas = document.getElementById("student-canvas");
    if (video && canvas) {
      video.classList.remove("hidden");
      canvas.classList.remove("hidden");
    }
  }
}

async function openLesson(lessonId) {
  stopRecognition(true);
  quizMode = null;
  hideFeedbackTray();

  const lesson = await FSL.api("/lessons/" + lessonId);
  const detail = document.getElementById("lesson-detail");
  detail.classList.remove("hidden");
  
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
    videoPlaceholder.innerHTML = `
      <div class="flex flex-col items-center text-center p-6 bg-slate-900/10 rounded-2xl justify-center h-full w-full">
        <span class="material-symbols-outlined text-4xl text-outline-variant">movie</span>
        <p class="text-xs text-on-surface-variant font-medium mt-1">Video sign demo not loaded.</p>
      </div>
    `;
  }

  document.getElementById("webcam-target-hint").textContent = "Show sign shape: " + lesson.vocab;
  document.getElementById("btn-start-recognition").onclick = () => startRecognition("lesson", lesson.vocab, lesson.id);
  
  document.getElementById("webcam-preview").classList.add("hidden");
  document.getElementById("camera-placeholder").classList.remove("hidden");
}

function openLessonWebcam(lessonId) {
  openLesson(lessonId);
  showView("learn");
  setTimeout(() => {
    const detail = document.getElementById("lesson-detail");
    if (detail) {
      detail.classList.remove("hidden");
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 100);
}

function initMediaPipe() {
  if (hands) return;
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

  const placeholder = document.getElementById("camera-placeholder");
  if (placeholder) placeholder.classList.add("hidden");
  
  const btnStart = document.getElementById("btn-start-recognition");
  if (btnStart) btnStart.classList.add("hidden");
  
  const btnStop = document.getElementById("btn-stop-recognition");
  if (btnStop) btnStop.classList.remove("hidden");
  
  updateSigny("neutral");
}

function stopRecognition(silent = false) {
  recognizing = false;
  if (camera) {
    try { camera.stop(); } catch (_) {}
    camera = null;
  }
  
  const placeholder = document.getElementById("camera-placeholder");
  if (placeholder) placeholder.classList.remove("hidden");
  
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

async function onHandResults(results) {
  if (!recognizing) return;
  
  const canvasElement = document.getElementById("student-canvas");
  const ctx = canvasElement.getContext("2d");
  
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
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

      if (st) st.textContent = `✅ ${letter}! Hold... ${Math.max(0, Math.ceil((HOLD_MS - elapsed) / 1000))}s`;

      if (elapsed >= HOLD_MS) {
        stopRecognition(true);
        updateSigny("happy");
        
        if (quizMode === "lesson") {
          await markLessonPassed(quizLessonId, quizTargetLetter);
        } else if (quizMode === "module") {
          moduleExamIndex++;
          if (moduleExamIndex >= ALPHA_LETTERS.length) {
            triggerConfetti();
            showFeedbackTray(true, "🎉 Level Mastered!", "Amazing! You passed the entire Alphabet Exam!");
            const area = document.getElementById("module-quiz-area");
            if (area) area.innerHTML = "";
          } else {
            quizTargetLetter = ALPHA_LETTERS[moduleExamIndex];
            holdStart = null;
            updateHoldRing(0);
            
            const areaTarget = document.getElementById("quiz-module-target-letter");
            const pr = document.getElementById("quiz-module-progress-text");
            if (areaTarget) areaTarget.textContent = quizTargetLetter;
            if (pr) pr.textContent = String(moduleExamIndex + 1);
            
            showFeedbackTray(true, "✅ Correct!", `Now sign: ${quizTargetLetter}`, () => {
              if (st) st.textContent = "Show letter: " + quizTargetLetter;
            });
          }
        }
      }
    } else {
      holdStart = null;
      updateHoldRing(0);
      if (st) st.textContent = "Show " + quizTargetLetter + " (Recognized: " + letter + ")";
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
  
  setTimeout(drawConnectingLine, 350);
}

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
  showView("home");
})();

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

  showFeedbackTray(true, "🎉 Lesson Complete!", "Fantastic! You mastered this sign!", () => {
    stopRecognition(true);
    if (next) {
      document.getElementById("module-quiz-area").innerHTML = `
        <div class="glass-card rounded-2xl p-6 text-center shadow-lg border border-outline-variant/30 max-w-sm mx-auto">
          <span class="material-symbols-outlined text-4xl text-primary animate-bounce">arrow_circle_right</span>
          <h4 class="font-quicksand font-bold text-base text-primary mt-2">Next Node Unlocked</h4>
          <p class="text-xs text-on-surface-variant mt-1 mb-4">You are ready to learn: <strong>${escapeHtml(next.title)}</strong></p>
          <button class="btn-3d w-full bg-primary text-white font-semibold text-xs py-2.5 rounded-lg uppercase" onclick="openLessonPage('${next.id}')">
            Continue Journey
          </button>
        </div>
      `;
      document.getElementById("module-quiz-area").scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      loadLevelContent(currentModule);
    }
  });
}

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
    generateVocabularyQuiz(moduleId);
  }
}

async function generateVocabularyQuiz(moduleId) {
  const area = document.getElementById("module-quiz-area");
  area.innerHTML = `<p class="text-muted text-center py-6">Compiling quiz challenges ...</p>`;

  const lessons = await FSL.api("/lessons?module=" + moduleId);
  if (!lessons.length) {
    area.innerHTML = `<p class="text-xs text-on-surface-variant text-center">No questions available.</p>`;
    return;
  }

  const questions = lessons.map((l) => {
    const wrong = lessons.filter(x => x.id !== l.id).map(x => x.vocab);
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