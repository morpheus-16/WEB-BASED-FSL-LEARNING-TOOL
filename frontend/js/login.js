// WebGL background rendering
(function() {
  const canvas = document.getElementById('shader-canvas-ANIMATION_2');
  if (!canvas) return;
  function syncSize() {
    const w = canvas.clientWidth  || 1280;
    const h = canvas.clientHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }
  }
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(syncSize).observe(canvas);
  }
  syncSize();

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;
  const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
  const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;
void main() {
    vec2 uv = v_texCoord;
    vec2 mouse = u_mouse / u_resolution;
    vec3 color1 = vec3(0.145, 0.388, 0.922);
    vec3 color2 = vec3(0.4, 0.8, 0.8);
    vec3 color3 = vec3(0.96, 0.97, 1.0);
    float noise1 = sin(uv.x * 3.0 + u_time * 0.5) * cos(uv.y * 2.0 + u_time * 0.3);
    float noise2 = cos(uv.x * 2.0 - u_time * 0.4) * sin(uv.y * 4.0 + u_time * 0.6);
    float d = length(uv - mouse);
    float glow = 0.05 / (d + 0.05);
    float mixFactor = (noise1 + noise2) * 0.5 + 0.5;
    vec3 baseColor = mix(color1, color2, mixFactor);
    baseColor = mix(baseColor, color3, uv.y);
    vec3 finalColor = baseColor + (glow * color2 * 0.5);
    gl_FragColor = vec4(finalColor, 1.0);
}`;
  function cs(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
  window.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = 1.0 - (event.clientY - rect.top) / rect.height;
      mouse.x = nx * canvas.width;
      mouse.y = ny * canvas.height;
    }
  });
  function render(t) {
    if (typeof ResizeObserver === 'undefined') syncSize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t * 0.001);
    if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render(0);
})();

function switchTab(role) {
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');
  const studentTab = document.getElementById('tab-student');
  const teacherTab = document.getElementById('tab-teacher');

  if (role === 'student') {
    loginForm.classList.remove('hidden-tab');
    regForm.classList.add('hidden-tab');
    
    studentTab.classList.add('tab-active');
    studentTab.classList.remove('text-on-surface-variant');
    
    teacherTab.classList.remove('tab-active');
    teacherTab.classList.add('text-on-surface-variant');
  } else {
    loginForm.classList.add('hidden-tab');
    regForm.classList.remove('hidden-tab');
    
    teacherTab.classList.add('tab-active');
    teacherTab.classList.remove('text-on-surface-variant');
    
    studentTab.classList.remove('tab-active');
    studentTab.classList.add('text-on-surface-variant');
  }
  
  // Interaction feedback
  const container = document.querySelector('.glass-card');
  if (container) {
    container.style.transform = 'scale(0.98)';
    setTimeout(() => {
      container.style.transform = 'scale(1)';
    }, 100);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const btn = e.target.querySelector("button[type=submit]");
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-2">refresh</span> Signing in...';
  try {
    const data = await FSL.api("/auth/login", {
      method: "POST",
      body: { username: fd.get("username"), password: fd.get("password") },
    });
    FSL.setAuth(data.token, data.user);
    FSL.toast("Welcome, " + (data.user.full_name || data.user.username) + "!");
    btn.innerHTML = '<span class="material-symbols-outlined mr-2">check_circle</span> Welcome!';
    btn.classList.replace('bg-primary', 'bg-secondary');
    setTimeout(() => {
      window.location.href = data.user.role === "teacher" ? "/teacher.html" : "/student.html";
    }, 500);
  } catch (err) {
    FSL.toast(err.message, "error");
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const btn = e.target.querySelector("button[type=submit]");
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> Setting up ...';
  try {
    const data = await FSL.api("/auth/register", {
      method: "POST",
      body: {
        username: fd.get("username"),
        password: fd.get("password"),
        email: fd.get("email") || null,
        full_name: fd.get("full_name"),
        role: "teacher",
      },
    });
    FSL.setAuth(data.token, data.user);
    FSL.toast("Teacher account created!");
    btn.innerHTML = '<span class="material-symbols-outlined mr-2">celebration</span> Account Created!';
    setTimeout(() => { window.location.href = "/teacher.html"; }, 600);
  } catch (err) {
    FSL.toast(err.message, "error");
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}
