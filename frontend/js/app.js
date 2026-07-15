/**
 * FSL Learn — shared frontend utilities & API client
 */

const API = "/api";

// ---------- Auth helpers ----------
function getToken() {
  return localStorage.getItem("fsl_token");
}

function getUser() {
  const raw = localStorage.getItem("fsl_user");
  return raw ? JSON.parse(raw) : null;
}

function setAuth(token, user) {
  localStorage.setItem("fsl_token", token);
  localStorage.setItem("fsl_user", JSON.stringify(user));
  if (window.FSL) window.FSL.user = user;
}

function clearAuth() {
  localStorage.removeItem("fsl_token");
  localStorage.removeItem("fsl_user");
}

function requireAuth(role) {
  const user = getUser();
  if (!user || !getToken()) {
    window.location.href = "/login.html";
    return null;
  }
  if (role && user.role !== role) {
    // redirect to correct dashboard
    window.location.href = user.role === "teacher" ? "/teacher.html" : "/student.html";
    return null;
  }
  return user;
}

function logout() {
  clearAuth();
  window.location.href = "/login.html";
}

// ---------- API ----------
async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API + path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail || data.message || `Error ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

// ---------- UI helpers ----------
function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s";
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function $(sel, ctx = document) {
  return ctx.querySelector(sel);
}

function $$(sel, ctx = document) {
  return Array.from(ctx.querySelectorAll(sel));
}

function renderNavbar(user) {
  const nav = $("#navbar-right");
  if (!nav || !user) return;
  nav.innerHTML = `
    <div class="user-menu" style="position:relative;display:flex;align-items:center;gap:0.5rem">
      <div class="user-pill" style="margin:0">
        <div class="avatar">${user.avatar || "U"}</div>
        <span>${user.full_name || user.username}</span>
        <span class="badge-pill" style="margin-left:4px">${user.role}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="nav-hamburger" aria-label="Menu"
        style="font-size:1.35rem;line-height:1;padding:0.35rem 0.6rem;min-width:auto"
        onclick="window.__toggleNavMenu && window.__toggleNavMenu(event)">☰</button>
      <div id="nav-dropdown" class="hidden" style="
        position:absolute;right:0;top:calc(100% + 8px);min-width:180px;z-index:1000;
        background:#fff;border:1px solid #e5eaf0;border-radius:12px;
        box-shadow:0 10px 30px rgba(15,40,70,.12);padding:0.4rem;display:none">
        <button type="button" class="btn btn-ghost btn-block" style="justify-content:flex-start;text-align:left"
          onclick="document.getElementById('nav-dropdown').style.display='none'; if(typeof showView==='function'){ const a=document.querySelector('[data-view=profile]'); showView('profile', a); }">Profile</button>
        <button type="button" class="btn btn-ghost btn-block" style="justify-content:flex-start;text-align:left;color:var(--danger,#c0392b)"
          onclick="logout()">Logout</button>
      </div>
    </div>
  `;
  window.__toggleNavMenu = function (e) {
    e.stopPropagation();
    const dd = document.getElementById("nav-dropdown");
    if (!dd) return;
    const open = dd.style.display === "block";
    dd.style.display = open ? "none" : "block";
    dd.classList.toggle("hidden", open);
  };
  document.addEventListener("click", function () {
    const dd = document.getElementById("nav-dropdown");
    if (dd) { dd.style.display = "none"; dd.classList.add("hidden"); }
  });
}

// 3D tilt effect for cards
function initTilt() {
  $$(".card-3d").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const midX = rect.width / 2;
      const midY = rect.height / 2;
      const rotateY = ((x - midX) / midX) * 6;
      const rotateX = ((midY - y) / midY) * 6;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

// Format date
function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

// Progress color helper
function progressColor(p) {
  if (p >= 70) return "var(--success)";
  if (p >= 40) return "var(--warning)";
  return "var(--primary)";
}

// Expose
// Expose getSignySVG
function getSignySVG(expression = "neutral") {
  let eyes = `<circle cx="44" cy="46" r="4.5" fill="#0b1c30"/><circle cx="64" cy="46" r="4.5" fill="#0b1c30"/><circle cx="45.5" cy="44" r="1.5" fill="#fff"/><circle cx="65.5" cy="44" r="1.5" fill="#fff"/>`;
  let mouth = `<path d="M 48 54 Q 54 60 60 54" fill="none" stroke="#0b1c30" stroke-width="2.5" stroke-linecap="round"/>`;
  let cheeks = `<circle cx="36" cy="50" r="3" fill="#ff8a8a" opacity="0.6"/><circle cx="72" cy="50" r="3" fill="#ff8a8a" opacity="0.6"/>`;
  let accessories = "";
  let animationClass = "animate-hover";

  if (expression === "happy" || expression === "cheering") {
    eyes = `<path d="M 40 48 L 44 44 L 48 48" fill="none" stroke="#0b1c30" stroke-width="3" stroke-linecap="round"/><path d="M 60 48 L 64 44 L 68 48" fill="none" stroke="#0b1c30" stroke-width="3" stroke-linecap="round"/>`;
    mouth = `<path d="M 48 52 Q 54 62 60 52 Z" fill="#ba1a1a" stroke="#0b1c30" stroke-width="2" stroke-linecap="round"/>`;
    accessories = `
      <circle cx="28" cy="24" r="1.5" fill="#ffd700"/>
      <circle cx="78" cy="24" r="1.5" fill="#ffd700"/>
    `;
    animationClass = "animate-bounce-custom";
  } else if (expression === "comforting" || expression === "sad") {
    eyes = `<path d="M 40 44 L 44 48 L 48 44" fill="none" stroke="#0b1c30" stroke-width="3" stroke-linecap="round"/><path d="M 60 44 L 64 48 L 68 44" fill="none" stroke="#0b1c30" stroke-width="3" stroke-linecap="round"/>`;
    mouth = `<path d="M 50 56 Q 54 52 58 56" fill="none" stroke="#0b1c30" stroke-width="2.5" stroke-linecap="round"/>`;
    cheeks = "";
    accessories = `
      <path d="M 72 44 Q 74 46 73 50" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
      <circle cx="73" cy="52" r="1.5" fill="#60a5fa"/>
    `;
    animationClass = "animate-shake-custom";
  }

  return `
    <svg viewBox="0 0 100 100" class="${animationClass}" style="width:72px;height:72px;display:block;margin:0 auto;">
      <defs>
        <style>
          @keyframes hover {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-8px) scale(1.05); }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-3px); }
            75% { transform: translateX(3px); }
          }
          .animate-hover { animation: hover 2.5s ease-in-out infinite; }
          .animate-bounce-custom { animation: bounce 0.6s ease-in-out infinite; }
          .animate-shake-custom { animation: shake 0.4s ease-in-out infinite; }
        </style>
      </defs>
      <!-- Base Hand Body -->
      <path d="M 35 65 C 31 55 33 40 39 32 C 41 29 45 29 47 33 C 49 36 48 45 48 50 C 50 42 53 32 57 30 C 59 29 62 31 63 35 C 64 39 62 48 62 52 C 65 44 68 36 72 35 C 74 34 77 36 77 40 C 77 44 74 52 73 57 C 76 51 80 47 83 48 C 86 49 86 53 85 57 C 83 65 78 78 69 82 C 61 86 49 86 41 80 C 37 76 36 70 35 65 Z" fill="#ffe2c4" stroke="#ffaa66" stroke-width="3" stroke-linejoin="round"/>
      <!-- Thumb -->
      <path d="M 35 65 Q 23 63 25 53 Q 27 47 33 53 Z" fill="#ffe2c4" stroke="#ffaa66" stroke-width="3" stroke-linejoin="round"/>
      <!-- Details -->
      ${cheeks}
      ${eyes}
      ${mouth}
      ${accessories}
    </svg>
  `;
}

// Expose
window.FSL = {
  user: getUser(),
  api,
  getToken,
  getUser,
  setAuth,
  clearAuth,
  requireAuth,
  logout,
  toast,
  $,
  $$,
  renderNavbar,
  initTilt,
  formatDate,
  progressColor,
  getSignySVG,
};
