// Detectar móvil para mostrar botón de cámara solo en dispositivos táctiles
(function () {
  var ua = navigator.userAgent;
  var mobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Mac/.test(ua) === false);
  if (mobile) document.body.classList.add("is-mobile");
})();

let selectedTariff = null;
let formDataSnapshot = {}; // Snapshot de datos al llegar al resumen
let incofisaResult = null;
let incofisaTitularResult = null;
let movilMode = "porta"; // porta | alta | cambio
const TOTAL_STEPS = 5;

// ---- TARIFF SELECTION & UPSELL ----
// Datos
var UPSELL_MAIN = [
  {
    id: "fibra",
    label: "Fibra optica",
    sub: "Desde 21,95/mes - FTTH",
    tipos: ["movil", "alarma", "energia-luz", "energia-solar", "energia-gas"],
  },
  {
    id: "movil",
    label: "Movil adicional",
    sub: "Desde 5/mes - 5G",
    tipos: [
      "fibra",
      "pack",
      "pack-tv",
      "alarma",
      "energia-luz",
      "energia-solar",
      "energia-gas",
    ],
  },
  {
    id: "alarma",
    label: "Alarma hogar",
    sub: "19,95/mes (3m) luego 39,95/mes",
    tipos: ["movil", "fibra", "pack", "pack-tv", "energia-luz", "energia-gas"],
  },
  {
    id: "tv",
    label: "Television",
    sub: "Desde 2/mes",
    tipos: ["movil", "fibra", "pack", "alarma", "energia-luz", "energia-gas"],
  },
  {
    id: "energia",
    label: "Energia del hogar",
    sub: "Luz, solar o gas · precio según consumo",
    tipos: ["movil", "fibra", "pack", "pack-tv", "alarma"],
  },
];
var UPSELL_TV = [
  {
    id: "tv-esencial",
    label: "TV Esencial",
    price: "2/mes",
    desc: "Canales basicos + La Liga Hypermotion",
  },
  {
    id: "tv-deportes",
    label: "TV Deportes",
    price: "5/mes",
    desc: "Futbol, motor, deportes en directo",
  },
  {
    id: "tv-total",
    label: "TV Total",
    price: "10/mes",
    desc: "Todo el catalogo de canales",
  },
  {
    id: "tv-2rfef",
    label: "Football Club 2a RFEF",
    price: "5/mes",
    desc: "Segunda Federacion completa",
  },
  {
    id: "tv-1rfef",
    label: "Football Club 1a RFEF",
    price: "10/mes",
    desc: "Primera Federacion completa",
  },
];
var UPSELL_MOVIL = [
  {
    id: "movil-100gb",
    label: "100GB 5G",
    price: "5/mes",
    desc: "100GB - Llamadas ilimitadas - Red 5G",
  },
  {
    id: "movil-ilim",
    label: "Ilimitado 5G",
    price: "8/mes",
    desc: "Llamadas y GB ilimitados - Red 5G",
  },
];

var upsellSel = {}; // { id: true/false }
var upsellExtras = [];
var pendingCard = null;
var upsellPhase = "main"; // main | tv | movil | solar-gas
var tvSel = null; // compat
var tvSels = []; // array: [tv-base?, tv-2rfef?, tv-1rfef?]
var movilAddSel = null;

// Etiquetas reales con unicode (separadas de los IDs para evitar problemas en templates)
var LABELS = {
  fibra: "Fibra \u00F3ptica",
  movil: "M\u00F3vil adicional",
  alarma: "Alarma hogar",
  tv: "Televisi\u00F3n",
  "tv-esencial": "TV Esencial",
  "tv-deportes": "TV Deportes",
  "tv-total": "TV Total",
  "tv-2rfef": "Football Club 2\u00AA RFEF",
  "tv-1rfef": "Football Club 1\u00AA RFEF",
  "movil-100gb": "100GB 5G",
  "movil-ilim": "Ilimitado 5G",
  energia: "Energía del hogar",
  "energia-luz": "Plan Luz Hogar",
  "energia-solar": "Plan Solar",
  "energia-gas": "Plan Luz y Gas",
};
var PRICES = {
  "tv-esencial": "2\u20AC/mes",
  "tv-deportes": "5\u20AC/mes",
  "tv-total": "10\u20AC/mes",
  "tv-2rfef": "5\u20AC/mes",
  "tv-1rfef": "10\u20AC/mes",
  "movil-100gb": "5\u20AC/mes",
  "movil-ilim": "8\u20AC/mes",
  alarma: "19,95\u20AC/mes",
  fibra: "21,95\u20AC/mes",
};
var PRICES_NUM = {
  "tv-esencial": 2,
  "tv-deportes": 5,
  "tv-total": 10,
  "tv-2rfef": 5,
  "tv-1rfef": 10,
  "movil-100gb": 5,
  "movil-ilim": 8,
  alarma: 19.95,
  fibra: 21.95,
};

function selectTariff(card) {
  pendingCard = {
    name: card.getAttribute("data-name"),
    price: parseFloat(card.getAttribute("data-price")),
    tipo: card.getAttribute("data-tipo"),
    lineasIncluidas: parseInt(card.getAttribute("data-lineas") || "0", 10),
  };
  upsellStart();
}

function upsellStart() {
  upsellSel = {};
  upsellExtras = [];
  tvSel = null;
  tvSels = [];
  movilAddSel = null;
  var t = pendingCard;
  // Toda tarifa de energia directa: primero elegir variante
  if (
    t.tipo === "energia-luz" ||
    t.tipo === "energia-solar" ||
    t.tipo === "energia-gas"
  ) {
    upsellShowVarianteEnergia();
    return;
  }
  // Filtrar opciones disponibles
  var opts = UPSELL_MAIN.filter(function (o) {
    return o.tipos.indexOf(t.tipo) >= 0;
  });
  if (!opts.length) {
    upsellApply([]);
    return;
  }
  upsellRenderMain(opts);
  upsellOpen();
}

function upsellRenderMain(opts) {
  upsellPhase = "main";
  var optsEl = upsellEl("upsell-opts");
  if (optsEl) optsEl.classList.remove("upsell-options--3col");
  var t = pendingCard;
  var priceStr =
    t.price > 0
      ? t.price.toFixed(2).replace(".", ",") + "\u20AC/mes"
      : "Precio seg\u00FAn consumo";
  upsellEl("modal-pname").textContent = t.name;
  upsellEl("modal-ptag").textContent = t.name + " \u00B7 " + priceStr;
  upsellEl("modal-ptag").style.display = "block";

  var html = "";
  for (var i = 0; i < opts.length; i++) {
    var o = opts[i];
    html += '<div class="upsell-opt" data-uid="' + o.id + '">';
    html += '<div class="upsell-check"></div>';
    html +=
      '<div class="upsell-opt__label">' + (LABELS[o.id] || o.label) + "</div>";
    html += '<div class="upsell-opt__sub">' + o.sub + "</div>";
    html += "</div>";
  }
  upsellEl("upsell-opts").innerHTML = html;

  upsellEl("modal-btn-yes").style.display = "block";
  upsellEl("modal-btn-no").style.display = "block";
  upsellEl("modal-btn-no").textContent = "Solo lo elegido";
  upsellEl("modal-btn-no").setAttribute("data-action", "skip");
  upsellRefreshBtn();
}

function upsellShowTV() {
  upsellPhase = "tv";
  var optsEl = upsellEl("upsell-opts");
  if (optsEl) optsEl.classList.remove("upsell-options--3col");
  tvSels = [];
  upsellEl("modal-pname").textContent = "Televisi\u00F3n";
  upsellEl("modal-ptag").textContent =
    "Elige tu paquete — puedes combinar TV + Football Club";
  upsellEl("modal-ptag").style.display = "block";

  var TV_BASE = ["tv-esencial", "tv-deportes", "tv-total"];
  var TV_FOOT = ["tv-2rfef", "tv-1rfef"];

  var html = "";
  // Separador TV base
  html +=
    '<div style="grid-column:1/-1;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.35);padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:2px;">Paquete TV — elige uno</div>';
  for (var i = 0; i < UPSELL_TV.length; i++) {
    var o = UPSELL_TV[i];
    if (TV_FOOT.indexOf(o.id) >= 0) continue;
    html +=
      '<div class="upsell-opt" data-uid="' + o.id + '" data-tv-group="base">';
    html += '<div class="upsell-check"></div>';
    html +=
      '<div class="upsell-opt__label">' +
      (LABELS[o.id] || o.label) +
      ' <strong style="color:var(--accent-light)">' +
      (PRICES[o.id] || o.price) +
      "</strong></div>";
    html += '<div class="upsell-opt__sub">' + o.desc + "</div>";
    html += "</div>";
  }
  // Separador Football Club
  html +=
    '<div style="grid-column:1/-1;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.35);padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.08);margin-top:8px;margin-bottom:2px;">Football Club — opcional, se puede añadir con TV o solo</div>';
  for (var j = 0; j < UPSELL_TV.length; j++) {
    var o2 = UPSELL_TV[j];
    if (TV_FOOT.indexOf(o2.id) < 0) continue;
    html +=
      '<div class="upsell-opt" data-uid="' + o2.id + '" data-tv-group="foot">';
    html += '<div class="upsell-check"></div>';
    html +=
      '<div class="upsell-opt__label">' +
      (LABELS[o2.id] || o2.label) +
      ' <strong style="color:var(--accent-light)">' +
      (PRICES[o2.id] || o2.price) +
      "</strong></div>";
    html += '<div class="upsell-opt__sub">' + o2.desc + "</div>";
    html += "</div>";
  }

  upsellEl("upsell-opts").innerHTML = html;
  upsellEl("modal-btn-yes").textContent = "Selecciona al menos una opci\u00F3n";
  upsellEl("modal-btn-yes").disabled = true;
  upsellEl("modal-btn-yes").style.display = "block";
  upsellEl("modal-btn-no").textContent = "\u2190 Volver";
  upsellEl("modal-btn-no").setAttribute("data-action", "back");
}

function tvRefreshBtn() {
  var ok = tvSels.length > 0;
  upsellEl("modal-btn-yes").disabled = !ok;
  if (ok) {
    var total = tvSels.reduce(function (acc, id) {
      var m = (PRICES[id] || "").match(/([0-9]+)/);
      return acc + (m ? parseInt(m[1]) : 0);
    }, 0);
    upsellEl("modal-btn-yes").textContent =
      "Confirmar (" +
      tvSels.length +
      " seleccionado" +
      (tvSels.length > 1 ? "s" : "") +
      " · " +
      total +
      "\u20AC/mes) \u2192";
  } else {
    upsellEl("modal-btn-yes").textContent =
      "Selecciona al menos una opci\u00F3n";
  }
}

function upsellShowMovilAdd() {
  upsellPhase = "movil";
  upsellEl("modal-pname").textContent = "M\u00F3vil adicional";
  upsellEl("modal-ptag").textContent = "Elige tu tarifa";
  upsellEl("modal-ptag").style.display = "block";

  var html = "";
  for (var i = 0; i < UPSELL_MOVIL.length; i++) {
    var o = UPSELL_MOVIL[i];
    html +=
      '<div class="upsell-opt upsell-opt--single" data-uid="' + o.id + '">';
    html += '<div class="upsell-check"></div>';
    html +=
      '<div class="upsell-opt__label">' +
      (LABELS[o.id] || o.label) +
      ' <strong style="color:var(--accent-light)">' +
      (PRICES[o.id] || o.price) +
      "</strong></div>";
    html += '<div class="upsell-opt__sub">' + o.desc + "</div>";
    html += "</div>";
  }
  upsellEl("upsell-opts").innerHTML = html;
  upsellEl("modal-btn-yes").textContent = "Selecciona una opci\u00F3n";
  upsellEl("modal-btn-yes").disabled = true;
  upsellEl("modal-btn-yes").style.display = "block";
  if (pendingLineaAdd) {
    upsellEl("modal-pname").textContent = "L\u00EDnea adicional";
    upsellEl("modal-ptag").textContent =
      "Elige la tarifa para la nueva l\u00EDnea";
    upsellEl("modal-btn-no").textContent = "Cancelar";
  } else {
    upsellEl("modal-btn-no").textContent = "\u2190 Volver";
  }
  upsellOpen();
}

function upsellShowSolarGas() {
  upsellPhase = "solar-gas";
  upsellEl("modal-pname").textContent = "Plan Solar";
  upsellEl("modal-ptag").textContent = "Una \u00FAltima pregunta...";
  upsellEl("modal-ptag").style.display = "block";

  var html =
    '<div style="grid-column:1/-1;font-size:.85rem;color:rgba(255,255,255,.65);line-height:1.65;margin-bottom:8px;">';
  html +=
    'Con el Plan Solar tambi\u00E9n puedes a\u00F1adir <strong style="color:#fff">gas natural</strong> con tarifa personalizada seg\u00FAn el tipo de acceso. \u00BFTienes tambi\u00E9n gas?</div>';
  html +=
    '<div class="upsell-opt" data-uid="gas-si"><div class="upsell-check"></div><div class="upsell-opt__label">S\u00ED, tengo gas</div><div class="upsell-opt__sub">A\u00F1adir tarifa gas personalizada</div></div>';
  html +=
    '<div class="upsell-opt" data-uid="gas-no"><div class="upsell-check"></div><div class="upsell-opt__label">No, solo electricidad</div><div class="upsell-opt__sub">Continuar solo con Plan Solar</div></div>';
  upsellEl("upsell-opts").innerHTML = html;
  upsellEl("modal-btn-yes").style.display = "none";
  upsellEl("modal-btn-no").style.display = "none";
  upsellOpen();
}

function upsellShowVarianteEnergia() {
  upsellPhase = "variante-energia";
  upsellEl("modal-pname").textContent = "Energía del hogar";
  upsellEl("modal-ptag").textContent = "¿Qué tipo de energía necesitas?";
  upsellEl("modal-ptag").style.display = "block";
  var presel = pendingCard.tipo;
  function mkOpt(uid, icon, label, sub) {
    var s = presel === uid;
    var html =
      '<div class="upsell-opt' +
      (s ? " checked" : "") +
      '" data-uid="' +
      uid +
      '">';
    html += '<div class="upsell-check">' + (s ? "✓" : "") + "</div>";
    html += '<div class="upsell-opt__icon">' + icon + "</div>";
    html += '<div class="upsell-opt__label">' + label + "</div>";
    html += '<div class="upsell-opt__sub">' + sub + "</div></div>";
    return html;
  }
  var html =
    '<div style="grid-column:1/-1;font-size:.83rem;color:rgba(255,255,255,.6);line-height:1.6;margin-bottom:6px;">Confirma o cambia el tipo de energía.</div>';
  html += mkOpt(
    "energia-luz",
    "⚡",
    "Plan Luz Hogar",
    "Tarifa eléctrica según consumo",
  );
  html += mkOpt(
    "energia-solar",
    "☀&#xFE0F;",
    "Plan Solar",
    "Autoconsumo solar + red",
  );
  html += mkOpt(
    "energia-gas",
    "&#x1F525;",
    "Plan Luz y Gas",
    "Electricidad + gas natural",
  );
  upsellEl("upsell-opts").innerHTML = html;
  upsellEl("modal-btn-yes").style.display = "block";
  upsellEl("modal-btn-yes").disabled = false;
  upsellEl("modal-btn-yes").textContent = "Confirmar y continuar →";
  upsellEl("modal-btn-no").style.display = "none";
  upsellOpen();
}

function upsellShowEnergia() {
  upsellPhase = "energia";
  var optsEl = upsellEl("upsell-opts");
  if (optsEl) {
    optsEl.classList.add("upsell-options--3col");
  }
  upsellEl("modal-pname").textContent = "Energía del hogar";
  upsellEl("modal-ptag").textContent = "¿Qué tipo de energía necesitas?";
  upsellEl("modal-ptag").style.display = "block";
  var html =
    '<div style="grid-column:1/-1;font-size:.83rem;color:rgba(255,255,255,.6);line-height:1.6;margin-bottom:6px;">Elige el plan que quieres contratar junto a tu servicio.</div>';
  html +=
    '<div class="upsell-opt" data-uid="energia-luz"><div class="upsell-check"></div><div class="upsell-opt__icon">⚡</div><div class="upsell-opt__label">Plan Luz Hogar</div><div class="upsell-opt__sub">Tarifa eléctrica según consumo</div></div>';
  html +=
    '<div class="upsell-opt" data-uid="energia-solar"><div class="upsell-check"></div><div class="upsell-opt__icon">☀</div><div class="upsell-opt__label">Plan Solar</div><div class="upsell-opt__sub">Autoconsumo solar + red</div></div>';
  html +=
    '<div class="upsell-opt" data-uid="energia-gas"><div class="upsell-check"></div><div class="upsell-opt__icon">🔥</div><div class="upsell-opt__label">Plan Luz y Gas</div><div class="upsell-opt__sub">Electricidad + gas natural</div></div>';
  upsellEl("upsell-opts").innerHTML = html;
  upsellEl("modal-btn-yes").style.display = "none";
  upsellEl("modal-btn-no").style.display = "block";
  upsellEl("modal-btn-no").textContent = "No necesito energía";
  upsellEl("modal-btn-no").setAttribute("data-action", "skip");
  upsellOpen();
}

// Event delegation central — UN solo listener en el overlay
function upsellInitEvents() {
  var overlay = upsellEl("upsell-overlay");
  if (!overlay) return;

  upsellEl("modal-close").addEventListener("click", function () {
    upsellClose();
  });
  upsellEl("modal-btn-yes").addEventListener("click", function () {
    upsellConfirm();
  });
  upsellEl("modal-btn-no").addEventListener("click", function () {
    upsellCancel();
  });

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      upsellClose();
      return;
    }

    // Click en opcion upsell
    var opt = e.target.closest(".upsell-opt");
    if (!opt) return;
    var uid = opt.getAttribute("data-uid");
    if (!uid) return;

    if (upsellPhase === "main") {
      // Toggle para todos los opts (incluyendo energia — el submodal se abre en upsellConfirm)
      if (upsellSel[uid]) {
        delete upsellSel[uid];
        opt.classList.remove("checked");
        opt.querySelector(".upsell-check").textContent = "";
      } else {
        upsellSel[uid] = true;
        opt.classList.add("checked");
        opt.querySelector(".upsell-check").textContent = "\u2713";
      }
      upsellRefreshBtn();
    } else if (upsellPhase === "tv") {
      var group = opt.getAttribute("data-tv-group");
      var TV_BASE = ["tv-esencial", "tv-deportes", "tv-total"];
      var TV_FOOT = ["tv-2rfef", "tv-1rfef"];

      if (group === "base") {
        // Single select entre las bases: deseleccionar otras bases
        overlay
          .querySelectorAll('.upsell-opt[data-tv-group="base"]')
          .forEach(function (el) {
            el.classList.remove("checked");
            var ck = el.querySelector(".upsell-check");
            if (ck) ck.textContent = "";
          });
        // Quitar del array cualquier base
        tvSels = tvSels.filter(function (id) {
          return TV_FOOT.indexOf(id) >= 0;
        });
        // Toggle: si ya estaba seleccionado, deseleccionar; si no, seleccionar
        var wasSelected = tvSels.indexOf(uid) >= 0;
        if (!wasSelected) {
          opt.classList.add("checked");
          opt.querySelector(".upsell-check").textContent = "\u2713";
          tvSels.push(uid);
        }
      } else if (group === "foot") {
        // Multi-select libre para Football Club
        var idx = tvSels.indexOf(uid);
        if (idx >= 0) {
          tvSels.splice(idx, 1);
          opt.classList.remove("checked");
          opt.querySelector(".upsell-check").textContent = "";
        } else {
          tvSels.push(uid);
          opt.classList.add("checked");
          opt.querySelector(".upsell-check").textContent = "\u2713";
        }
      }
      tvSel = tvSels[0] || null; // compat legacy
      tvRefreshBtn();
    } else if (upsellPhase === "movil") {
      overlay.querySelectorAll(".upsell-opt").forEach(function (el) {
        el.classList.remove("checked");
        var ck = el.querySelector(".upsell-check");
        if (ck) ck.textContent = "";
      });
      opt.classList.add("checked");
      opt.querySelector(".upsell-check").textContent = "\u2713";
      movilAddSel = uid;
      upsellEl("modal-btn-yes").disabled = false;
      upsellEl("modal-btn-yes").textContent = "Confirmar \u2192";
    } else if (upsellPhase === "variante-energia") {
      opt
        .closest(".upsell-options")
        .querySelectorAll(".upsell-opt")
        .forEach(function (x) {
          x.classList.remove("checked");
          x.querySelector(".upsell-check").textContent = "";
        });
      opt.classList.add("checked");
      opt.querySelector(".upsell-check").textContent = "✓";
      pendingCard = { name: LABELS[uid] || uid, price: 0, tipo: uid };
      return;
    } else if (upsellPhase === "energia") {
      // Single select variante: luz, solar o gas
      opt
        .closest(".upsell-options")
        .querySelectorAll(".upsell-opt")
        .forEach(function (x) {
          x.classList.remove("checked");
        });
      opt.classList.add("checked");
      // Guardar la variante y continuar el flujo (puede quedar movil u otros pasos)
      upsellSel["_energiaTipo"] = uid;
      upsellPhase = "main";
      upsellConfirm();
      return;
    } else if (upsellPhase === "solar-gas") {
      if (uid === "gas-si") {
        upsellClose();
        upsellApply([
          {
            id: "gas-solar",
            label: "Gas natural",
            price: "Tarifa personalizada",
          },
        ]);
      } else {
        upsellClose();
        upsellApply([]);
      }
    }
  });
}

// Mapeo fibra+movil → pack predeterminado
// clave: "fibra-velocidad|movil-id"  →  { name, price, tipo }
var PACK_MAP = {
  "fibra-600|movil-100gb": {
    name: "Fibra 600MB + 100GB",
    price: 26.95,
    tipo: "pack",
  },
  "fibra-600|movil-ilim": {
    name: "Fibra 600MB + Ilimitado",
    price: 29.95,
    tipo: "pack",
  },
  "fibra-1gb|movil-100gb": {
    name: "Fibra 1GB + 100GB",
    price: 34.95,
    tipo: "pack",
  },
  "fibra-1gb|movil-ilim": {
    name: "Fibra 1GB + Ilimitado",
    price: 36.95,
    tipo: "pack",
  },
};

function getFibraKey() {
  if (!pendingCard) return null;
  var n = pendingCard.name.toLowerCase();
  if (n.indexOf("1gb") >= 0 || n.indexOf("1 gb") >= 0) return "fibra-1gb";
  return "fibra-600"; // 600MB por defecto
}

function getMovilKey(movilId) {
  if (movilId === "movil-ilim") return "movil-ilim";
  return "movil-100gb"; // 100gb por defecto
}

function resolvePackOrExtras(hasFibra, movilId, tvId, hasAlarma, energiaTipo) {
  var tipo = pendingCard.tipo;
  var packKey = null;

  if (tipo === "movil" && hasFibra) {
    // Tenía móvil individual y quiere añadir fibra
    // Determinar qué movil tiene según su tarjeta actual
    var movilName = pendingCard.name.toLowerCase();
    var mk = movilName.indexOf("ilimitado") >= 0 ? "movil-ilim" : "movil-100gb";
    packKey = "fibra-600|" + mk; // siempre 600MB cuando viene de solo móvil
  } else if (tipo === "fibra" && hasFibra && movilId) {
    // Tenía fibra y quiere añadir móvil (hasFibra aquí indica fibra del upsell, pero en este tipo no aplica)
    packKey = null;
  } else if (tipo === "fibra" && movilId) {
    // Tenía fibra y eligió móvil adicional
    var fk = getFibraKey();
    var mk2 = getMovilKey(movilId);
    packKey = fk + "|" + mk2;
  }

  if (packKey && PACK_MAP[packKey]) {
    var pack = PACK_MAP[packKey];
    var extras = [];
    if (hasAlarma)
      extras.push({
        id: "alarma",
        label: "Alarma hogar",
        price: "19,95\u20AC/mes",
      });
    if (tvId)
      extras.push({
        id: tvId,
        label: LABELS[tvId] || tvId,
        price: PRICES[tvId] || "",
      });
    if (energiaTipo)
      extras.push({
        id: energiaTipo,
        label: LABELS[energiaTipo] || energiaTipo,
        price: "Precio seg\u00FAn consumo",
      });
    var oldName = pendingCard.name;
    pendingCard = { name: pack.name, price: pack.price, tipo: pack.tipo, lineasIncluidas: pack.lineasIncluidas || 1 };
    selectedTariff = {
      name: pack.name,
      price: pack.price,
      tipo: pack.tipo,
      extras: extras,
      lineasIncluidas: pack.lineasIncluidas || 1,
    };
    upsellClose();
    // Banner: hemos mejorado tu tarifa
    var banner = document.getElementById("pack-upgrade-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pack-upgrade-banner";
      banner.style.cssText =
        "position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:9999;background:linear-gradient(135deg,#5F4B8B,#7c5cbf);color:#fff;padding:14px 28px;border-radius:14px;font-size:.88rem;font-weight:700;box-shadow:0 8px 32px rgba(95,75,139,.5);text-align:center;max-width:92vw;pointer-events:none;";
      document.body.appendChild(banner);
    }
    banner.innerHTML =
      '&#127881; Hemos mejorado tu tarifa &mdash; <span style="font-weight:400;opacity:.9;font-size:.82rem;">' +
      oldName +
      " + Fibra &rarr; <strong>" +
      pack.name +
      "</strong> por " +
      pack.price.toFixed(2).replace(".", ",") +
      "\u20AC/mes</span>";
    banner.style.display = "block";
    setTimeout(function () {
      banner.style.display = "none";
    }, 5000);
    goStep(2);
    return true;
  }
  return false;
}

function buildExtrasNormal(hasFibra, movilId, tvId, hasAlarma) {
  return buildExtrasNormalTV(hasFibra, movilId, tvId ? [tvId] : [], hasAlarma);
}

function buildExtrasNormalTV(hasFibra, movilId, tvIds, hasAlarma) {
  var extras = [];
  if (hasAlarma)
    extras.push({
      id: "alarma",
      label: "Alarma hogar",
      price: "19,95\u20AC/mes",
    });
  if (hasFibra && !movilId)
    extras.push({
      id: "fibra",
      label: "Fibra \u00F3ptica",
      price: "21,95\u20AC/mes",
    });
  (tvIds || []).forEach(function (tvId) {
    if (tvId)
      extras.push({
        id: tvId,
        label: LABELS[tvId] || tvId,
        price: PRICES[tvId] || "",
      });
  });
  if (movilId && !hasFibra)
    extras.push({
      id: movilId,
      label: LABELS[movilId] || movilId,
      price: PRICES[movilId] || "",
    });
  return extras;
}

function upsellConfirm() {
  if (upsellPhase === "variante-energia") {
    var opts = UPSELL_MAIN.filter(function (o) {
      return o.tipos.indexOf(pendingCard.tipo) >= 0;
    });
    upsellSel = {};
    if (opts.length > 0) {
      upsellRenderMain(opts);
    } else {
      upsellApply([]);
    }
    return;
  }
  if (upsellPhase === "main") {
    if (upsellSel["tv"] && !tvSels.length) {
      upsellShowTV();
      return;
    }
    if (upsellSel["movil"] && !movilAddSel) {
      upsellShowMovilAdd();
      return;
    }
    if (upsellSel["energia"] && !upsellSel["_energiaTipo"]) {
      upsellShowEnergia();
      return;
    }
    upsellClose();
    var hasFibra = !!upsellSel["fibra"];
    var hasAlarma = !!upsellSel["alarma"];
    var energiaTipo = upsellSel["_energiaTipo"] || null;
    var baseExtras = buildExtrasNormalTV(
      hasFibra,
      movilAddSel,
      tvSels.length ? tvSels : tvSel ? [tvSel] : [],
      hasAlarma,
    );
    if (energiaTipo)
      baseExtras.push({
        id: energiaTipo,
        label: LABELS[energiaTipo] || energiaTipo,
        price: "Precio seg\u00FAn consumo",
      });
    if (
      resolvePackOrExtras(
        hasFibra,
        movilAddSel,
        tvSels[0] || tvSel,
        hasAlarma,
        energiaTipo,
      )
    )
      return;
    upsellApply(baseExtras);
  } else if (upsellPhase === "tv") {
    if (!tvSels || tvSels.length === 0) return;
    if (upsellSel["movil"] && !movilAddSel) {
      upsellShowMovilAdd();
      return;
    }
    if (upsellSel["energia"] && !upsellSel["_energiaTipo"]) {
      upsellShowEnergia();
      return;
    }
    upsellClose();
    var hasFibra = !!upsellSel["fibra"];
    var hasAlarma = !!upsellSel["alarma"];
    var energiaTipoTV = upsellSel["_energiaTipo"] || null;
    var baseExtrasTV = buildExtrasNormalTV(
      hasFibra,
      movilAddSel,
      tvSels,
      hasAlarma,
    );
    if (energiaTipoTV)
      baseExtrasTV.push({
        id: energiaTipoTV,
        label: LABELS[energiaTipoTV] || energiaTipoTV,
        price: "Precio seg\u00FAn consumo",
      });
    if (
      resolvePackOrExtras(
        hasFibra,
        movilAddSel,
        tvSels[0],
        hasAlarma,
        energiaTipoTV,
      )
    )
      return;
    upsellApply(baseExtrasTV);
  } else if (upsellPhase === "movil") {
    if (!movilAddSel) return;
    // Si viene de "Añadir línea adicional" en el formulario de datos
    if (pendingLineaAdd) {
      var opt = UPSELL_MOVIL.filter(function (o) {
        return o.id === movilAddSel;
      })[0];
      confirmarLineaAdicional(
        opt || {
          id: movilAddSel,
          label: LABELS[movilAddSel] || movilAddSel,
          price: PRICES[movilAddSel] || "",
        },
      );
      return;
    }
    upsellClose();
    var hasFibra = !!upsellSel["fibra"];
    var hasAlarma = !!upsellSel["alarma"];
    if (upsellSel["energia"] && !upsellSel["_energiaTipo"]) {
      upsellShowEnergia();
      return;
    }
    var energiaTipoM = upsellSel["_energiaTipo"] || null;
    var baseExtrasM = buildExtrasNormalTV(
      hasFibra,
      movilAddSel,
      tvSels.length ? tvSels : tvSel ? [tvSel] : [],
      hasAlarma,
    );
    if (energiaTipoM)
      baseExtrasM.push({
        id: energiaTipoM,
        label: LABELS[energiaTipoM] || energiaTipoM,
        price: "Precio seg\u00FAn consumo",
      });
    if (
      resolvePackOrExtras(
        hasFibra,
        movilAddSel,
        tvSels[0] || tvSel,
        hasAlarma,
        energiaTipoM,
      )
    )
      return;
    upsellApply(baseExtrasM);
  }
}

function upsellCancel() {
  if (pendingLineaAdd && upsellPhase === "movil") {
    pendingLineaAdd = false;
    upsellClose();
    return;
  }
  if (upsellPhase === "variante-energia") {
    upsellClose();
    return;
  }
  if (upsellPhase === "main") {
    upsellClose();
    // Solar no llega aqui pero por si acaso
    upsellApply([]);
  } else if (upsellPhase === "energia") {
    delete upsellSel["energia"];
    delete upsellSel["_energiaTipo"];
    var opts = UPSELL_MAIN.filter(function (o) {
      return o.tipos.indexOf(pendingCard.tipo) >= 0;
    });
    upsellRenderMain(opts);
    upsellEl("upsell-opts")
      .querySelectorAll(".upsell-opt")
      .forEach(function (el) {
        var uid = el.getAttribute("data-uid");
        if (uid && upsellSel[uid]) {
          el.classList.add("checked");
          el.querySelector(".upsell-check").textContent = "✓";
        }
      });
  } else if (upsellPhase === "tv" || upsellPhase === "movil") {
    // Volver al main
    var opts = UPSELL_MAIN.filter(function (o) {
      return o.tipos.indexOf(pendingCard.tipo) >= 0;
    });
    upsellRenderMain(opts);
    // Restaurar checks
    var optsEls = upsellEl("upsell-opts").querySelectorAll(".upsell-opt");
    optsEls.forEach(function (el) {
      var uid = el.getAttribute("data-uid");
      if (uid && upsellSel[uid]) {
        el.classList.add("checked");
        el.querySelector(".upsell-check").textContent = "\u2713";
      }
    });
  }
}

function upsellOpen() {
  var overlay = upsellEl("upsell-overlay");
  if (overlay) {
    overlay.classList.add("visible");
    document.body.style.overflow = "hidden";
  }
}

function upsellClose() {
  var overlay = upsellEl("upsell-overlay");
  if (overlay) {
    overlay.classList.remove("visible");
    document.body.style.overflow = "";
  }
}

function upsellRefreshBtn() {
  var btn = upsellEl("modal-btn-yes");
  var n = Object.keys(upsellSel).length;
  btn.disabled = n === 0;
  btn.textContent =
    n > 0
      ? "Continuar con " + n + " servicio" + (n > 1 ? "s" : "") + " \u2192"
      : "Selecciona para a\u00F1adir";
}

function upsellApply(extras) {
  // Guardar selección
  selectedTariff = {
    name: pendingCard.name,
    price: pendingCard.price,
    tipo: pendingCard.tipo,
    extras: extras,
    lineasIncluidas: pendingCard.lineasIncluidas || 0,
  };
  // Ir directamente al paso 2 (datos del cliente)
  goStep(2);
}

function upsellEl(id) {
  return document.getElementById(id);
}

// ---- STEP NAVIGATION ----
function goStep(n) {
  document
    .querySelectorAll(".form-section")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById("section-" + n).classList.add("active");

  // Update step indicators (5 steps + success=6)
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById("step-ind-" + i);
    if (!el) continue;
    el.classList.remove("active", "done");
    if (i < n) el.classList.add("done");
    else if (i === n) el.classList.add("active");
  }

  // Progress bar
  const pct = n <= TOTAL_STEPS ? Math.round((n / TOTAL_STEPS) * 100) : 100;
  document.getElementById("progressFill").style.width = pct + "%";

  // Step 2 init
  if (n === 2 && selectedTariff) {
    document.getElementById("selectedBar").classList.remove("hidden");
    document.getElementById("barName").textContent = selectedTariff.name;
    document.getElementById("barPrice").textContent =
      selectedTariff.price > 0
        ? selectedTariff.price.toFixed(2).replace(".", ",") + "€/mes"
        : "Precio según consumo";

    // Mostrar extras si los hay
    var nota = document.getElementById("upsell-nota");
    if (nota) {
      var ex = selectedTariff.extras;
      if (ex && ex.length) {
        nota.textContent =
          "También: " +
          ex
            .map(function (e) {
              return e.label + (e.price ? " (" + e.price + ")" : "");
            })
            .join(" · ");
        nota.style.display = "block";
      } else {
        nota.style.display = "none";
      }
    }

    const tipo = selectedTariff.tipo;
    const needsFibra = ["fibra", "pack", "pack-tv"].includes(tipo);
    const needsMovil = ["movil", "pack", "pack-tv"].includes(tipo);
    const needsEnvio = ["movil", "pack", "pack-tv", "alarma"].includes(tipo);
    const isEnergia = tipo.startsWith("energia");

    document.getElementById("blk-fibra-wrap").style.display = needsFibra
      ? "block"
      : "none";
    document.getElementById("blk-movil-wrap").style.display = needsMovil
      ? "block"
      : "none";
    // Generar las líneas incluidas en la tarifa (sin coste extra)
    if (needsMovil) sincronizarLineasIncluidas();
    document.getElementById("lbl-envio").style.display = needsEnvio
      ? "block"
      : "none";
    document.getElementById("blk-envio").style.display = needsEnvio
      ? "grid"
      : "none";

    // Energía: sin envío SIM ni dirección
    if (isEnergia) {
      document.getElementById("lbl-envio").style.display = "none";
      document.getElementById("blk-envio").style.display = "none";
    }
    // Datos CUPS (solo luz)
    document.getElementById("blk-luz-wrap").style.display =
      tipo === "energia-luz" ? "block" : "none";
    // Contactos alarma: tarifa directa o alarma como extra upsell
    var hasAlarmaExtra =
      selectedTariff.extras &&
      selectedTariff.extras.some(function (e) {
        return e.id === "alarma";
      });
    document.getElementById("blk-alarma-wrap").style.display =
      tipo === "alarma" || hasAlarmaExtra ? "block" : "none";
  }

  if (n === 3) runIncofisaCheck();
  if (n === 5) fillResumen();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- TOGGLE MISMA DIRECCIÓN ----
function getAddrString(px) {
  const g = (id) =>
    (document.getElementById(px + "-" + id) || { value: "" }).value;
  let s = [g("tipo"), g("via"), g("num")].filter(Boolean).join(" ");
  if (g("bloque")) s += " Blq." + g("bloque");
  if (g("esc")) s += " Esc." + g("esc");
  if (g("planta")) s += " Plta." + g("planta");
  if (g("piso")) s += " " + g("piso");
  const loc = [g("cp"), g("loc"), g("prov")].filter(Boolean).join(" ");
  if (loc) s += ", " + loc;
  return s;
}
function toggleMismaDireccion() {
  const chk = document.getElementById("chk-misma-dir");
  const grid = document.getElementById("fibra-dir-grid");
  const fields = [
    "tipo",
    "via",
    "num",
    "bloque",
    "esc",
    "planta",
    "piso",
    "cp",
    "loc",
    "prov",
  ];
  if (chk.checked) {
    // Copiar valores de envío y ocultar el bloque completo
    fields.forEach((f) => {
      const src = document.getElementById("envio-" + f);
      const dst = document.getElementById("fibra-" + f);
      if (src && dst) {
        dst.value = src.value;
        dst.disabled = true;
      }
    });
    grid.style.display = "none";
  } else {
    // Mostrar y habilitar de nuevo
    grid.style.display = "";
    fields.forEach((f) => {
      const dst = document.getElementById("fibra-" + f);
      if (dst) {
        dst.disabled = false;
        dst.style.opacity = "1";
      }
    });
  }
}

// ---- MÓVIL MODE ----
function setMovilMode(mode) {
  movilMode = mode;
  ["porta", "alta"].forEach((m) => {
    var el = document.getElementById("opt-" + m);
    if (el) el.classList.toggle("active", m === mode);
    var mel = document.getElementById("modo-" + m);
    if (mel)
      mel.style.display =
        m === mode ? (m === "alta" ? "block" : "grid") : "none";
  });
  // Cambio de titular solo aplica a portabilidad
  var chkWrap = document.getElementById("cambio-titular-wrap");
  if (chkWrap) chkWrap.style.display = mode === "porta" ? "block" : "none";
  if (mode === "alta") {
    var chk = document.getElementById("chk-cambio-titular");
    if (chk && chk.checked) {
      chk.checked = false;
      toggleCambioTitular();
    }
  }
  document.getElementById("titularCheckSection").style.display = "none";
}

// ---- ORIGEN PORTABILIDAD ----
var origenPorta = "contrato"; // contrato | prepago

function setOrigenPorta(origen) {
  origenPorta = origen;
  ["contrato", "prepago"].forEach(function (o) {
    var el = document.getElementById("opt-origen-" + o);
    if (el) el.classList.toggle("active", o === origen);
  });
  var blk = document.getElementById("blk-iccid");
  if (blk) blk.style.display = origen === "prepago" ? "block" : "none";
  if (origen !== "prepago") {
    var inp = document.getElementById("iccid-porta");
    if (inp) inp.value = "";
  }
}

function formatIccid(inp, id) {
  // Solo dígitos, máx 19, forzar prefijo 8934
  var v = inp.value.replace(/\D/g, "");
  if (v.length > 0 && !v.startsWith("8934")) {
    // Si el usuario empieza a escribir sin 8934, lo anteponemos
    if (v.startsWith("89"))
      v = v; // dejar que siga escribiendo
    else if (v.startsWith("8")) v = v;
    else v = "8934" + v;
  }
  inp.value = v.substring(0, 19);
}

// ---- CAMBIO DE TITULAR (check) ----
function toggleCambioTitular() {
  var chk = document.getElementById("chk-cambio-titular");
  var panel = document.getElementById("modo-cambio");
  if (panel) panel.style.display = chk.checked ? "block" : "none";
  movilMode = chk.checked
    ? "cambio"
    : document.getElementById("opt-porta").classList.contains("active")
      ? "porta"
      : "alta";
}

// ---- LÍNEAS ADICIONALES ----
var lineasAdicionales = []; // [{ id, label, price, mode:'porta'|'alta', numero:'', compania:'', incluida:bool }]

// Sincroniza las líneas INCLUIDAS en la tarifa (sin coste extra).
// La línea 1 es la principal (bloque fijo). Si la tarifa incluye N líneas,
// se generan (N-1) bloques de línea incluida con price 0.
function sincronizarLineasIncluidas() {
  var n = (selectedTariff && selectedTariff.lineasIncluidas) || 0;
  // Quitar las incluidas previas (por si se cambió de tarifa), conservar las adicionales de pago
  lineasAdicionales = lineasAdicionales.filter(function (l) { return !l.incluida; });
  // Generar (n-1) líneas incluidas extra (la 1ª va en el bloque principal)
  var extra = n > 1 ? n - 1 : 0;
  var nuevas = [];
  for (var k = 0; k < extra; k++) {
    nuevas.push({
      id: "incluida", label: "Línea incluida", price: "0€/mes",
      mode: "porta", numero: "", compania: "",
      origen: "contrato", iccid: "", incluida: true,
    });
  }
  // Incluidas primero, luego las adicionales de pago
  lineasAdicionales = nuevas.concat(lineasAdicionales);
  renderLineasAdicionales();
}

function abrirModalLineaAdicional() {
  if (lineasAdicionales.length >= 6) {
    // Popup empresa
    var overlay = document.getElementById("empresa-overlay");
    if (overlay) {
      overlay.classList.add("visible");
      document.body.style.overflow = "hidden";
    }
    return;
  }
  pendingLineaAdd = true;
  movilAddSel = null;
  upsellShowMovilAdd();
}

var pendingLineaAdd = false;

// Interceptar confirmación del sub-modal cuando viene de línea adicional
var _origUpsellConfirm = null; // no necesario, usamos flag pendingLineaAdd

function confirmarLineaAdicional(tarifa) {
  pendingLineaAdd = false;
  var idx = lineasAdicionales.length + 1;
  lineasAdicionales.push({
    id: tarifa.id,
    label: tarifa.label,
    price: tarifa.price,
    mode: "porta",
    numero: "",
    compania: "",
    origen: "contrato",
    iccid: "",
  });
  renderLineasAdicionales();
  upsellClose();
}

function renderLineasAdicionales() {
  var wrap = document.getElementById("lineas-adicionales-wrap");
  if (!wrap) return;
  var html = "";
  // Contar incluidas para numerar correctamente
  var nIncl = 0, nAdic = 0;
  for (var i = 0; i < lineasAdicionales.length; i++) {
    var l = lineasAdicionales[i];
    var activePorta = l.mode === "porta" ? " active" : "";
    var activeAlta = l.mode === "alta" ? " active" : "";
    var esIncluida = !!l.incluida;
    var bgColor = esIncluida ? "rgba(34,197,94,0.07)" : "rgba(95,75,139,0.08)";
    var bdColor = esIncluida ? "rgba(34,197,94,0.30)" : "rgba(95,75,139,0.25)";
    html +=
      '<div class="linea-adicional-block" style="margin-top:20px;padding:16px;background:' + bgColor + ';border:1px solid ' + bdColor + ';border-radius:12px;">';
    html +=
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    if (esIncluida) {
      nIncl++;
      // La línea principal es la 1; estas son la 2, 3...
      html +=
        '<span style="font-weight:700;font-size:.9rem;">\u{1F4F1} L\u00EDnea ' + (nIncl + 1) +
        ' \u00B7 <span style="color:#22c55e;">incluida en la tarifa</span></span>';
      html += '<span style="font-size:.72rem;color:#22c55e;font-weight:600;">Sin coste extra</span>';
    } else {
      nAdic++;
      html +=
        '<span style="font-weight:700;font-size:.9rem;">\u{1F4F1} L\u00EDnea adicional ' +
        nAdic +
        ' \u00B7 <span style="color:var(--accent-light);">' +
        l.label +
        " (" +
        l.price +
        ")</span></span>";
      html +=
        '<button type="button" onclick="eliminarLineaAdicional(' +
        i +
        ')" style="background:rgba(255,60,60,0.1);border:1px solid rgba(255,60,60,0.3);color:rgba(255,100,100,0.8);border-radius:7px;padding:3px 10px;cursor:pointer;font-size:.78rem;">Eliminar</button>';
    }
    html += "</div>";
    // Modo porta/alta
    html += '<div class="option-cards" style="margin-bottom:14px;gap:8px;">';
    html +=
      '<div class="option-card' +
      activePorta +
      '" onclick="setLineaMode(' +
      i +
      ',0)" style="padding:8px 12px;flex:1;">';
    html +=
      '<div class="option-card-icon" style="font-size:1rem;">\uD83D\uDD04</div><div class="option-card-label" style="font-size:.78rem;">Portabilidad</div></div>';
    html +=
      '<div class="option-card' +
      activeAlta +
      '" onclick="setLineaMode(' +
      i +
      ',1)" style="padding:8px 12px;flex:1;">';
    html +=
      '<div class="option-card-icon" style="font-size:1rem;">\u2728</div><div class="option-card-label" style="font-size:.78rem;">Alta nueva</div></div>';
    html += "</div>";
    if (l.mode === "porta") {
      html +=
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
      html +=
        '<div class="field"><label>N\u00FAmero a portar <span>*</span></label>';
      html +=
        '<input type="text" id="linea-' +
        i +
        '-numero" value="' +
        (l.numero || "") +
        '" placeholder="612345678" maxlength="9" oninput="updateLinea(' +
        i +
        ",0,this.value.replace(/[^0-9]/g,''))\">";
      html +=
        '<div class="field-error" id="err-linea-' +
        i +
        '-numero">9 d\u00EDgitos</div></div>';
      html +=
        '<div class="field"><label>Compa\u00F1\u00EDa donante <span>*</span></label>';
      html +=
        '<input type="text" id="linea-' +
        i +
        '-compania" value="' +
        (l.compania || "") +
        '" placeholder="Ej: Movistar, Orange..." oninput="updateLinea(' +
        i +
        ',1,this.value)">';
      html +=
        '<div class="field-error" id="err-linea-' +
        i +
        '-compania">Indica la compa\u00F1\u00EDa</div></div>';
      html += "</div>";
      // Origen contrato/prepago
      var actC = l.origen !== "prepago" ? " active" : "";
      var actP = l.origen === "prepago" ? " active" : "";
      html += '<div style="margin-top:12px;">';
      html +=
        '<label style="font-size:.8rem;font-weight:600;color:rgba(255,255,255,.55);display:block;margin-bottom:6px;">Origen <span style="color:#e05;">*</span></label>';
      html += '<div class="option-cards" style="gap:8px;">';
      html +=
        '<div class="option-card' +
        actC +
        '" onclick="setLineaOrigen(' +
        i +
        ',0)" style="padding:8px 12px;flex:1;">';
      html +=
        '<div class="option-card-icon" style="font-size:.95rem;">\uD83D\uDCC4</div><div class="option-card-label" style="font-size:.78rem;">Contrato</div></div>';
      html +=
        '<div class="option-card' +
        actP +
        '" onclick="setLineaOrigen(' +
        i +
        ',1)" style="padding:8px 12px;flex:1;">';
      html +=
        '<div class="option-card-icon" style="font-size:.95rem;">\uD83D\uDCB3</div><div class="option-card-label" style="font-size:.78rem;">Prepago</div></div>';
      html += "</div></div>";
      // ICCID solo si prepago
      if (l.origen === "prepago") {
        html +=
          '<div class="field" style="margin-top:12px;"><label>ICCID de la SIM <span>*</span></label>';
        html +=
          '<input type="text" id="linea-' +
          i +
          '-iccid" value="' +
          (l.iccid || "") +
          '" placeholder="8934XXXXXXXXXXXXXXX" maxlength="19" oninput="updateLineaIccid(' +
          i +
          ',this)" style="font-family:monospace;letter-spacing:.04em;">';
        html +=
          '<div class="field-hint">19 d\u00EDgitos \u00B7 comienza por 8934</div>';
        html +=
          '<div class="field-error" id="err-linea-' +
          i +
          '-iccid">ICCID inv\u00E1lido: 19 d\u00EDgitos comenzando por 8934</div></div>';
      }
    } else {
      html +=
        '<div class="iban-note" style="font-size:.82rem;">\u2728 Se asignar\u00E1 un n\u00FAmero nuevo al activar la SIM.</div>';
    }
    html += "</div>";
  }
  wrap.innerHTML = html;
}

function setLineaMode(idx, modeNum) {
  lineasAdicionales[idx].mode = modeNum === 0 ? "porta" : "alta";
  renderLineasAdicionales();
}

function setLineaOrigen(idx, origenNum) {
  lineasAdicionales[idx].origen = origenNum === 0 ? "contrato" : "prepago";
  if (origenNum === 0) lineasAdicionales[idx].iccid = "";
  renderLineasAdicionales();
}

function updateLinea(idx, fieldNum, val) {
  if (fieldNum === 0) lineasAdicionales[idx].numero = val;
  else lineasAdicionales[idx].compania = val;
}

function updateLineaIccid(idx, inp) {
  var v = inp.value.replace(/\D/g, "");
  if (v.length > 0 && !v.startsWith("8934") && v.length >= 4) {
    v = "8934" + v.replace(/^8934/, "");
  }
  inp.value = v.substring(0, 19);
  lineasAdicionales[idx].iccid = inp.value;
}

function eliminarLineaAdicional(idx) {
  lineasAdicionales.splice(idx, 1);
  renderLineasAdicionales();
}
function setLineaMode(idx, modeNum) {
  lineasAdicionales[idx].mode = modeNum === 0 ? "porta" : "alta";
  renderLineasAdicionales();
}

function updateLinea(idx, fieldNum, val) {
  if (fieldNum === 0) lineasAdicionales[idx].numero = val;
  else lineasAdicionales[idx].compania = val;
}

function eliminarLineaAdicional(idx) {
  lineasAdicionales.splice(idx, 1);
  renderLineasAdicionales();
}

// ---- FILE UPLOAD ----
function handleUploadAlt(altInput, mainInputId, boxId, previewId) {
  if (!altInput.files || !altInput.files[0]) return;
  var file = altInput.files[0];
  // Validar tipo antes de nada
  if (!esFicheroValido(file)) {
    altInput.value = "";
    var box = document.getElementById(boxId);
    if (box) {
      box.classList.remove("uploaded");
      var ico = box.querySelector(".upload-icon");
      if (ico) ico.textContent = "⚠️";
      var lbl = box.querySelector(".upload-label");
      if (lbl) lbl.textContent = "Solo PNG, JPG o PDF";
    }
    var prev = document.getElementById(previewId);
    if (prev) { prev.textContent = "✗ Formato no válido. Sube PNG, JPG o PDF."; prev.classList.remove("hidden"); }
    return;
  }
  // Asignar el archivo al input principal (con capture) para que la validación lo detecte
  try {
    var dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById(mainInputId).files = dt.files;
  } catch (e) {
    /* DataTransfer no disponible en algunos navegadores antiguos */
  }
  handleUpload(altInput, boxId, previewId);
}

// Valida que el fichero sea PNG, JPG o PDF. Devuelve true/false.
// Tamaño mínimo: un documento real (foto/PDF) pesa decenas de KB.
// Archivos de ~244-567 bytes son imágenes vacías/negras que algunos
// móviles generan al disparar la cámara sin enfocar -> se rechazan.
var TAMANO_MINIMO_BYTES = 10000; // 10 KB
var DIMENSION_MINIMA_PX = 200;   // ancho y alto mínimos para una imagen real

// Comprueba que una imagen tenga dimensiones reales (no 1x1 ni vacía).
// Para PDF no aplica (se valida solo por tamaño).
function validarDimensionesImagen(file) {
  return new Promise(function (resolve) {
    if (!file || file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) {
      resolve(true);
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var ok = img.naturalWidth >= DIMENSION_MINIMA_PX && img.naturalHeight >= DIMENSION_MINIMA_PX;
      URL.revokeObjectURL(url);
      if (!ok) console.error("Imagen rechazada por dimensiones:", img.naturalWidth + "x" + img.naturalHeight);
      resolve(ok);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      console.error("Imagen ilegible/corrupta:", file.name);
      resolve(false);
    };
    img.src = url;
  });
}

function esFicheroValido(file) {
  if (!file) return false;
  var tiposOk = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
  var nombre = (file.name || "").toLowerCase();
  var extOk = /\.(png|jpg|jpeg|pdf)$/.test(nombre);
  var tipoOk = tiposOk.indexOf(file.type) >= 0 || extOk;
  if (!tipoOk) return false;
  // Rechazar archivos sospechosamente pequenos (placeholder/icono vacio)
  if (file.size > 0 && file.size < TAMANO_MINIMO_BYTES) {
    console.error("Fichero rechazado por tamano (" + file.size + " bytes):", file.name);
    return false;
  }
  return true;
}

function handleUpload(input, boxId, previewId) {
  const file = input.files[0];
  const box = document.getElementById(boxId);
  const preview = document.getElementById(previewId);
  if (!file) return;

  // Validar tipo y tamaño
  if (!esFicheroValido(file)) {
    var esPequeno = file.size > 0 && file.size < TAMANO_MINIMO_BYTES;
    input.value = ""; // limpiar el input
    box.classList.remove("uploaded");
    const ico = box.querySelector(".upload-icon");
    if (ico) ico.textContent = "⚠️";
    const lbl = box.querySelector(".upload-label");
    if (lbl) lbl.textContent = esPequeno ? "Imagen no válida, repítela" : "Solo PNG, JPG o PDF";
    if (preview) {
      preview.textContent = esPequeno
        ? "✗ El archivo está vacío o es demasiado pequeño. Haz la foto de nuevo o sube el documento real."
        : "✗ Formato no válido. Sube PNG, JPG o PDF.";
      preview.classList.remove("hidden");
    }
    return;
  }

  // Validar dimensiones reales (rechaza imágenes negras/vacías que pesan poco contenido visual)
  validarDimensionesImagen(file).then(function (dimOk) {
    if (!dimOk) {
      input.value = "";
      box.classList.remove("uploaded");
      var ico2 = box.querySelector(".upload-icon");
      if (ico2) ico2.textContent = "⚠️";
      var lbl2 = box.querySelector(".upload-label");
      if (lbl2) lbl2.textContent = "Imagen no válida, repítela";
      if (preview) {
        preview.textContent = "✗ La imagen parece vacía o está en negro. Asegúrate de enfocar el documento y repite la foto.";
        preview.classList.remove("hidden");
      }
      return;
    }
    box.classList.add("uploaded");
    box.querySelector(".upload-icon").textContent = "✅";
    box.querySelector(".upload-label").textContent = file.name;
    preview.textContent =
      "✓ " + file.name + " (" + (file.size / 1024).toFixed(0) + " KB)";
    preview.classList.remove("hidden");
    // Ocultar error si lo había
    var errId = boxId.replace("box-", "err-");
    var errEl = document.getElementById(errId);
    if (errEl) errEl.style.display = "none";
  });
}

// ---- VALIDATE STEP 2 ----
function validateStep2() {
  let valid = true;

  function checkField(id, condition, errId) {
    const el = document.getElementById(id);
    const err = document.getElementById(errId || "err-" + id);
    if (el) el.classList.remove("error");
    if (!condition) {
      if (el) el.classList.add("error");
      if (err) err.style.display = "block";
      valid = false;
    } else {
      if (err) err.style.display = "none";
    }
  }

  function checkUpload(inputId, errId) {
    const inp = document.getElementById(inputId);
    const err = document.getElementById(errId);
    var f = inp && inp.files && inp.files[0] ? inp.files[0] : null;
    // Debe existir Y pasar la validación de tipo/tamaño (rechaza archivos vacíos < 10KB)
    if (!f || !esFicheroValido(f)) {
      if (err) {
        err.textContent = (f && f.size > 0 && f.size < TAMANO_MINIMO_BYTES)
          ? "El archivo está vacío o es demasiado pequeño. Repite la foto del documento."
          : "Adjunta el documento (PNG, JPG o PDF)";
        err.style.display = "block";
      }
      valid = false;
    } else {
      if (err) err.style.display = "none";
    }
  }

  // Nombre: al menos 2 palabras
  const nombre = document.getElementById("nombre").value.trim();
  checkField("nombre", nombre.split(/\s+/).length >= 2);

  // DNI/NIE
  const dniVal = document.getElementById("dni").value.trim().toUpperCase();
  checkField(
    "dni",
    /^[0-9]{8}[A-Z]$/.test(dniVal) || /^[XYZ][0-9]{7}[A-Z]$/.test(dniVal),
  );

  // Teléfono: 9 dígitos, empieza por 6 o 7
  const tel = document.getElementById("telefono").value.replace(/\D/g, "");
  checkField("telefono", /^[67][0-9]{8}$/.test(tel));

  // Email
  const email = document.getElementById("email").value;
  checkField("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  // Fecha de nacimiento (obligatoria, mayor de 18)
  var fechaNac = document.getElementById("fecha-nac").value;
  var fechaOk = false;
  if (fechaNac) {
    var hoy = new Date();
    var nac = new Date(fechaNac);
    var edad = hoy.getFullYear() - nac.getFullYear();
    var mesD = hoy.getMonth() - nac.getMonth();
    if (mesD < 0 || (mesD === 0 && hoy.getDate() < nac.getDate())) edad--;
    fechaOk = edad >= 18 && edad <= 110;
  }
  checkField("fecha-nac", fechaOk, "err-fecha-nac");

  // DNI fotos
  checkUpload("inp-dni-front", "err-dni-front");
  checkUpload("inp-dni-back", "err-dni-back");

  // Dirección envío SIM (si visible)
  const blkEnvio = document.getElementById("blk-envio");
  if (blkEnvio && blkEnvio.style.display !== "none") {
    checkField(
      "envio-tipo",
      !!document.getElementById("envio-tipo").value,
      "err-envio-tipo",
    );
    checkField(
      "envio-via",
      document.getElementById("envio-via").value.trim().length > 1,
      "err-envio-via",
    );
    checkField(
      "envio-num",
      document.getElementById("envio-num").value.trim().length > 0,
      "err-envio-num",
    );
    checkField(
      "envio-cp",
      /^[0-9]{5}$/.test(document.getElementById("envio-cp").value),
      "err-envio-cp",
    );
    checkField(
      "envio-loc",
      document.getElementById("envio-loc").value.trim().length > 1,
      "err-envio-loc",
    );
    checkField(
      "envio-prov",
      !!document.getElementById("envio-prov").value,
      "err-envio-prov",
    );
  }
  // Dirección fibra (si visible y no es misma)
  const blkFibra = document.getElementById("blk-fibra-wrap");
  if (blkFibra && blkFibra.style.display !== "none") {
    const chkMisma = document.getElementById("chk-misma-dir");
    if (!chkMisma.checked) {
      checkField(
        "fibra-tipo",
        !!document.getElementById("fibra-tipo").value,
        "err-fibra-tipo",
      );
      checkField(
        "fibra-via",
        document.getElementById("fibra-via").value.trim().length > 1,
        "err-fibra-via",
      );
      checkField(
        "fibra-num",
        document.getElementById("fibra-num").value.trim().length > 0,
        "err-fibra-num",
      );
      checkField(
        "fibra-cp",
        /^[0-9]{5}$/.test(document.getElementById("fibra-cp").value),
        "err-fibra-cp",
      );
      checkField(
        "fibra-loc",
        document.getElementById("fibra-loc").value.trim().length > 1,
        "err-fibra-loc",
      );
      checkField(
        "fibra-prov",
        !!document.getElementById("fibra-prov").value,
        "err-fibra-prov",
      );
    }
  }

  // Móvil
  const blkMovil = document.getElementById("blk-movil-wrap");
  if (blkMovil && blkMovil.style.display !== "none") {
    if (movilMode === "porta") {
      const porta = document
        .getElementById("numero-porta")
        .value.replace(/\D/g, "");
      checkField("numero-porta", /^[6789][0-9]{8}$/.test(porta), "err-porta");
      const comp = document.getElementById("compania-actual").value.trim();
      checkField("compania-actual", comp.length > 0, "err-compania");
      // ICCID obligatorio si prepago
      if (typeof origenPorta !== "undefined" && origenPorta === "prepago") {
        const iccid = document
          .getElementById("iccid-porta")
          .value.replace(/\D/g, "");
        checkField(
          "iccid-porta",
          /^8934[0-9]{15}$/.test(iccid),
          "err-iccid-porta",
        );
      }
    }
    if (movilMode === "cambio") {
      const tNombre = document.getElementById("titular-nombre").value.trim();
      checkField(
        "titular-nombre",
        tNombre.split(/\s+/).length >= 2,
        "err-titular-nombre",
      );
      const tDni = document
        .getElementById("titular-dni")
        .value.trim()
        .toUpperCase();
      checkField(
        "titular-dni",
        /^[0-9]{8}[A-Z]$/.test(tDni) || /^[XYZ][0-9]{7}[A-Z]$/.test(tDni),
        "err-titular-dni",
      );
      const nCambio = document
        .getElementById("numero-cambio")
        .value.replace(/\D/g, "");
      checkField(
        "numero-cambio",
        /^[6789][0-9]{8}$/.test(nCambio),
        "err-numero-cambio",
      );
    }
  }

  // IBAN
  const ibanVal = document.getElementById("iban").value.replace(/\s/g, "");
  checkField("iban", /^ES[0-9]{22}$/.test(ibanVal), "err-iban");

  // Cuenta foto
  checkUpload("inp-cuenta", "err-cuenta");

  // Líneas adicionales
  lineasAdicionales.forEach(function (l, i) {
    if (l.mode === "porta") {
      var numEl = document.getElementById("linea-" + i + "-numero");
      var num = numEl ? numEl.value : l.numero || "";
      if (!/^[6789][0-9]{8}$/.test(num.replace(/\D/g, ""))) {
        var errEl = document.getElementById("err-linea-" + i + "-numero");
        if (errEl) errEl.style.display = "block";
        valid = false;
      }
      var compEl = document.getElementById("linea-" + i + "-compania");
      var comp = compEl ? compEl.value : l.compania || "";
      if (!comp.trim()) {
        var errEl2 = document.getElementById("err-linea-" + i + "-compania");
        if (errEl2) errEl2.style.display = "block";
        valid = false;
      }
      // ICCID si prepago
      if (l.origen === "prepago") {
        var iccidEl = document.getElementById("linea-" + i + "-iccid");
        var iccidV = iccidEl ? iccidEl.value.replace(/\D/g, "") : l.iccid || "";
        if (!/^8934[0-9]{15}$/.test(iccidV)) {
          var errIccid = document.getElementById("err-linea-" + i + "-iccid");
          if (errIccid) errIccid.style.display = "block";
          valid = false;
        }
      }
    }
  });

  // CUPS luz (obligatorio solo si tarifa energia-luz)
  var blkLuz = document.getElementById("blk-luz-wrap");
  if (blkLuz && blkLuz.style.display !== "none") {
    var cups = (document.getElementById("luz-cups").value || "")
      .replace(/\s/g, "")
      .toUpperCase();
    checkField("luz-cups", /^ES[A-Z0-9]{20}$/.test(cups));
    checkField(
      "luz-titular",
      document.getElementById("luz-titular").value.trim().length >= 3,
    );
    var dniLuz = document.getElementById("luz-dni").value.trim().toUpperCase();
    checkField(
      "luz-dni",
      /^[0-9]{8}[A-Z]$/.test(dniLuz) || /^[XYZ][0-9]{7}[A-Z]$/.test(dniLuz),
    );
    checkField(
      "luz-compania",
      document.getElementById("luz-compania").value.trim().length > 0,
    );
  }

  // Contactos alarma (obligatorio solo si alarma contratada)
  // Contacto 1: SIEMPRE obligatorio.
  // Contactos 2 y 3: opcionales, PERO si se rellena algún campo, todos sus campos pasan a obligatorios.
  var blkAlarma = document.getElementById("blk-alarma-wrap");
  if (blkAlarma && blkAlarma.style.display !== "none") {
    function valNombre(n) { var el = document.getElementById("alarma-c" + n + "-nombre"); return el ? el.value.trim() : ""; }
    function valTel(n)    { var el = document.getElementById("alarma-c" + n + "-tel"); return el ? el.value.trim() : ""; }
    function valRel(n)    { var el = document.getElementById("alarma-c" + n + "-relacion"); return el ? el.value.trim() : ""; }

    // Valida un contacto: comprueba nombre, teléfono y relación
    function validarContacto(n) {
      checkField("alarma-c" + n + "-nombre", valNombre(n).length >= 3);
      checkField("alarma-c" + n + "-tel", /^[6789][0-9]{8}$/.test(valTel(n)));
      checkField("alarma-c" + n + "-relacion", valRel(n).length > 0);
    }

    // Contacto 1 siempre obligatorio
    validarContacto(1);

    // Contactos 2 y 3: solo obligatorios si tienen algún dato introducido
    [2, 3].forEach(function (n) {
      var tieneAlgo = valNombre(n).length > 0 || valTel(n).length > 0 || valRel(n).length > 0;
      if (tieneAlgo) {
        validarContacto(n);
      } else {
        // Vacío del todo: limpiar posibles errores previos de ese contacto
        ["nombre", "tel", "relacion"].forEach(function (campo) {
          var errEl = document.getElementById("err-alarma-c" + n + "-" + campo);
          if (errEl) errEl.style.display = "none";
          var inEl = document.getElementById("alarma-c" + n + "-" + campo);
          if (inEl) inEl.classList.remove("error");
        });
      }
    });
  }

  if (valid) goStep(3);
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- INCOFISA CHECK ----
function runIncofisaCheck() {
  const checkIcon = document.getElementById("checkIcon");
  const checkTitle = document.getElementById("checkTitle");
  const checkSub = document.getElementById("checkSub");
  const riskMsg = document.getElementById("riskMessage");
  const btnRow = document.getElementById("btnRowStep3");
  const btnContinue = document.getElementById("btnContinueStep3");
  const titularSection = document.getElementById("titularCheckSection");

  // Reset UI
  checkIcon.className = "check-icon loading";
  checkIcon.textContent = "⟳";
  checkTitle.textContent = "Verificando solvencia...";
  checkSub.textContent = "Consultando datos de solvencia, por favor espera.";
  riskMsg.style.display = "none";
  titularSection.style.display = "none";
  btnRow.style.display = "none";
  document.querySelectorAll(".check-badge").forEach((b) => b.remove());

  const esCambioTitular =
    movilMode === "cambio" &&
    document.getElementById("blk-movil-wrap") &&
    document.getElementById("blk-movil-wrap").style.display !== "none";

  // Simular verificación principal (~2.5s)
  setTimeout(() => {
    // SIMULACIÓN — reemplazar con llamada real a API Incofisa
    const mockRisk = Math.random() * 100;

    if (mockRisk <= 49.99) {
      incofisaResult = "ok";
      checkIcon.className = "check-icon ok";
      checkIcon.textContent = "✓";
      checkTitle.textContent = "Verificación completada";
      checkSub.textContent =
        "Tu perfil crediticio es correcto. Puedes continuar con tu alta.";
      const badge = document.createElement("div");
      badge.className = "check-badge ok";
      badge.textContent = "✓ Sin incidencias";
      document.getElementById("incofisaCheck").appendChild(badge);
    } else {
      incofisaResult = "risk";
      checkIcon.className = "check-icon risk";
      checkIcon.textContent = "!";
      checkTitle.textContent = "Documentación adicional requerida";
      checkSub.textContent =
        "Es necesario aportar documentación para continuar con el alta.";
      const badge = document.createElement("div");
      badge.className = "check-badge risk";
      badge.textContent = "⚠ Requiere documentación";
      document.getElementById("incofisaCheck").appendChild(badge);
      riskMsg.style.display = "block";
    }

    // Si hay cambio de titular, verificar también al titular actual
    if (esCambioTitular) {
      titularSection.style.display = "block";
      document.getElementById("titularCheckMsg").textContent =
        "Verificando solvencia del titular actual...";

      setTimeout(() => {
        // SIMULACIÓN titular actual — reemplazar con llamada real API Incofisa
        const titularRisk = Math.random() * 100;
        incofisaTitularResult = titularRisk <= 49.99 ? "ok" : "risk";

        if (incofisaTitularResult === "risk") {
          document.getElementById("titularCheckMsg").innerHTML =
            "⚠️ <strong>El titular actual presenta incidencias.</strong> Se gestionará el cambio de titular con documentación adicional. Un agente se pondrá en contacto por WhatsApp.";
        } else {
          document.getElementById("titularCheckMsg").innerHTML =
            "✅ <strong>Titular actual verificado correctamente.</strong> El cambio de titular puede tramitarse con normalidad.";
        }
        btnRow.style.display = "flex";
        btnContinue.textContent = "Continuar →";
      }, 1800);
    } else {
      btnRow.style.display = "flex";
      btnContinue.textContent =
        incofisaResult === "risk"
          ? "Continuar con documentación →"
          : "Continuar →";
    }
  }, 2500);
}

// ---- VALIDATE STEP 4 (SELFIE) ----
/* validateStep4 - DESACTIVADO
function validateStep4() {
    const b64 = document.getElementById('selfie-b64').value;
    const err = document.getElementById('err-selfie');
    if (!b64) { err.style.display='block'; return; }
    err.style.display='none';
    goStep(5);
}
*/

// ---- FILL RESUMEN ----
// Helper: lee el value de un campo por id (cadena vacía si no existe)
function valEl(id) {
  var el = document.getElementById(id);
  return el ? (el.value || "").trim() : "";
}

// Construye una dirección completa y legible a partir de sus partes.
// p: prefijo de los campos en el snapshot ("envio" o "fibra").
function formatDireccion(s, p) {
  var via = [s[p + "_tipo"], s[p + "_via"]].filter(Boolean).join(" ");
  var num = s[p + "_num"] ? "nº " + s[p + "_num"] : "";
  // Detalles de portal: bloque, escalera, planta, piso/puerta
  var detalles = [];
  if (s[p + "_bloque"]) detalles.push("Bloque " + s[p + "_bloque"]);
  if (s[p + "_esc"]) detalles.push("Esc. " + s[p + "_esc"]);
  if (s[p + "_planta"]) detalles.push("Planta " + s[p + "_planta"]);
  if (s[p + "_piso"]) detalles.push(s[p + "_piso"]);
  var detStr = detalles.join(", ");
  var cpLoc = [s[p + "_cp"], s[p + "_municipio"]].filter(Boolean).join(" ");
  var prov = s[p + "_provincia"] || "";
  return [via + (num ? " " + num : ""), detStr, cpLoc, prov]
    .filter(Boolean)
    .join(" · ");
}

function fillResumen() {
  if (!selectedTariff) return;
  // Guardar snapshot de todos los datos en variable global
  formDataSnapshot = {
    _tariff: selectedTariff,
    sin_documentacion: document.getElementById("chk-sin-doc")
      ? document.getElementById("chk-sin-doc").checked
      : false,
    observaciones: document.getElementById("observaciones")
      ? document.getElementById("observaciones").value.trim()
      : "",
    distribuidor:
      document.getElementById("chk-distribuidor") &&
      document.getElementById("chk-distribuidor").checked,
    cod_distribuidor: document.getElementById("cod-distribuidor")
      ? document.getElementById("cod-distribuidor").value.trim()
      : "",
    nombre: document.getElementById("nombre")
      ? document.getElementById("nombre").value
      : "",
    dni: document.getElementById("dni")
      ? document.getElementById("dni").value.toUpperCase()
      : "",
    fecha_nac: document.getElementById("fecha-nac")
      ? document.getElementById("fecha-nac").value
      : "",
    telefono: document.getElementById("telefono")
      ? document.getElementById("telefono").value
      : "",
    email: document.getElementById("email")
      ? document.getElementById("email").value
      : "",
    iban: document.getElementById("iban")
      ? document.getElementById("iban").value
      : "",
    cups_luz: document.getElementById("luz-cups")
      ? document.getElementById("luz-cups").value
      : "",
    movil_porta: document.getElementById("numero-porta")
      ? document.getElementById("numero-porta").value
      : "",
    movil_cambio: document.getElementById("numero-cambio")
      ? document.getElementById("numero-cambio").value
      : "",
    movilMode: movilMode,
    alarma_c1_nombre: document.getElementById("alarma-c1-nombre")
      ? document.getElementById("alarma-c1-nombre").value
      : "",
    alarma_c1_tel: document.getElementById("alarma-c1-tel")
      ? document.getElementById("alarma-c1-tel").value
      : "",
    alarma_c2_nombre: document.getElementById("alarma-c2-nombre")
      ? document.getElementById("alarma-c2-nombre").value
      : "",
    alarma_c2_tel: document.getElementById("alarma-c2-tel")
      ? document.getElementById("alarma-c2-tel").value
      : "",
    alarma_c3_nombre: document.getElementById("alarma-c3-nombre")
      ? document.getElementById("alarma-c3-nombre").value
      : "",
    alarma_c3_tel: document.getElementById("alarma-c3-tel")
      ? document.getElementById("alarma-c3-tel").value
      : "",
    envio_tipo: valEl("envio-tipo"),
    envio_via: valEl("envio-via"),
    envio_num: valEl("envio-num"),
    envio_bloque: valEl("envio-bloque"),
    envio_esc: valEl("envio-esc"),
    envio_planta: valEl("envio-planta"),
    envio_piso: valEl("envio-piso"),
    envio_cp: valEl("envio-cp"),
    envio_municipio: valEl("envio-loc"),
    envio_provincia: valEl("envio-prov"),
    fibra_misma: document.getElementById("chk-misma-dir")
      ? document.getElementById("chk-misma-dir").checked
      : false,
    fibra_tipo: document.getElementById("fibra-tipo")
      ? document.getElementById("fibra-tipo").value
      : "",
    fibra_via: valEl("fibra-via"),
    fibra_num: valEl("fibra-num"),
    fibra_bloque: valEl("fibra-bloque"),
    fibra_esc: valEl("fibra-esc"),
    fibra_planta: valEl("fibra-planta"),
    fibra_piso: valEl("fibra-piso"),
    fibra_cp: valEl("fibra-cp"),
    fibra_municipio: valEl("fibra-loc"),
    fibra_provincia: valEl("fibra-prov"),
  };
  console.log("Snapshot guardado:", formDataSnapshot);
  sendWebhookData(formDataSnapshot);
  document.getElementById("res-tarifa").textContent = selectedTariff.name;
  document.getElementById("res-nombre").textContent =
    document.getElementById("nombre").value;
  document.getElementById("res-dni").textContent = document
    .getElementById("dni")
    .value.toUpperCase();
  var fn = document.getElementById("fecha-nac").value;
  document.getElementById("res-fecha-nac").textContent = fn
    ? fn.split("-").reverse().join("/")
    : "—";
  document.getElementById("res-tel").textContent =
    document.getElementById("telefono").value;
  document.getElementById("res-email").textContent =
    document.getElementById("email").value;

  // Envío
  document.getElementById("res-envio").textContent =
    getAddrString("envio") || "—";
  // Fibra
  const blkFibra2 = document.getElementById("blk-fibra-wrap");
  const resFibraRow = document.getElementById("res-fibra-row");
  if (blkFibra2 && blkFibra2.style.display !== "none") {
    const chk = document.getElementById("chk-misma-dir");
    document.getElementById("res-fibra").textContent = chk.checked
      ? getAddrString("envio") + " (misma que envío)"
      : getAddrString("fibra");
    resFibraRow.style.display = "flex";
  } else {
    resFibraRow.style.display = "none";
  }

  // Móvil
  const blkMovil = document.getElementById("blk-movil-wrap");
  const resMovilRow = document.getElementById("res-movil-row");
  if (blkMovil && blkMovil.style.display !== "none") {
    let movilText = "";
    if (movilMode === "porta") {
      movilText =
        "Portabilidad: " + document.getElementById("numero-porta").value;
    } else if (movilMode === "alta") {
      movilText = "Alta nueva — número asignado tras activación";
    } else if (movilMode === "cambio") {
      movilText =
        "Cambio de titular: " + document.getElementById("numero-cambio").value;
    }
    document.getElementById("res-movil").textContent = movilText;
    resMovilRow.style.display = "flex";
  } else {
    resMovilRow.style.display = "none";
  }

  // Extras del upsell + líneas adicionales
  var extrasRow = document.getElementById("res-extras-row");
  var extrasDivider = document.getElementById("res-extras-divider");
  var extrasVal = document.getElementById("res-extras");
  var allExtras = (selectedTariff.extras || []).slice();
  lineasAdicionales.forEach(function (l) {
    allExtras.push({
      label: "📱 Línea adicional · " + l.label,
      price: l.price,
    });
  });
  if (allExtras.length > 0) {
    extrasVal.innerHTML = allExtras
      .map(function (e) {
        return (
          '<span style="display:block;">' +
          e.label +
          (e.price
            ? ' <em style="color:var(--accent-light);font-style:normal;">' +
              e.price +
              "</em>"
            : "") +
          "</span>"
        );
      })
      .join("");
    extrasRow.style.display = "flex";
    extrasDivider.style.display = "block";
  } else {
    extrasRow.style.display = "none";
    extrasDivider.style.display = "none";
  }

  // CUPS luz
  var resLuzRow = document.getElementById("res-luz-row");
  var blkLuzR = document.getElementById("blk-luz-wrap");
  if (blkLuzR && blkLuzR.style.display !== "none") {
    document.getElementById("res-luz-cups").textContent =
      document.getElementById("luz-cups").value || "—";
    resLuzRow.style.display = "flex";
  } else {
    resLuzRow.style.display = "none";
  }
  // Contactos alarma
  var resAlarmaRow = document.getElementById("res-alarma-row");
  var blkAlarmaR = document.getElementById("blk-alarma-wrap");
  if (blkAlarmaR && blkAlarmaR.style.display !== "none") {
    var cts = [1, 2, 3]
      .map(function (n) {
        var nom = document.getElementById("alarma-c" + n + "-nombre").value;
        var tel = document.getElementById("alarma-c" + n + "-tel").value;
        return nom ? n + "º " + nom + " · " + tel : null;
      })
      .filter(Boolean)
      .join("\n");
    document.getElementById("res-alarma-contactos").textContent = cts || "—";
    resAlarmaRow.style.display = "flex";
  } else {
    resAlarmaRow.style.display = "none";
  }

  // Total: tarifa base + extras + líneas adicionales
  var precioBase = selectedTariff.price || 0;
  var precioExtra = 0;
  var tieneEnergia = false;
  (selectedTariff.extras || []).forEach(function (e) {
    if (e.id && e.id.indexOf("energia") === 0) {
      tieneEnergia = true;
      return;
    }
    var num = typeof PRICES_NUM !== "undefined" ? PRICES_NUM[e.id] : null;
    if (num) {
      precioExtra += num;
      return;
    }
    var m = (e.price || "").match(/([0-9]+(?:[.,][0-9]+)?)/);
    if (m) precioExtra += parseFloat(m[1].replace(",", "."));
  });
  lineasAdicionales.forEach(function (l) {
    if (l.incluida) return; // Las líneas incluidas no suman precio
    var num = typeof PRICES_NUM !== "undefined" ? PRICES_NUM[l.id] : null;
    if (num) {
      precioExtra += num;
      return;
    }
    var m = (l.price || "").match(/([0-9]+(?:[.,][0-9]+)?)/);
    if (m) precioExtra += parseFloat(m[1].replace(",", "."));
  });
  var precioTotal = precioBase + precioExtra;
  var totalStr =
    precioTotal > 0
      ? precioTotal.toFixed(2).replace(".", ",") + "\u20AC/mes"
      : "Seg\u00FAn consumo";
  if (tieneEnergia)
    totalStr +=
      tieneEnergia && precioTotal > 0
        ? " + energ\u00EDa seg\u00FAn consumo"
        : "Seg\u00FAn consumo";
  document.getElementById("res-precio").textContent = totalStr;

  document.getElementById("riskWarning").style.display =
    incofisaResult === "risk" || incofisaTitularResult === "risk"
      ? "block"
      : "none";
}

// ---- SUBMIT ----
// ─── DISTRIBUIDOR ────────────────────────────────────────────────────────────
function toggleDistribuidor(chk) {
  var wrap = document.getElementById("dist-code-wrap");
  var obsWrap = document.getElementById("obs-wrap");
  if (chk.checked) {
    wrap.classList.add("visible");
    if (obsWrap) obsWrap.style.display = "block";
  } else {
    wrap.classList.remove("visible");
    document.getElementById("cod-distribuidor").value = "";
    if (obsWrap) {
      obsWrap.style.display = "none";
      document.getElementById("observaciones").value = "";
    }
  }
}


// ============================================================
// REEMPLAZO EN script.js
// ------------------------------------------------------------
// Sustituye en tu script.js el bloque que va DESDE la línea:
//     // Pega aquí la URL de tu webhook de Make cuando lo tengas
// HASTA el cierre de la función sendWebhookData (la llave } antes del
// comentario "// Pega aquí la URL de tu webhook de Make cuando lo tengas"
// que precede a "async function submitForm()").
//
// Es decir: reemplaza toda la función sendWebhookData completa.
// El resto del fichero NO se toca (submitForm sigue igual, ya no envía nada).
// ============================================================

// ─── CONFIG SUPABASE ────────────────────────────────────────────────────────
// ⚠️ EDITAR estos dos valores con los de tu proyecto:
//    Dashboard → Settings → API → Project URL  y  anon/public key
var SUPABASE_URL = "https://epetzysbwtqwjbktfkze.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZXR6eXNid3Rxd2pia3Rma3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNDg1OTcsImV4cCI6MjA5MjgyNDU5N30.Sl0bIxATm_SEWd9FBThfJUOFTGX3GcmhvmEUrRZPNOw";
var SUPABASE_BUCKET = "contrataciones-docs";

// Sube un fichero al bucket de Storage. Devuelve el path o null.
async function uploadFileToSupabase(file, dni, kind) {
  if (!file) return null;
  // Guarda extra: no subir nada que no sea PNG, JPG o PDF
  if (!esFicheroValido(file)) {
    console.error("Fichero rechazado (tipo no válido):", kind, file.type, file.name);
    return null;
  }
  var ext = (file.name.split(".").pop() || "bin").toLowerCase();
  var safeDni = String(dni || "SIN_DNI").replace(/[^A-Za-z0-9]/g, "");
  var path = safeDni + "/" + kind + "_" + Date.now() + "." + ext;
  var url =
    SUPABASE_URL + "/storage/v1/object/" + SUPABASE_BUCKET + "/" + path;
  try {
    var res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    });
    if (!res.ok) {
      console.error("Upload error " + kind + ":", res.status, await res.text());
      return null;
    }
    return path;
  } catch (err) {
    console.error("Upload exception " + kind + ":", err);
    return null;
  }
}

// Envía los datos a Supabase (se llama desde fillResumen con datos frescos)
async function sendWebhookData(s) {
  if (!s) return;
  if (!selectedTariff && s._tariff) selectedTariff = s._tariff;
  // No abortamos si falta la tarifa: la contratación entra igual (campos opcionales)
  // y se completa desde el dashboard. Usamos un objeto vacío seguro.
  var tariff = selectedTariff || { name: "", price: null, extras: [] };

  var extras = (tariff.extras || [])
    .map(function (e) {
      return e.label + (e.price ? " (" + e.price + ")" : "");
    })
    .join(", ");
  // Detalla una línea con todos sus datos (modo, número, compañía, origen, ICCID)
  function describeLinea(l) {
    var partes = [];
    if (l.mode === "porta") {
      partes.push("Portabilidad");
      if (l.numero) partes.push("Nº " + l.numero);
      if (l.compania) partes.push(l.compania);
      if (l.origen === "prepago") {
        partes.push("Prepago");
        if (l.iccid) partes.push("ICCID " + l.iccid);
      } else {
        partes.push("Contrato");
      }
    } else {
      partes.push("Alta nueva");
    }
    return partes.join(" · ");
  }
  // Líneas incluidas (sin coste) y adicionales (de pago), por separado
  var lineasIncl = lineasAdicionales.filter(function (l) { return l.incluida; });
  var lineasAdic = lineasAdicionales.filter(function (l) { return !l.incluida; });
  var lineas = lineasAdic
    .map(function (l) {
      return l.label + " · " + l.price + " · " + describeLinea(l);
    })
    .join(" || ");
  // Las incluidas se numeran a partir de la 2 (la 1 es la principal en movil_info)
  var lineasIncluidasStr = lineasIncl
    .map(function (l, idx) {
      return "Línea " + (idx + 2) + ": " + describeLinea(l);
    })
    .join(" || ");
  var isRisk = incofisaResult === "risk" || incofisaTitularResult === "risk";

  var movilInfoSnap = "";
  if (s.movilMode === "porta")
    movilInfoSnap = "Portabilidad: " + (s.movil_porta || "");
  if (s.movilMode === "alta") movilInfoSnap = "Alta nueva";
  if (s.movilMode === "cambio")
    movilInfoSnap = "Cambio titular: " + (s.movil_cambio || "");
  var envioDirSnap = formatDireccion(s, "envio");
  var fibraDirSnap = s.fibra_misma
    ? "Misma que envío"
    : formatDireccion(s, "fibra");
  var alarmaSnap = [
    s.alarma_c1_nombre ? "1º " + s.alarma_c1_nombre + " · " + s.alarma_c1_tel : "",
    s.alarma_c2_nombre ? "2º " + s.alarma_c2_nombre + " · " + s.alarma_c2_tel : "",
    s.alarma_c3_nombre ? "3º " + s.alarma_c3_nombre + " · " + s.alarma_c3_tel : "",
  ]
    .filter(Boolean)
    .join(" | ");

  var dniNum = s.dni || "SIN_DNI";
  var dniFrontEl = document.getElementById("inp-dni-front");
  var dniBackEl = document.getElementById("inp-dni-back");
  var cuentaEl = document.getElementById("inp-cuenta");
  var dniFrontFile =
    dniFrontEl && dniFrontEl.files && dniFrontEl.files[0]
      ? dniFrontEl.files[0]
      : null;
  var dniBackFile =
    dniBackEl && dniBackEl.files && dniBackEl.files[0]
      ? dniBackEl.files[0]
      : null;
  var cuentaFile =
    cuentaEl && cuentaEl.files && cuentaEl.files[0] ? cuentaEl.files[0] : null;

  // 1) Subir documentos al bucket (en paralelo)
  var uploads = await Promise.all([
    uploadFileToSupabase(dniFrontFile, dniNum, "dni_frontal"),
    uploadFileToSupabase(dniBackFile, dniNum, "dni_trasero"),
    uploadFileToSupabase(cuentaFile, dniNum, "cuenta"),
  ]);

  // 2) Insertar la contratación (estado inicial: no_iniciado)
  var payload = {
    tarifa: (tariff && tariff.name) || "",
    precio:
      tariff && tariff.price
        ? tariff.price.toFixed(2) + "€/mes"
        : "Según consumo",
    extras: extras || "Ninguno",
    lineas: lineas || "Ninguna",
    lineas_incluidas: lineasIncluidasStr || "Ninguna",
    nombre: s.nombre || "",
    dni: dniNum,
    fecha_nac: s.fecha_nac || "",
    telefono: s.telefono || "",
    email: s.email || "",
    movil_info: movilInfoSnap || "N/A",
    envio_dir: envioDirSnap || "N/A",
    fibra_dir: fibraDirSnap || "N/A",
    cups_luz: s.cups_luz || "N/A",
    alarma: alarmaSnap || "N/A",
    iban: s.iban || "N/A",
    sin_doc: !!s.sin_documentacion,
    observaciones: s.observaciones || "",
    distribuidor: !!s.distribuidor,
    cod_distribuidor: s.cod_distribuidor || null,
    riesgo: !!isRisk,
    dni_frontal_path: uploads[0],
    dni_trasero_path: uploads[1],
    cuenta_path: uploads[2],
    estado: "no_iniciado",
  };

  try {
    var res = await fetch(SUPABASE_URL + "/rest/v1/contrataciones", {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("Insert error:", res.status, await res.text());
    } else {
      console.log("Contratación guardada en Supabase correctamente");
    }
  } catch (err) {
    console.error("Error guardando contratación:", err);
  }
}

async function submitForm() {
  if (
    !document.getElementById("check-lopd").checked ||
    !document.getElementById("check-contrato").checked
  ) {
    alert("Por favor, acepta las condiciones para continuar.");
    return;
  }

  // Botón de envío: estado cargando
  var btnSubmit = document.querySelector("#section-5 .btn-primary");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Enviando...";
  }

  // ── Recoger todos los datos del formulario ──
  var extras = ((selectedTariff && selectedTariff.extras) || [])
    .map(function (e) {
      return e.label + (e.price ? " (" + e.price + ")" : "");
    })
    .join(", ");
  var lineas = lineasAdicionales
    .map(function (l) {
      return l.label + " · " + l.price;
    })
    .join(", ");
  var movilInfo = "";
  if (movilMode === "porta")
    movilInfo =
      "Portabilidad: " + (document.getElementById("numero-porta").value || "");
  if (movilMode === "alta") movilInfo = "Alta nueva";
  if (movilMode === "cambio")
    movilInfo =
      "Cambio titular: " +
      (document.getElementById("numero-cambio").value || "");
  var fibraDir = "";
  var chkMisma = document.getElementById("chk-misma-dir");
  if (chkMisma && chkMisma.checked) fibraDir = "Misma que envío";
  else
    fibraDir = [
      document.getElementById("fibra-tipo")
        ? document.getElementById("fibra-tipo").value
        : "",
      document.getElementById("fibra-via")
        ? document.getElementById("fibra-via").value
        : "",
      document.getElementById("fibra-num")
        ? document.getElementById("fibra-num").value
        : "",
      document.getElementById("fibra-cp")
        ? document.getElementById("fibra-cp").value
        : "",
      document.getElementById("fibra-municipio")
        ? document.getElementById("fibra-municipio").value
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  var envioDir = [
    document.getElementById("envio-tipo")
      ? document.getElementById("envio-tipo").value
      : "",
    document.getElementById("envio-via")
      ? document.getElementById("envio-via").value
      : "",
    document.getElementById("envio-num")
      ? document.getElementById("envio-num").value
      : "",
    document.getElementById("envio-cp")
      ? document.getElementById("envio-cp").value
      : "",
    document.getElementById("envio-municipio")
      ? document.getElementById("envio-municipio").value
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Contactos alarma
  var alarmaContactos = [1, 2, 3]
    .map(function (n) {
      var nom = document.getElementById("alarma-c" + n + "-nombre")
        ? document.getElementById("alarma-c" + n + "-nombre").value
        : "";
      var tel = document.getElementById("alarma-c" + n + "-tel")
        ? document.getElementById("alarma-c" + n + "-tel").value
        : "";
      return nom ? n + "º " + nom + " · " + tel : "";
    })
    .filter(Boolean)
    .join(" | ");

  // CUPS luz
  var cupsLuz = document.getElementById("luz-cups")
    ? document.getElementById("luz-cups").value
    : "";

  var isRisk = incofisaResult === "risk" || incofisaTitularResult === "risk";

  // ── Convertir fichero a Base64 ──
  function fileToBase64(file) {
    return new Promise(function (resolve) {
      if (!file) {
        resolve(null);
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        // Devolver solo el Base64 puro, sin el prefijo "data:...;base64,"
        var result = e.target.result;
        var base64 = result.indexOf(",") >= 0 ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Leer los 3 adjuntos en Base64 ──
  var dniNum = (
    document.getElementById("dni").value || "SIN_DNI"
  ).toUpperCase();
  var dniFrontEl = document.getElementById("inp-dni-front");
  var dniBackEl = document.getElementById("inp-dni-back");
  var cuentaEl = document.getElementById("inp-cuenta");

  var dniFrontFile =
    dniFrontEl && dniFrontEl.files && dniFrontEl.files[0]
      ? dniFrontEl.files[0]
      : null;
  var dniBackFile =
    dniBackEl && dniBackEl.files && dniBackEl.files[0]
      ? dniBackEl.files[0]
      : null;
  var cuentaFile =
    cuentaEl && cuentaEl.files && cuentaEl.files[0] ? cuentaEl.files[0] : null;

  var b64Front = await fileToBase64(dniFrontFile);
  var b64Back = await fileToBase64(dniBackFile);
  var b64Cuenta = await fileToBase64(cuentaFile);

  // ── Construir payload JSON ──
  var s = formDataSnapshot;
  console.log("Datos a enviar:", s);
  var movilInfoSnap = "";
  if (s.movilMode === "porta")
    movilInfoSnap = "Portabilidad: " + (s.movil_porta || "");
  if (s.movilMode === "alta") movilInfoSnap = "Alta nueva";
  if (s.movilMode === "cambio")
    movilInfoSnap = "Cambio titular: " + (s.movil_cambio || "");
  var envioDirSnap = formatDireccion(s, "envio");
  var fibraDirSnap = s.fibra_misma
    ? "Misma que envío"
    : formatDireccion(s, "fibra");
  var alarmaSnap = [
    s.alarma_c1_nombre
      ? "1º " + s.alarma_c1_nombre + " · " + s.alarma_c1_tel
      : "",
    s.alarma_c2_nombre
      ? "2º " + s.alarma_c2_nombre + " · " + s.alarma_c2_tel
      : "",
    s.alarma_c3_nombre
      ? "3º " + s.alarma_c3_nombre + " · " + s.alarma_c3_tel
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  var payload = {
    // Tarifa
    tarifa: (selectedTariff && selectedTariff.name) || "",
    precio:
      selectedTariff && selectedTariff.price
        ? selectedTariff.price.toFixed(2) + "€/mes"
        : "Según consumo",
    extras: extras || "Ninguno",
    lineas_adicionales: lineas || "Ninguna",
    // Cliente (desde snapshot)
    nombre: s.nombre || "",
    dni: s.dni || "",
    fecha_nac: s.fecha_nac || "",
    telefono: s.telefono || "",
    email_cliente: s.email || "",
    // Servicio (desde snapshot)
    movil_info: movilInfoSnap || "N/A",
    envio_direccion: envioDirSnap || "N/A",
    fibra_direccion: fibraDirSnap || "N/A",
    cups_luz: s.cups_luz || "N/A",
    alarma_contactos: alarmaSnap || "N/A",
    iban: s.iban || "N/A",
    // Control
    riesgo: isRisk ? "SÍ — Revisión manual requerida" : "OK",
    timestamp: (function () {
      var d = new Date();
      return (
        d.getDate().toString().padStart(2, "0") +
        "/" +
        (d.getMonth() + 1).toString().padStart(2, "0") +
        "/" +
        d.getFullYear() +
        " " +
        d.getHours().toString().padStart(2, "0") +
        ":" +
        d.getMinutes().toString().padStart(2, "0")
      );
    })(),
    // Adjuntos en Base64 (Make los adjunta al email via módulo Email IONOS/SMTP)
    adjunto_dni_frontal: b64Front
      ? {
          nombre:
            "DNI_Frontal_" + dniNum + "." + dniFrontFile.name.split(".").pop(),
          base64: b64Front,
          tipo: dniFrontFile.type,
        }
      : null,
    adjunto_dni_trasero: b64Back
      ? {
          nombre:
            "DNI_Trasero_" + dniNum + "." + dniBackFile.name.split(".").pop(),
          base64: b64Back,
          tipo: dniBackFile.type,
        }
      : null,
    adjunto_cuenta: b64Cuenta
      ? {
          nombre: "Cuenta_" + dniNum + "." + cuentaFile.name.split(".").pop(),
          base64: b64Cuenta,
          tipo: cuentaFile.type,
        }
      : null,
  };

  // El webhook ya se envió desde fillResumen — solo mostrar confirmación
  goStep(6);
  document.getElementById("stepsBar").style.display = "none";
  if (isRisk) {
    document.getElementById("successTitle").textContent =
      "¡Solicitud recibida!";
    document.getElementById("successMsg").textContent =
      "Hemos recibido tu solicitud. Un agente especializado se pondrá en contacto contigo para gestionar tu alta con la documentación adicional requerida.";
    document.getElementById("successRisk").style.display = "block";
  } else {
    document.getElementById("successTitle").textContent = "¡Alta en proceso!";
    document.getElementById("successMsg").textContent =
      "Tu solicitud ha sido enviada correctamente. Nuestro equipo la tramitará en breve y recibirás confirmación por email y WhatsApp.";
  }
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "✓ Enviar solicitud";
  }
}

/* SELFIE QR JS - DESACTIVADO (ver section4_selfie_backup.html)
// ---- SELFIE QR ─────────────────────────────────────────────────────────
let qrToken = null, qrPollTimer = null;

function initQR() {
    if (qrPollTimer) clearInterval(qrPollTimer);
    qrToken = Math.random().toString(36).slice(2,10)+Date.now().toString(36);
    try { localStorage.setItem('mm_st', qrToken); localStorage.removeItem('mm_si_'+qrToken); } catch(e) {}
    const base = window.location.href.replace(/[^/]*$/, 'selfie-movil.html');
    drawQR(base+'?t='+qrToken);
    document.getElementById('qr-status').textContent = '⏳ Esperando foto desde el móvil...';
    document.getElementById('qr-status').style.color = 'rgba(255,255,255,.4)';
    qrPollTimer = setInterval(()=>{
        try { const img = localStorage.getItem('mm_si_'+qrToken); if (img) { clearInterval(qrPollTimer); receiveSelfie(img); } } catch(e) {}
    }, 1500);
}
function renewQR() { initQR(); }

function drawQR(text) {
    var container = document.getElementById('qr-container');
    if (!container) return;
    var encoded = encodeURIComponent(text);
    container.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encoded + '" alt="QR" style="width:180px;height:180px;border-radius:8px;display:block;">';
}

function receiveSelfie(b64) {
    document.getElementById('selfie-b64').value = b64;
    document.getElementById('selfie-img').src   = b64;
    document.getElementById('panel-qr').style.display   = 'none';
    document.getElementById('selfie-done').style.display = 'block';
    document.getElementById('err-selfie').style.display  = 'none';
}
function handleSelfieFile(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => receiveSelfie(e.target.result);
    reader.readAsDataURL(file);
}
function resetSelfie() {
    document.getElementById('selfie-b64').value = '';
    document.getElementById('selfie-done').style.display = 'none';
    document.getElementById('panel-qr').style.display   = 'block';
    initQR();
}
*/

// ---- INIT ----
document.addEventListener("DOMContentLoaded", function () {
  setMovilMode("porta");
  upsellInitEvents();
  // Fecha nacimiento: max = hoy - 18 años
  (function () {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    var mm = d.getMonth() + 1;
    var dd = d.getDate();
    var maxStr =
      d.getFullYear() +
      "-" +
      (mm < 10 ? "0" : "") +
      mm +
      "-" +
      (dd < 10 ? "0" : "") +
      dd;
    var el = document.getElementById("fecha-nac");
    if (el) el.max = maxStr;
  })();

  // Auto-formato IBAN
  var ibanEl = document.getElementById("iban");
  if (ibanEl) {
    ibanEl.addEventListener("input", function () {
      var val = this.value.replace(/\s/g, "").toUpperCase();
      if (!val.startsWith("ES")) val = "ES" + val.replace(/^ES/, "");
      this.value = val
        .replace(/(.{4})/g, "$1 ")
        .trim()
        .substring(0, 29);
    });
  }

  // QR desactivado temporalmente (ver section4_selfie_backup.html)

  // Cerrar con ESC
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") upsellClose();
  });
});