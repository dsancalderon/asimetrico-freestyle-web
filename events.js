/* ═══════════════════════════════════════════════════════════════
   ASIMÉTRICO — Eventos dinámicos desde Google Sheets
═══════════════════════════════════════════════════════════════ */

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2_4w2L9jarbBx1i6AD0z_YFse-vEnzwmmAGpYuUaR7xY7fO7KzJbMCJLUuiv8kK3JV8gnreg1SXAO/pub?gid=0&single=true&output=csv';
const CORS_PROXY    = 'https://corsproxy.io/?url=';

const MESES_CORTO = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

// ── Parsear CSV ──
function parseCSV(text) {
  const rows = [];
  for (const line of text.trim().split(/\r?\n/)) {
    const cols = [];
    let cur = '', inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

// ── Parsear fecha: acepta DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, o texto libre ──
function parseDate(str) {
  if (!str) return null;
  str = str.trim();
  // DD/MM/YYYY o DD-MM-YYYY
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  // YYYY-MM-DD
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

// ── Formatear fecha para mostrar ──
function formatDate(str) {
  const d = parseDate(str);
  if (!d) return { dia: str || '?', mes: '' }; // si no parsea, muestra el texto crudo
  return { dia: d.getDate(), mes: MESES_CORTO[d.getMonth()] };
}

// ── Parsear fecha+hora para countdown ──
function parseDateTime(str) {
  if (!str) return null;
  const parts = str.trim().split(' ');
  const d = parseDate(parts[0]);
  if (!d) return null;
  if (parts[1]) {
    const [h, min] = parts[1].split(':').map(Number);
    d.setHours(h, min, 0);
  } else {
    d.setHours(23, 59, 0);
  }
  return d;
}

// ── Countdown legible ──
function countdownText(target) {
  const diff = target - Date.now();
  if (diff <= 0) return 'Formulario cerrado';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const min = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `Cierra en ${d}d ${h}h ${min}m`;
  if (h > 0) return `Cierra en ${h}h ${min}m`;
  return `Cierra en ${min} minutos`;
}

// ── Config visual por estado ──
const ESTADO_CONFIG = {
  inscripcion_abierta: { label: 'Inscripción Abierta', cls: 'open' },
  proximo:             { label: 'Próximamente',         cls: 'upcoming' },
  en_vivo:             { label: '🔴 En vivo',           cls: 'live' },
  finalizado:          { label: 'Finalizado',           cls: 'done' },
  final:               { label: 'Gran Final',           cls: 'final' }
};

// ── Construir fila ──
function buildEventRow(ev) {
  const { dia, mes }  = formatDate(ev.fecha);
  const cfg     = ESTADO_CONFIG[ev.estado] || ESTADO_CONFIG.proximo;
  const hasForm = ev.link_form && ev.link_form.startsWith('http');
  const isDone  = ev.estado === 'finalizado';
  const isLive  = ev.estado === 'en_vivo';

  const row = document.createElement('div');
  row.className = `event-row${isDone ? ' event-row--done' : ''}${isLive ? ' event-row--live' : ''}`;

  const liveIndicator = isLive ? `<span class="event-live-dot"></span>` : '';
  const nota    = ev.nota ? `<span class="event-nota">${ev.nota}</span>` : '';
  const mesHtml = mes ? `<small>${mes}</small>` : '';
  const formBtn = hasForm
    ? `<button class="event-form-btn" onclick="openModal(event,${JSON.stringify({
        nombre: ev.nombre, lugar: ev.lugar,
        link: ev.link_form, cierre: ev.cierre_form || '', nota: ev.nota || ''
      })})">Inscribirse →</button>`
    : '';

  row.innerHTML = `
    <div class="event-date">${dia}${mesHtml}</div>
    <div class="event-divider"></div>
    <div class="event-info">
      <p class="event-name">${ev.nombre}</p>
      <p class="event-place">${ev.lugar}</p>
      ${nota}
    </div>
    <span class="event-badge ${cfg.cls}">${liveIndicator}${cfg.label}</span>
    ${formBtn}
    <span class="event-arrow">→</span>
  `;
  return row;
}

// ── Modal ──
let cdInterval = null;

function openModal(e, data) {
  e.stopPropagation();
  document.getElementById('modal-event-name').textContent = data.nombre;
  document.getElementById('modal-event-info').textContent = data.lugar + (data.nota ? ' · ' + data.nota : '');
  const link = document.getElementById('modal-form-link');
  link.href = data.link;
  link.className = 'btn-primary modal-btn';
  link.textContent = 'Ir al formulario →';

  if (cdInterval) clearInterval(cdInterval);
  const cdEl = document.getElementById('modal-countdown');
  cdEl.innerHTML = '';

  if (data.cierre) {
    const target = parseDateTime(data.cierre);
    if (target) {
      const update = () => {
        const txt     = countdownText(target);
        const expired = target <= Date.now();
        cdEl.innerHTML = `<span class="modal-cd-icon">${expired ? '🔒' : '⏳'}</span>
                          <span class="modal-cd-text ${expired ? 'expired' : ''}">${txt}</span>`;
        if (expired) {
          link.classList.add('btn-disabled');
          link.textContent = 'Formulario cerrado';
          clearInterval(cdInterval);
        }
      };
      update();
      cdInterval = setInterval(update, 30000);
    }
  }

  document.getElementById('inscription-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('inscription-modal').hidden = true;
  document.body.style.overflow = '';
  if (cdInterval) clearInterval(cdInterval);
}

document.addEventListener('click', e => {
  const modal = document.getElementById('inscription-modal');
  if (!modal.hidden && e.target === modal) closeModal();
});

// ── UI helpers ──
function showLoading() {
  document.getElementById('events-loading').hidden = false;
  document.getElementById('events-error').hidden   = true;
  document.getElementById('events-list').hidden    = true;
}
function showError() {
  document.getElementById('events-loading').hidden = true;
  document.getElementById('events-error').hidden   = false;
  document.getElementById('events-list').hidden    = true;
}
function showList() {
  document.getElementById('events-loading').hidden = true;
  document.getElementById('events-error').hidden   = true;
  document.getElementById('events-list').hidden    = false;
}

// ── Cargar desde Sheets ──
async function loadEvents() {
  showLoading();

  let text = null;

  // 1) Intento directo
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (res.ok) text = await res.text();
  } catch (_) {}

  // 2) Proxy CORS si falló
  if (!text) {
    try {
      const res = await fetch(CORS_PROXY + encodeURIComponent(SHEET_CSV_URL), { cache: 'no-store' });
      if (res.ok) text = await res.text();
    } catch (_) {}
  }

  if (!text) { showError(); return; }

  // Parsear — fila 0 son encabezados
  const rows   = parseCSV(text);
  const events = rows.slice(1)
    .filter(r => r[1]) // nombre obligatorio
    .map(r => ({
      fecha:       r[0] || '',
      nombre:      r[1] || '',
      lugar:       r[2] || '',
      estado:      (r[3] || 'proximo').trim().toLowerCase().replace(/ /g,'_'),
      link_form:   r[4] || '',
      cierre_form: r[5] || '',
      nota:        r[6] || ''
    }));

  const listEl = document.getElementById('events-list');
  listEl.innerHTML = '';

  if (events.length === 0) {
    listEl.innerHTML = '<p style="color:rgba(255,255,255,.4);font-family:\'Barlow Condensed\',sans-serif;letter-spacing:.2em;text-transform:uppercase;padding:48px 0;">No hay eventos programados aún.</p>';
  } else {
    events.forEach(ev => listEl.appendChild(buildEventRow(ev)));
  }

  showList(); // solo muestra la lista cuando ya está lista — nunca junto al error
}

loadEvents();