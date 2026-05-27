/* ============================================================
   DASHBOARD CONTRATACIONES — JS
   Auth centralizada vía portal-auth.js
   ============================================================ */

// Supabase — constantes expuestas por shared/portal-auth.js
const sb = window.supabase.createClient(window.MM_SUPABASE_URL, window.MM_SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true }
});

const ESTADOS = {
  no_iniciado: "No iniciado",
  iniciado:    "Iniciado",
  en_proceso:  "En proceso",
  terminado:   "Terminado"
};

const state = {
  rows: [],
  filter: { search: "", estado: "", agente: "", riesgo: "" },
  soundOn: localStorage.getItem("dash_sound") !== "off",
  channel: null,
  initialLoad: true,
  user: null,
  role: null,
  isDeveloper: false,
  canEdit: false
};

const $ = (id) => document.getElementById(id);

// ─── INIT — autenticación centralizada vía portal-auth.js ─────
(async function () {
  const auth = await window.portalAuth(sb, 'contratos');
  if (!auth) return;

  window.portalAuthWatch(sb);

  state.user = auth.user;
  state.role = auth.profile.role;
  state.isDeveloper = window.portalIsDeveloper(auth.profile);
  // Pueden editar: developer y staff. Owner solo ve.
  state.canEdit = state.isDeveloper || state.role === 'trabajador';

  const display = (state.user?.email || "Conectado").split("@")[0];
  const tag = state.role ? " · " + state.role.charAt(0).toUpperCase() + state.role.slice(1) : "";
  $("userName").textContent = display + tag;

  document.body.classList.toggle("is-developer", state.isDeveloper);
  document.body.classList.toggle("is-readonly", !state.canEdit);

  loadRows();
  subscribeRealtime();
})();

// Logout — el login lo gestiona el portal
$("logoutBtn").addEventListener("click", async () => {
  if (state.channel) await sb.removeChannel(state.channel);
  await sb.auth.signOut();
  state.rows = []; state.user = null;
  window.location.reload();
});

// Volver al panel sin cerrar sesión
const _volverBtn = $("volverPanelBtn");
if (_volverBtn) _volverBtn.addEventListener("click", () => {
  try { window.top.location.href = "../index.html"; }
  catch (e) { window.location.href = "../index.html"; }
});

async function loadRows() {
  setLive(true, "Cargando…");
  const { data, error } = await sb
    .from("contrataciones").select("*")
    .order("created_at", { ascending: false }).limit(300);
  if (error) { console.error(error); setLive(false, "Error"); $("tbody").innerHTML = '<tr><td colspan="8" class="empty">Error al cargar</td></tr>'; return; }
  state.rows = data || [];
  setLive(true, "Conectado");
  refreshAgenteFilter();
  render();
  state.initialLoad = false;
}

// ─── REALTIME ──────────────────────────────────────────────
function subscribeRealtime() {
  state.channel = sb.channel("contrataciones-rt")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "contrataciones" }, (p) => {
      if (state.rows.some(r => r.id === p.new.id)) return;
      state.rows.unshift(p.new);
      refreshAgenteFilter(); render(p.new.id);
      if (!state.initialLoad) { showToast(p.new); if (state.soundOn) playDing(); }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "contrataciones" }, (p) => {
      const i = state.rows.findIndex(r => r.id === p.new.id);
      if (i >= 0) { state.rows[i] = p.new; render(); }
    })
    .subscribe((st) => {
      if (st === "SUBSCRIBED") setLive(true, "Conectado");
      if (["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(st)) setLive(false, "Desconectado");
    });
}
function setLive(on, text) {
  const b = $("liveBadge");
  b.classList.toggle("off", !on);
  b.querySelector("span:last-child").textContent = text;
}

// ─── RENDER ────────────────────────────────────────────────
function render(highlightId = null) {
  const filtered = applyFilters(state.rows);

  $("statTotal").textContent      = state.rows.length;
  $("statNoIniciado").textContent = state.rows.filter(r => r.estado === "no_iniciado").length;
  $("statIniciado").textContent   = state.rows.filter(r => r.estado === "iniciado").length;
  $("statProceso").textContent    = state.rows.filter(r => r.estado === "en_proceso").length;
  $("statTerminado").textContent  = state.rows.filter(r => r.estado === "terminado").length;

  const tbody = $("tbody");
  if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="empty">Sin resultados</td></tr>'; return; }

  tbody.innerHTML = filtered.map(r => `
    <tr data-id="${r.id}" class="${r.id === highlightId ? "new-row" : ""}">
      <td class="cell-date">${formatDate(r.created_at)}</td>
      <td><div class="cell-primary">${esc(r.nombre)}</div><div class="cell-muted">${esc(r.dni || "—")}</div></td>
      <td><div>${esc(r.telefono || "—")}</div><div class="cell-muted">${esc(r.email || "—")}</div></td>
      <td>${esc(r.tarifa || "—")}</td>
      <td><span class="badge badge-${esc(r.estado)}">${ESTADOS[r.estado] || r.estado}</span></td>
      <td class="cell-agente ${r.agente ? "" : "none"}">${esc(r.agente || "Sin asignar")}</td>
      <td>${r.riesgo ? '<span class="badge badge-riesgo">⚠ Riesgo</span>' : '<span class="badge badge-ok">OK</span>'}</td>
      <td><button class="btn-row">Gestionar</button></td>
    </tr>`).join("");

  tbody.querySelectorAll("tr").forEach(tr => tr.addEventListener("click", () => openModal(tr.dataset.id)));
}

function applyFilters(rows) {
  const q = state.filter.search.toLowerCase();
  return rows.filter(r => {
    if (state.filter.estado && r.estado !== state.filter.estado) return false;
    if (state.filter.agente && r.agente !== state.filter.agente) return false;
    if (state.filter.riesgo !== "" && String(r.riesgo) !== state.filter.riesgo) return false;
    if (q) { const hay = [r.nombre, r.dni, r.telefono, r.email].join(" ").toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  });
}

function refreshAgenteFilter() {
  const sel = $("filterAgente");
  const current = sel.value;
  const agentes = [...new Set(state.rows.map(r => r.agente).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todos los agentes</option>' + agentes.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join("");
  sel.value = current;
}

$("searchInput").addEventListener("input", e => { state.filter.search = e.target.value; render(); });
$("filterEstado").addEventListener("change", e => { state.filter.estado = e.target.value; syncStatCards(); render(); });
$("filterAgente").addEventListener("change", e => { state.filter.agente = e.target.value; render(); });
$("filterRiesgo").addEventListener("change", e => { state.filter.riesgo = e.target.value; render(); });
$("refreshBtn").addEventListener("click", () => loadRows());

// Stat cards clicables → filtran por estado
document.querySelectorAll(".stat-card").forEach(card => {
  card.addEventListener("click", () => {
    state.filter.estado = card.dataset.estado;
    $("filterEstado").value = card.dataset.estado;
    syncStatCards(); render();
  });
});
function syncStatCards() {
  document.querySelectorAll(".stat-card").forEach(c => c.classList.toggle("active", c.dataset.estado === state.filter.estado && state.filter.estado !== ""));
}

// ─── MODAL ─────────────────────────────────────────────────
let currentRow = null;
async function openModal(id) {
  const r = state.rows.find(x => x.id === id);
  if (!r) return;
  currentRow = r;

  $("modalTitle").textContent = r.nombre + (r.riesgo ? " ⚠" : "");
  $("modalEstado").value = r.estado || "no_iniciado";
  $("modalAgente").value = r.agente || "";
  $("modalNotas").value = r.notas_internas || "";

  // Permisos según rol
  const agenteInput = $("modalAgente");
  const estadoSel   = $("modalEstado");
  const notasArea   = $("modalNotas");

  if (!state.canEdit) {
    // OWNER (Fran): solo lectura, todo bloqueado
    estadoSel.setAttribute("disabled", "disabled");
    agenteInput.setAttribute("readonly", "readonly");
    notasArea.setAttribute("readonly", "readonly");
    agenteInput.title = "Solo lectura";
    $("modalSave").style.display = "none";
    $("modalDelete").style.display = "none";
  } else {
    estadoSel.removeAttribute("disabled");
    notasArea.removeAttribute("readonly");
    $("modalSave").style.display = "inline-flex";
    if (state.isDeveloper) {
      // DEVELOPER (Jaime): reasigna agente + puede borrar
      agenteInput.removeAttribute("readonly");
      agenteInput.title = "";
      $("modalDelete").style.display = "inline-flex";
    } else {
      // TRABAJADOR: gestiona estado; agente solo si está libre (autoasignarse)
      if (r.agente) { agenteInput.setAttribute("readonly", "readonly"); agenteInput.title = "Solo un developer puede reasignar"; }
      else { agenteInput.removeAttribute("readonly"); agenteInput.title = ""; }
      $("modalDelete").style.display = "none";
    }
  }

  const docs = await Promise.all([signedUrl(r.dni_frontal_path), signedUrl(r.dni_trasero_path), signedUrl(r.cuenta_path)]);
  const rows = [
    ["Fecha alta", formatDate(r.created_at)],
    ["Tarifa", r.tarifa], ["Precio", r.precio], ["Precio total", calcularPrecioTotal(r)], ["Extras", r.extras],
    ["DNI", r.dni], ["F. Nacimiento", r.fecha_nac], ["Teléfono", r.telefono], ["Email", r.email],
    ["Línea 1 (principal)", r.movil_info], ["Líneas incluidas", r.lineas_incluidas], ["Líneas adicionales", r.lineas],
    ["Dirección envío", r.envio_dir], ["Dirección fibra", r.fibra_dir],
    ["CUPS luz", r.cups_luz], ["Alarma", r.alarma], ["IBAN", r.iban],
    ["Riesgo", r.riesgo ? "⚠ SÍ — revisión manual" : "OK"],
    ["Sin documentación", r.sin_doc ? "SÍ" : "NO"],
    ["Distribuidor", r.distribuidor ? `SÍ (${r.cod_distribuidor || "—"})` : "NO"],
    ["Observaciones", r.observaciones],
    ["DNI frontal", docs[0] ? `<a href="${docs[0]}" target="_blank">Abrir documento</a>` : "—"],
    ["DNI trasero", docs[1] ? `<a href="${docs[1]}" target="_blank">Abrir documento</a>` : "—"],
    ["Cuenta bancaria", docs[2] ? `<a href="${docs[2]}" target="_blank">Abrir documento</a>` : "—"]
  ];
  $("modalBody").innerHTML = '<div class="modal-grid">' + rows.map(([k,v]) => `<div class="modal-row"><label>${k}</label><span>${v || "—"}</span></div>`).join("") + "</div>";

  loadHistorial(id);
  $("modal").style.display = "flex";
}

async function signedUrl(path) {
  if (!path) return null;
  const { data, error } = await sb.storage.from("contrataciones-docs").createSignedUrl(path, 600);
  if (error) { console.error(error); return null; }
  return data.signedUrl;
}

async function loadHistorial(id) {
  const { data } = await sb.from("contrataciones_historial").select("*").eq("contratacion_id", id).order("created_at", { ascending: false });
  if (!data || data.length === 0) { $("historialBody").innerHTML = "Sin cambios registrados."; return; }
  $("historialBody").innerHTML = data.map(h => `
    <div class="hist-item">
      <div><strong>${esc(h.campo)}</strong>: ${esc(h.valor_anterior || "—")} → ${esc(h.valor_nuevo || "—")}</div>
      <div class="hist-meta">${esc(h.usuario_email || "?")} · ${formatDate(h.created_at)}</div>
    </div>`).join("");
}

$("modalClose").addEventListener("click", () => { $("modal").style.display = "none"; });
$("modal").addEventListener("click", e => { if (e.target === $("modal")) $("modal").style.display = "none"; });

$("modalSave").addEventListener("click", async () => {
  if (!currentRow) return;
  const id = currentRow.id;
  const nuevoEstado = $("modalEstado").value;
  const nuevoAgente = $("modalAgente").value.trim() || null;
  const nuevasNotas = $("modalNotas").value.trim() || null;

  const btn = $("modalSave");
  btn.disabled = true; btn.textContent = "Guardando…";

  // Registrar cambios en historial
  const cambios = [];
  if (nuevoEstado !== currentRow.estado) cambios.push({ campo: "estado", valor_anterior: currentRow.estado, valor_nuevo: nuevoEstado });
  if (nuevoAgente !== (currentRow.agente || null)) cambios.push({ campo: "agente", valor_anterior: currentRow.agente, valor_nuevo: nuevoAgente });

  const { error } = await sb.from("contrataciones")
    .update({ estado: nuevoEstado, agente: nuevoAgente, agente_id: state.user?.id || null, notas_internas: nuevasNotas })
    .eq("id", id);

  if (!error && cambios.length) {
    await sb.from("contrataciones_historial").insert(
      cambios.map(c => ({ contratacion_id: id, usuario_email: state.user?.email, ...c }))
    );
  }

  btn.disabled = false; btn.textContent = "Guardar cambios";
  if (error) { alert("Error: " + error.message); return; }
  $("modal").style.display = "none";
});

// Borrar contratación (solo developer)
$("modalDelete").addEventListener("click", async () => {
  if (!currentRow || !state.isDeveloper) return;
  if (!confirm(`¿Borrar la contratación de ${currentRow.nombre}? Esta acción no se puede deshacer.`)) return;
  const { error } = await sb.from("contrataciones").delete().eq("id", currentRow.id);
  if (error) { alert("Error al borrar: " + error.message); return; }
  state.rows = state.rows.filter(r => r.id !== currentRow.id);
  render();
  $("modal").style.display = "none";
});

// ─── TOAST + SONIDO ────────────────────────────────────────
function showToast(row) {
  const t = document.createElement("div");
  t.className = "toast" + (row.riesgo ? " risk" : "");
  t.innerHTML = `<div class="toast-title">${row.riesgo ? "🚨" : "🟢"} Nueva contratación</div>
    <div class="toast-body"><strong>${esc(row.nombre)}</strong> — ${esc(row.tarifa || "Sin tarifa")}</div>
    <div class="toast-meta">${esc(row.telefono || "")} · ${esc(row.precio || "")}</div>`;
  t.addEventListener("click", () => { openModal(row.id); t.classList.add("leaving"); setTimeout(() => t.remove(), 300); });
  $("toastContainer").appendChild(t);
  setTimeout(() => { t.classList.add("leaving"); setTimeout(() => t.remove(), 300); }, 8000);
}
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}
$("toggleSound").addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  localStorage.setItem("dash_sound", state.soundOn ? "on" : "off");
  $("toggleSound").classList.toggle("muted", !state.soundOn);
  $("toggleSound").textContent = state.soundOn ? "🔔" : "🔕";
});
if (!state.soundOn) { $("toggleSound").classList.add("muted"); $("toggleSound").textContent = "🔕"; }

// ─── TEMA CLARO / OSCURO ───────────────────────────────────
function applyTheme(theme) {
  const light = theme === "light";
  document.body.classList.toggle("light-mode", light);
  $("toggleTheme").textContent = light ? "☀️" : "🌙";
  $("toggleTheme").title = light ? "Cambiar a oscuro" : "Cambiar a claro";
}
$("toggleTheme").addEventListener("click", () => {
  const next = document.body.classList.contains("light-mode") ? "dark" : "light";
  localStorage.setItem("dash_theme", next);
  applyTheme(next);
});
// Aplicar el tema guardado al arrancar (por defecto oscuro)
applyTheme(localStorage.getItem("dash_theme") || "dark");

// ─── HELPERS ───────────────────────────────────────────────
function esc(s) { if (s == null) return ""; return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

// Calcula precio total = precio base + suma de números (€) hallados en extras y líneas.
// Si algún extra es "según consumo" (sin número), añade " +" para indicar extras variables.
function calcularPrecioTotal(r) {
  function num(str) {
    if (!str) return 0;
    var total = 0;
    // Captura cifras tipo 19,95€ / 10€ / 5.00€ y también 5/mes / 8/mes (líneas adicionales sin símbolo €)
    var matches = String(str).match(/(\d+[.,]?\d*)\s*(?:€|\/mes)/g) || [];
    matches.forEach(function(m) {
      var n = m.replace(/[€]|\/mes/g, "").replace(",", ".").trim();
      total += parseFloat(n) || 0;
    });
    return total;
  }
  function hayVariable(str) {
    return str && /seg[uú]n consumo/i.test(str);
  }
  var base = num(r.precio);
  var extras = num(r.extras);
  var lineas = num(r.lineas);
  var total = base + extras + lineas;
  if (total === 0) return r.precio || "—";
  var str = total.toFixed(2).replace(".", ",") + "€/mes";
  // Si hay componentes "según consumo" no contabilizados, marcarlo
  if (hayVariable(r.extras) || hayVariable(r.precio) || hayVariable(r.lineas)) {
    str += " + (según consumo)";
  }
  return str;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day:"2-digit", month:"2-digit", year:"numeric" }) + " " + d.toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" });
}

