/* ── Clock ───────────────────────────────────────────────────────────── */
const clockEl         = document.getElementById('clock');
const spotlightClockEl = document.getElementById('spotlight-clock');

function tickClock() {
  const now  = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  clockEl.textContent          = time;
  spotlightClockEl.textContent = time;
}
tickClock();
setInterval(tickClock, 1000);

/* ── State ───────────────────────────────────────────────────────────── */
let state = {
  year:  parseInt(document.getElementById('cal-title').dataset.year  || new Date().getFullYear()),
  month: parseInt(document.getElementById('cal-title').dataset.month || new Date().getMonth() + 1),
};

(function initState() {
  const firstCell = document.querySelector('.cal-cell[data-year]');
  if (firstCell) {
    state.year  = parseInt(firstCell.dataset.year);
    state.month = parseInt(firstCell.dataset.month);
  }
})();

// Google Calendar events for the currently displayed month: { "day": [{summary, time, all_day}] }
let gcalEvents = {};

/* ── Google Calendar helpers ─────────────────────────────────────────── */
async function loadGcalEvents(year, month) {
  try {
    const res  = await fetch(`/gcal/events/${year}/${month}`);
    const data = await res.json();
    gcalEvents = data.connected ? (data.events || {}) : {};
  } catch (e) {
    gcalEvents = {};
  }
  applyGcalDots();
}

function applyGcalDots() {
  document.querySelectorAll('.cal-cell[data-day]').forEach(cell => {
    const day = cell.dataset.day;
    const events = gcalEvents[day];
    if (events && events.length > 0) {
      cell.classList.add('has-gcal');
      if (!cell.querySelector('.gcal-dot')) {
        const dot = document.createElement('span');
        dot.className = 'gcal-dot';
        cell.appendChild(dot);
      }
    }
  });
}

/* ── Spotlight helpers ───────────────────────────────────────────────── */
function updateSpotlight(year, month, day, msgData, events) {
  const d = new Date(year, month - 1, day);
  document.getElementById('s-weekday').textContent =
    d.toLocaleDateString('en-US', { weekday: 'long' });
  document.getElementById('s-day').textContent = day;
  document.getElementById('s-month').textContent =
    d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const msgEl = document.getElementById('spotlight-msg');
  const msg   = msgData && msgData.title ? msgData : null;

  const gcalHtml = (events && events.length)
    ? `<ul class="gcal-events">${events.map(e =>
        `<li><span class="gcal-time">${e.all_day ? 'all-day' : esc(e.time || '')}</span>${esc(e.summary)}</li>`
      ).join('')}</ul>`
    : '';

  document.getElementById('quote-block').style.display = 'none';

  msgEl.style.animation = 'none';
  requestAnimationFrame(() => {
    msgEl.style.animation = '';
    if (msg) {
      msgEl.innerHTML = `<h2 class="msg-title">${esc(msg.title)}</h2>
         <p class="msg-body">${esc(msg.content || '')}</p>${gcalHtml}`;
    } else if (gcalHtml) {
      msgEl.innerHTML = `<h2 class="msg-title empty-hint">No message for this day</h2>${gcalHtml}`;
    } else {
      msgEl.innerHTML = `<h2 class="msg-title empty-hint">No message for this day</h2>
         <p class="msg-body empty-sub">Click ✎ to add one.</p>`;
    }
  });

  document.getElementById('btn-edit-today').onclick = () =>
    openModal(year, month, day, msgData);
}

/* ── Calendar rendering ──────────────────────────────────────────────── */
function renderCalendar(data) {
  document.getElementById('cal-title').textContent =
    `${data.month_name} ${data.year}`;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  const today = data.today;

  data.weeks.forEach(week => {
    week.forEach(day => {
      const cell = document.createElement('div');
      if (day === 0) {
        cell.className = 'cal-cell empty';
      } else {
        const isToday = (day === today.day && data.month === today.month && data.year === today.year);
        const hasMsg  = !!data.day_messages[day];
        cell.className = 'cal-cell' + (isToday ? ' today' : '') + (hasMsg ? ' has-msg' : '');
        cell.dataset.year  = data.year;
        cell.dataset.month = data.month;
        cell.dataset.day   = day;

        const numSpan = document.createElement('span');
        numSpan.className   = 'day-num';
        numSpan.textContent = day;
        cell.appendChild(numSpan);

        if (hasMsg) {
          const dot = document.createElement('span');
          dot.className = 'day-dot';
          cell.appendChild(dot);
        }

        cell.addEventListener('click', () => handleDayClick(data.year, data.month, day));
      }
      grid.appendChild(cell);
    });
  });

  state.year  = data.year;
  state.month = data.month;

  // Re-apply gcal dots after grid re-render
  applyGcalDots();

  document.getElementById('prev-month').onclick = () =>
    navigateTo(data.prev.year, data.prev.month);
  document.getElementById('next-month').onclick = () =>
    navigateTo(data.next.year, data.next.month);
}

async function navigateTo(year, month) {
  try {
    const [calRes] = await Promise.all([
      fetch(`/calendar/${year}/${month}`),
      loadGcalEvents(year, month),   // run in parallel
    ]);
    const data = await calRes.json();
    renderCalendar(data);
    applyGcalDots();  // gcalEvents may have arrived by now
  } catch (e) {
    console.error('Failed to navigate:', e);
  }
}

/* ── Day click ───────────────────────────────────────────────────────── */
async function handleDayClick(year, month, day) {
  document.querySelectorAll('.cal-cell.selected').forEach(c => c.classList.remove('selected'));
  const clicked = document.querySelector(
    `.cal-cell[data-year="${year}"][data-month="${month}"][data-day="${day}"]`
  );
  if (clicked) clicked.classList.add('selected');

  try {
    const res  = await fetch(`/message/${year}/${month}/${day}`);
    const data = await res.json();
    updateSpotlight(year, month, day, data.message, gcalEvents[String(day)] || []);
  } catch (e) {
    updateSpotlight(year, month, day, null, gcalEvents[String(day)] || []);
  }
}

/* ── Initial cell click handlers ─────────────────────────────────────── */
document.querySelectorAll('.cal-cell:not(.empty)').forEach(cell => {
  cell.addEventListener('click', () =>
    handleDayClick(
      parseInt(cell.dataset.year),
      parseInt(cell.dataset.month),
      parseInt(cell.dataset.day),
    )
  );
});

/* ── Edit today button ───────────────────────────────────────────────── */
(function initTodayEdit() {
  const today = new Date();
  document.getElementById('btn-edit-today').onclick = async () => {
    const y = today.getFullYear(), m = today.getMonth() + 1, d = today.getDate();
    const res  = await fetch(`/message/${y}/${m}/${d}`);
    const data = await res.json();
    openModal(y, m, d, data.message);
  };
})();

/* ── Navigation button initial setup ─────────────────────────────────── */
(function initNav() {
  const firstCell = document.querySelector('.cal-cell[data-year]');
  if (!firstCell) return;
  const y = parseInt(firstCell.dataset.year);
  const m = parseInt(firstCell.dataset.month);

  const prevM = m === 1  ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
  const nextM = m === 12 ? { year: y + 1, month:  1 } : { year: y, month: m + 1 };

  document.getElementById('prev-month').onclick = () => navigateTo(prevM.year, prevM.month);
  document.getElementById('next-month').onclick = () => navigateTo(nextM.year, nextM.month);
})();

/* ── Modal ───────────────────────────────────────────────────────────── */
const overlay   = document.getElementById('modal-overlay');
const modalDate = document.getElementById('modal-date-label');
const titleIn   = document.getElementById('field-title');
const bodyIn    = document.getElementById('field-content');
const btnSave   = document.getElementById('btn-save');
const btnDel    = document.getElementById('btn-delete');

let modalCtx = null;

function openModal(year, month, day, existing) {
  modalCtx = { year, month, day };

  const d = new Date(year, month - 1, day);
  modalDate.textContent = d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  titleIn.value = existing?.title   || '';
  bodyIn.value  = existing?.content || '';
  btnDel.style.display = existing?.title ? 'block' : 'none';

  overlay.classList.add('open');
  titleIn.focus();
}

function closeModal() {
  overlay.classList.remove('open');
  modalCtx = null;
}

document.getElementById('modal-close').onclick = closeModal;
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

btnSave.onclick = async () => {
  if (!modalCtx) return;
  const { year, month, day } = modalCtx;
  const title   = titleIn.value.trim();
  const content = bodyIn.value.trim();

  if (!title) { titleIn.focus(); return; }

  await fetch(`/message/${year}/${month}/${day}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });

  closeModal();
  await refreshAll(year, month, day);
};

btnDel.onclick = async () => {
  if (!modalCtx) return;
  const { year, month, day } = modalCtx;
  await fetch(`/message/${year}/${month}/${day}`, { method: 'DELETE' });
  closeModal();
  await refreshAll(year, month, day);
};

async function refreshAll(year, month, day) {
  const [calRes, msgRes] = await Promise.all([
    fetch(`/calendar/${state.year}/${state.month}`),
    fetch(`/message/${year}/${month}/${day}`),
  ]);
  const calData = await calRes.json();
  const msgData = await msgRes.json();
  renderCalendar(calData);
  updateSpotlight(year, month, day, msgData.message, gcalEvents[String(day)] || []);
}

/* ── Keyboard shortcuts ──────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') btnSave.click();
});

/* ── Utility ─────────────────────────────────────────────────────────── */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Todo list ───────────────────────────────────────────────────────── */
const todoList          = document.getElementById('todo-list');
const todoForm          = document.getElementById('todo-form');
const todoInput         = document.getElementById('todo-input');
const todoAssigneeInput = document.getElementById('todo-assignee-input');
const todoCount         = document.getElementById('todo-count');

// Generate a stable pastel colour from a name string
const AVATAR_COLORS = ['#4f8ef7','#e67e22','#2ecc71','#9b59b6','#e74c3c','#1abc9c','#f39c12','#3498db'];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function avatarInitials(name) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

async function loadTodos() {
  const res   = await fetch('/todos');
  const todos = await res.json();
  renderTodos(todos);
}

function renderTodos(todos) {
  todoList.innerHTML = '';
  const remaining = todos.filter(t => !t.done).length;
  todoCount.textContent = remaining > 0 ? `${remaining} left` : todos.length ? 'all done!' : '';

  todos.forEach(todo => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' done' : '');

    // Check button
    const check = document.createElement('button');
    check.className = 'todo-check';
    check.innerHTML = todo.done ? '✓' : '';
    check.setAttribute('aria-label', todo.done ? 'Mark incomplete' : 'Mark complete');
    check.addEventListener('pointerup', () => toggleTodo(todo.id, !todo.done));

    // Text
    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;

    // Assignee avatar (tappable to edit)
    const assignee = (todo.assignee || '').trim();
    const avatar = document.createElement('button');
    avatar.className = 'todo-avatar' + (assignee ? '' : ' empty');
    avatar.setAttribute('aria-label', assignee ? `Assigned to ${assignee}` : 'Assign');
    if (assignee) {
      avatar.textContent = avatarInitials(assignee);
      avatar.style.background = avatarColor(assignee);
      avatar.title = assignee;
    } else {
      avatar.textContent = '+';
    }
    avatar.addEventListener('pointerup', () => editAssignee(todo.id, assignee, avatar));

    // Delete
    const del = document.createElement('button');
    del.className = 'todo-del';
    del.innerHTML = '✕';
    del.setAttribute('aria-label', 'Delete task');
    del.addEventListener('pointerup', () => deleteTodo(todo.id));

    li.append(check, span, avatar, del);
    todoList.appendChild(li);
  });
}

function editAssignee(id, current, avatarEl) {
  // Inline mini-input overlaid on the avatar
  const input = document.createElement('input');
  input.className = 'todo-avatar-edit';
  input.value     = current;
  input.placeholder = 'Name…';
  input.maxLength = 60;
  avatarEl.replaceWith(input);
  input.focus();
  input.select();

  async function commit() {
    const name = input.value.trim();
    await fetch(`/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee: name }),
    });
    loadTodos();
  }
  input.addEventListener('blur',  commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); loadTodos(); }
  });
}

async function toggleTodo(id, done) {
  await fetch(`/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  });
  loadTodos();
}

async function deleteTodo(id) {
  await fetch(`/todos/${id}`, { method: 'DELETE' });
  loadTodos();
}

todoForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text     = todoInput.value.trim();
  const assignee = todoAssigneeInput.value.trim();
  if (!text) return;
  todoInput.value         = '';
  todoAssigneeInput.value = '';
  await fetch('/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, assignee }),
  });
  loadTodos();
  todoInput.focus();
});

loadTodos();

/* ── Weather ─────────────────────────────────────────────────────────── */
async function loadWeather() {
  try {
    const res  = await fetch('/weather');
    const data = await res.json();
    if (data.error) return;

    const widget = document.getElementById('weather-widget');
    document.getElementById('weather-icon').textContent      = data.icon;
    document.getElementById('weather-temp').textContent      = `${data.temp}°F`;
    document.getElementById('weather-feels').textContent     = `feels ${data.feels_like}°`;
    document.getElementById('weather-condition').textContent = data.condition;
    document.getElementById('weather-quip').textContent      = data.quip;
    document.getElementById('weather-meta').textContent      =
      `💨 ${data.wind} km/h  ·  💧 ${data.humidity}%` +
      (data.city ? `  ·  📍 ${data.city}` : '');

    widget.style.display = 'flex';
  } catch (e) {
    console.warn('Weather unavailable:', e);
  }
}

// Refresh weather every 10 minutes
loadWeather();
setInterval(loadWeather, 10 * 60 * 1000);

/* ── Init: load gcal events for current month and update today spotlight ── */
(async function init() {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth() + 1, d = today.getDate();

  const [, msgRes] = await Promise.all([
    loadGcalEvents(y, m),
    fetch(`/message/${y}/${m}/${d}`),
  ]);
  const msgData = await msgRes.json();

  const todayEvents = gcalEvents[String(d)] || [];
  const hasMsg = !!(msgData.message && msgData.message.title);

  if (todayEvents.length > 0) {
    updateSpotlight(y, m, d, msgData.message, todayEvents);
  }

  // Show quote of the day when no user message exists for today
  if (!hasMsg) {
    try {
      const qRes  = await fetch('/quote');
      const qData = await qRes.json();
      if (qData.quote) {
        const quoteBlock = document.getElementById('quote-block');
        quoteBlock.querySelector('.quote-text').textContent  = qData.quote;
        quoteBlock.querySelector('.quote-author').textContent = `— ${qData.author}`;
        quoteBlock.style.display = 'block';
        // Hide empty-state prompt since quote is taking its place
        const emptyHint = document.querySelector('#spotlight-msg .empty-hint');
        const emptySub  = document.querySelector('#spotlight-msg .empty-sub');
        if (emptyHint) emptyHint.style.display = 'none';
        if (emptySub)  emptySub.style.display  = 'none';
      }
    } catch (e) {
      // quote unavailable, leave empty-state as-is
    }
  }
})();
