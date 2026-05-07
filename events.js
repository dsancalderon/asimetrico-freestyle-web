/* ═══════════════════════════════════════════════════════════════
   ASIMÉTRICO — Eventos dinámicos desde Google Sheets
═══════════════════════════════════════════════════════════════ */

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2_4w2L9jarbBx1i6AD0z_YFse-vEnzwmmAGpYuUaR7xY7fO7KzJbMCJLUuiv8kK3JV8gnreg1SXAO/pub?gid=0&single=true&output=csv';
const CORS_PROXY    = 'https://corsproxy.io/?url=';
const MAX_VISIBLE   = 4;

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

// ── Parsear fecha: acepta DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD ──
function parseDate(str) {
  if (!str) return null;
  str = str.trim();
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

// ── Formatear fecha para mostrar ──
function formatDate(str) {
  const d = parseDate(str);
  if (!d) return { dia: str || '?', mes: '' };
  return { dia: d.getDate(), mes: MESES_CORTO[d.getMonth()] };
}

// ── Config visual por estado ──
const ESTADO_CONFIG = {
  inscripcion_abierta:  { label: 'Inscripción Abierta', cls: 'open' },
  inscripcion_cerrada:  { label: 'Inscripción Cerrada', cls: 'done' },
  pendiente:            { label: 'Pendiente',            cls: 'pending' },
  proximo:              { label: 'Próximamente',         cls: 'upcoming' },
  en_vivo:              { label: '🔴 En vivo',           cls: 'live' },
  finalizado:           { label: 'Finalizado',           cls: 'done' },
  final:                { label: 'Gran Final',           cls: 'final' }
};

// ── Construir fila ──
function buildEventRow(ev) {
  const { dia, mes } = formatDate(ev.fecha);
  const cfg    = ESTADO_CONFIG[ev.estado] || ESTADO_CONFIG.proximo;
  const isDone = ['finalizado', 'inscripcion_cerrada'].includes(ev.estado);
  const isLive = ev.estado === 'en_vivo';
  const isOpen = ev.estado === 'inscripcion_abierta';

  // Link: añade https:// si falta el protocolo
  const rawLink  = (ev.link_form || '').trim();
  const fullLink = rawLink
    ? (rawLink.startsWith('http') ? rawLink : 'https://' + rawLink)
    : '';

  const formBtn = isOpen && fullLink
    ? `<a href="${fullLink}" target="_blank" rel="noopener" class="event-form-btn" style="text-decoration:none;text-align:center;display:inline-block;" onclick="event.stopPropagation()">Quiero ir</a>`
    : `<button class="event-form-btn btn-disabled" disabled onclick="event.stopPropagation()">Inscripciones cerradas</button>`;

  const row = document.createElement('div');
  row.className = `event-row${isDone ? ' event-row--done' : ''}${isLive ? ' event-row--live' : ''}`;

  row.innerHTML = `
    <div class="event-date">${dia}<small>${mes}</small></div>
    <div class="event-divider"></div>
    <div class="event-info">
      <p class="event-name">${ev.nombre}</p>
      <p class="event-place">${ev.lugar}</p>
      ${ev.nota ? `<span class="event-nota">${ev.nota}</span>` : ''}
    </div>
    <span class="event-badge ${cfg.cls}">${isLive ? '<span class="event-live-dot"></span>' : ''}${cfg.label}</span>
    ${formBtn}
    <span class="event-arrow">→</span>
  `;

  return row;
}

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

  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (res.ok) text = await res.text();
  } catch (_) {}

  if (!text) {
    try {
      const res = await fetch(CORS_PROXY + encodeURIComponent(SHEET_CSV_URL), { cache: 'no-store' });
      if (res.ok) text = await res.text();
    } catch (_) {}
  }

  if (!text) { showError(); return; }

  const rows   = parseCSV(text);
  const events = rows.slice(1)
    .filter(r => r[1])
    .map(r => ({
      fecha:     r[0] || '',
      nombre:    r[1] || '',
      lugar:     r[2] || '',
      estado:    (r[3] || 'proximo').trim().toLowerCase().replace(/\s+/g, '_'),
      link_form: r[4] || '',
      nota:      r[6] || ''
    }));

  const listEl = document.getElementById('events-list');
  listEl.innerHTML = '';

  if (events.length === 0) {
    listEl.innerHTML = '<p style="color:rgba(255,255,255,.4);font-family:\'Barlow Condensed\',sans-serif;letter-spacing:.2em;text-transform:uppercase;padding:48px 0;">No hay eventos programados aún.</p>';
    showList();
    return;
  }

  // Renderizar los primeros MAX_VISIBLE
  events.forEach((ev, i) => {
    const row = buildEventRow(ev);
    if (i >= MAX_VISIBLE) row.classList.add('event-row--hidden');
    listEl.appendChild(row);
  });

  // Botón "Ver más" solo si hay eventos extra
  if (events.length > MAX_VISIBLE) {
    const extra = events.length - MAX_VISIBLE;
    const wrap  = document.createElement('div');
    wrap.className = 'events-toggle-wrap';
    wrap.innerHTML = `
      <button class="events-toggle-btn" id="events-toggle-btn">
        Ver ${extra} evento${extra > 1 ? 's' : ''} más
        <span class="events-toggle-arrow">↓</span>
      </button>
    `;
    listEl.appendChild(wrap);

    let expanded = false;
    wrap.querySelector('#events-toggle-btn').addEventListener('click', () => {
      expanded = !expanded;
      listEl.querySelectorAll('.event-row--hidden').forEach(r => {
        r.style.display = expanded ? '' : 'none';
      });
      // Sincronizar display inicial
      if (expanded) {
        listEl.querySelectorAll('.event-row--hidden').forEach(r => r.style.display = '');
      }
      wrap.querySelector('#events-toggle-btn').innerHTML = expanded
        ? `Mostrar menos <span class="events-toggle-arrow events-toggle-arrow--up">↑</span>`
        : `Ver ${extra} evento${extra > 1 ? 's' : ''} más <span class="events-toggle-arrow">↓</span>`;
    });

    // Ocultar los extras inicialmente via JS (refuerza el CSS)
    listEl.querySelectorAll('.event-row--hidden').forEach(r => r.style.display = 'none');
  }

  showList();
}

loadEvents();