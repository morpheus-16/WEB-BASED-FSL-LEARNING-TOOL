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
};
