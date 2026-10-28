import { MEETINGS, getMeetingLabel } from './meetings.js';

const roles = [
    {
        id: 'mainCamera',
        name: 'Cámara principal',
        color: '#4386d6',
        marker: 'P'
    },
    {
        id: 'camera1',
        name: 'Cámara 1',
        color: '#e5a13d',
        marker: '1'
    },
    {
        id: 'camera2',
        name: 'Cámara 2',
        color: '#45a581',
        marker: '2'
    },
    {
        id: 'photo',
        name: 'Cámara fotográfica',
        color: '#374151',
        marker: 'F'
    },
    {
        id: 'lyrics',
        name: 'Pantallas, letras y transmisión',
        color: '#d65f76',
        marker: 'L'
    },
    {
        id: 'stageFirst',
        name: 'Dirección de escena · alabanza',
        color: '#9b72cf',
        marker: 'A'
    },
    {
        id: 'stageSermon',
        name: 'Dirección de escena · prédica',
        color: '#9b72cf',
        marker: 'D'
    }
];

const initial = {
    first: {
        mainCamera: 'Juan Pablo',
        camera1: 'Liseth',
        camera2: 'Dylan',
        photo: 'Marco',
        lyrics: 'Joana',
        screens: '',
        mixer: '',
        stageFirst: 'Daniel',
        stageSermon: 'Joana'
    },
    second: {
        mainCamera: 'Juan Pablo',
        camera1: 'Stiven',
        camera2: 'Liseth',
        photo: '',
        lyrics: 'Joa',
        screens: '',
        mixer: '',
        stageFirst: 'Daniel',
        stageSermon: 'Daniel'
    }
};

function cloneAssignments(source) {
    const assignments = source && typeof source === 'object' ? source : {};

    return Object.fromEntries(
        MEETINGS.map(({ id }) => [id, { ...(assignments[id] || {}) }])
    );
}

let state = {
    assignments: cloneAssignments(initial),
    people: [
        'Daniel P',
        'Juan Pablo',
        'Liseth L',
        'Liseth C',
        'Dilan',
        'Marco',
        'Daniel G',
        'Johana',
        'Evelin',
        'Stiven',
        'Maicol',
        'David Mateus',
        'David Bonilla',
        'Laura',
        'David Lesmes',
        'Samuel Herrera'
    ],
    tasks: []
};

const $ = id => document.getElementById(id);
let selectedRole = 'mainCamera';

const arrivalHour = $('arrivalHour');
const arrivalMinute = $('arrivalMinute');

for (let hour = 1; hour <= 12; hour++) {
    const value = String(hour).padStart(2, '0');
    arrivalHour.add(new Option(value, value));
}

for (let minute = 0; minute < 60; minute++) {
    const value = String(minute).padStart(2, '0');
    arrivalMinute.add(new Option(value, value));
}

function setArrivalTime(value) {
    const match = value.match(/^\s*(\d{1,2}):(\d{2})(?:\s*([ap]\.?\s*m\.?))?\s*$/i);

    if (!match) {
        return;
    }

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    let period = match[3] ? match[3].toLowerCase().charAt(0).toUpperCase() + 'M' : '';

    if (minute > 59) {
        return;
    }

    if (period) {
        if (hour < 1 || hour > 12) {
            return;
        }
    } else {
        if (hour > 23) {
            return;
        }

        period = hour < 12 ? 'AM' : 'PM';
        hour = hour % 12 || 12;
    }

    arrivalHour.value = String(hour).padStart(2, '0');
    arrivalMinute.value = String(minute).padStart(2, '0');
    $('arrivalPeriod').value = period;
}

setArrivalTime('07:00');

function meetingKey() {
    return $('meeting').value;
}

function assignmentsFor(key) {
    if (!state.assignments || typeof state.assignments !== 'object') {
        state.assignments = {};
    }
    if (!state.assignments[key] || typeof state.assignments[key] !== 'object') {
        state.assignments[key] = {};
    }

    return state.assignments[key];
}

function renderAssignments() {
    let key = meetingKey();
    const assignments = assignmentsFor(key);
    $('assignments').innerHTML = '';

    roles.forEach(r => {
        const wrap = document.createElement('div');
        wrap.className = 'assign';

        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = r.color;

        const name = document.createElement('span');
        name.className = 'role';
        name.textContent = r.name;

        const sel = document.createElement('select');
        sel.setAttribute('aria-label', r.name);

        let opts = ['', ...state.people];
        opts.forEach(p => {
            let o = document.createElement('option');
            o.value = p;
            o.textContent = p || 'Sin asignar';
            sel.appendChild(o);
        });

        sel.value = assignments[r.id] || '';
        sel.addEventListener('change', () => {
            assignments[r.id] = sel.value;
            renderMap();
            $('saveStatus').textContent = 'Cambios pendientes de guardar en este dispositivo.';
        });

        wrap.append(dot, name, sel);
        $('assignments').appendChild(wrap);
    });
}

const NS = 'http://www.w3.org/2000/svg';
let selectedPost = 'mainCamera';
let mapBuilt = false;

const posts = [
    {
        id: 'stage',
        roles: ['stageFirst', 'stageSermon'],
        x: 424,
        y: 150,
        R: 46,
        r: 30,
        lx: 250,
        color: '#9b72cf',
        k: 'D',
        t: ['Dirección', 'de escena'],
        side: 'left'
    },
    {
        id: 'lyrics',
        roles: ['lyrics'],
        x: 424,
        y: 250,
        R: 46,
        r: 30,
        lx: 250,
        color: '#d65f76',
        k: 'L',
        t: ['Pantallas ·', 'letras y', 'transmisión'],
        side: 'left'
    },
    {
        id: 'camera2',
        roles: ['camera2'],
        x: 500,
        y: 552,
        color: '#45a581',
        k: 'cam',
        b: '2',
        t: ['Cámara 2'],
        side: 'left'
    },
    {
        id: 'camera1',
        roles: ['camera1'],
        x: 1535,
        y: 490,
        color: '#e5a13d',
        k: 'cam',
        b: '1',
        t: ['Cámara 1'],
        side: 'below'
    },
    {
        id: 'photo',
        roles: ['photo'],
        x: 430,
        y: 1215,
        color: '#374151',
        k: 'photo',
        b: 'F',
        t: ['Cámara fotográfica'],
        side: 'below'
    },
    {
        id: 'mainCamera',
        roles: ['mainCamera'],
        x: 1130,
        y: 1430,
        color: '#4386d6',
        k: 'cam',
        b: 'P',
        t: ['Cámara principal'],
        side: 'above'
    }
];

function el(n, a, txt) {
    const e = document.createElementNS(NS, n);

    for (const k in a) {
        e.setAttribute(k, a[k]);
    }

    if (txt != null) {
        e.textContent = txt;
    }

    return e;
}

function postNames(p) {
    const a = state.assignments[meetingKey()] || {};
    return [...new Set(p.roles.map(r => a[r]).filter(Boolean))].join(' · ');
}

function buildMap() {
    posts.forEach(p => {
        const g = el('g', {
            class: 'post',
            tabindex: 0,
            role: 'button',
            'aria-label': p.t.join(' ')
        });

        g.appendChild(el('circle', {
            class: 'halo',
            cx: p.x,
            cy: p.y,
            r: p.R || 62,
            fill: p.color,
            'fill-opacity': .15,
            stroke: p.color
        }));
        g.appendChild(el('circle', {
            cx: p.x,
            cy: p.y,
            r: p.r || 38,
            fill: p.color
        }));

        const gl = el('g', {
            transform: 'translate(' + p.x + ' ' + p.y + ')',
            fill: '#fff'
        });

        if (p.k === 'cam') {
            gl.innerHTML = '<rect x="-20" y="-11" width="26" height="22" rx="4"/><path d="M9-4L21-11V11L9 4Z"/>';
        } else if (p.k === 'photo') {
            gl.innerHTML = '<rect x="-19" y="-9" width="38" height="24" rx="4"/><rect x="-8" y="-15" width="16" height="7" rx="2"/><circle cy="3" r="7" fill="' + p.color + '"/>';
        } else if (p.k === 'D') {
            [-19, 1].forEach(x => gl.appendChild(el('rect', {
                x,
                y: -17,
                width: 18,
                height: 15,
                rx: 1
            })));

            [-19, -9, 1, 11].forEach(x => gl.appendChild(el('rect', {
                x,
                y: 1,
                width: 8,
                height: 16,
                rx: 1
            })));
        } else if (p.k === 'L') {
            gl.appendChild(el('rect', {
                x: -20,
                y: -15,
                width: 40,
                height: 28,
                rx: 3
            }));
            gl.appendChild(el('rect', {
                x: -16,
                y: -11,
                width: 32,
                height: 20,
                rx: 1,
                fill: p.color
            }));
            gl.appendChild(el('path', {
                d: 'M-3 13V17H-10V20H10V17H3V13Z'
            }));
        } else {
            gl.appendChild(el('text', {
                'text-anchor': 'middle',
                y: p.r ? 11 : 13,
                'font-size': p.r ? 32 : 38,
                'font-weight': 800,
                'font-family': 'system-ui,sans-serif'
            }, p.k));
        }

        g.appendChild(gl);

        if (p.b) {
            g.appendChild(el('circle', {
                cx: p.x + 32,
                cy: p.y - 32,
                r: 18,
                fill: '#fff',
                stroke: p.color,
                'stroke-width': 4
            }));
            g.appendChild(el('text', {
                x: p.x + 32,
                y: p.y - 24,
                'text-anchor': 'middle',
                'font-size': 24,
                'font-weight': 800,
                fill: p.color,
                'font-family': 'system-ui,sans-serif'
            }, p.b));
        }

        const L = p.t.length;
        const lh = 34;
        const R = p.R || 62;
        const an = p.side === 'left' ? 'end' : 'middle';
        const lx = p.lx || (p.side === 'left' ? p.x - R - 16 : p.x);
        const y0 = p.side === 'left'
            ? p.y - L * lh / 2 + 26
            : p.side === 'below'
                ? p.y + R + 34
                : p.y - R - 14 - (L - 1) * lh;

        p.t.forEach((t, i) => g.appendChild(el('text', {
            class: 'lbl',
            x: lx,
            y: y0 + i * lh,
            'text-anchor': an,
            'font-size': 26,
            'font-weight': 700,
            fill: '#33423a'
        }, t)));

        g.addEventListener('click', () => {
            selectedPost = p.id;
            renderMap();
        });
        g.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectedPost = p.id;
                renderMap();
            }
        });

        p.el = g;
        $('posts').appendChild(g);
    });
}

function renderMap() {
    if (!mapBuilt) {
        buildMap();
        mapBuilt = true;
    }

    posts.forEach(p => p.el.classList.toggle('selected', p.id === selectedPost));

    let h = '';
    posts.forEach(p => {
        h += '<span class="legenditem"><i class="dot" style="background:' + p.color + '"></i>' + p.t.join(' ') + '</span>';
    });
    h += '<span class="legenditem"><i class="sw" style="background:#cfe3f9;border:2px solid #3b78bf"></i>Altar</span><span class="legenditem"><i class="sw" style="background:#1f2a24"></i>Columnas</span><span class="legenditem"><i class="sw" style="background:#111;height:5px"></i>Pantallas Q1 y Q2</span><span class="legenditem"><i class="sw" style="border:2px dashed #6f8077"></i>Sillas</span>';
    $('maplegend').innerHTML = h;
    showMarkerDetail();
}

function showMarkerDetail() {
    const p = posts.find(x => x.id === selectedPost) || posts[0];
    const a = state.assignments[meetingKey()] || {};
    const b = $('markerDetail');
    b.innerHTML = '';

    const h = document.createElement('h3');
    h.textContent = p.t.join(' ');
    b.appendChild(h);

    p.roles.forEach(id => {
        const r = roles.find(x => x.id === id);
        const q = document.createElement('p');
        q.textContent = (p.roles.length > 1 ? r.name : 'Responsable') + ': ' + (a[id] || 'Sin asignar');
        b.appendChild(q);
    });

    const q = document.createElement('p');
    q.textContent = 'Reunión: ' + getMeetingLabel(meetingKey());
    b.appendChild(q);
}

let zoom = innerWidth < 760 ? 2.2 : 1;

function applyZoom() {
    $('churchMap').style.width = (zoom * 100) + '%';
}

$('zoomIn').onclick = () => {
    zoom = Math.min(4, zoom * 1.25);
    applyZoom();
};
$('zoomOut').onclick = () => {
    zoom = Math.max(1, zoom / 1.25);
    applyZoom();
};
$('zoomFit').onclick = () => {
    zoom = 1;
    applyZoom();
};
applyZoom();

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tabpage').forEach(s => s.classList.toggle('hidden', s.id !== btn.dataset.tab));

    if (btn.dataset.tab === 'mapview') {
        renderMap();
    }
}));

$('meeting').addEventListener('change', () => {
    renderAssignments();
    renderMap();
});

$('addPerson').addEventListener('click', () => {
    let p = prompt('Nombre del servidor:');

    if (p && p.trim()) {
        p = p.trim();

        if (!state.people.includes(p)) {
            state.people.push(p);
        }

        renderAssignments();
        $('saveStatus').textContent = 'Nombre añadido. Guarda los cambios para conservarlos en este dispositivo.';
    }
});

$('saveBtn').addEventListener('click', () => {
    let data = {
        state,
        date: $('serviceDate').value,
        arrival: arrivalHour.value + ':' + arrivalMinute.value + ' ' + $('arrivalPeriod').value,
        dress: $('dress').value,
        dressColor: $('dressColor').value,
        notes: $('generalNotes').value
    };

    try {
        localStorage.setItem('cmbAvPrototype', JSON.stringify(data));
        $('saveStatus').textContent = 'Guardado en este navegador el ' + new Date().toLocaleString('es-CO');
    } catch (e) {
        $('saveStatus').textContent = 'No se pudo guardar en este navegador.';
    }
});

$('resetBtn').addEventListener('click', () => {
    if (confirm('¿Restablecer los datos de ejemplo?')) {
        state = {
            assignments: cloneAssignments(initial),
            people: [
                'Juan Pablo',
                'Liseth',
                'Dylan',
                'Marco',
                'Daniel',
                'Joana',
                'Stiven',
                'Joa',
                'Maicol',
                'Evelyn',
                'David Bonilla',
                'Lau'
            ],
            tasks: []
        };
        renderAssignments();
        renderMap();
        $('saveStatus').textContent = 'Ejemplo restablecido. Guarda para conservarlo en este dispositivo.';
    }
});

$('addTask').addEventListener('click', () => {
    let v = $('extraTask').value.trim();

    if (!v) {
        return;
    }

    let label = document.createElement('label');
    label.className = 'task';

    let cb = document.createElement('input');
    cb.type = 'checkbox';

    let span = document.createElement('span');
    span.textContent = v;

    label.append(cb, span);
    $('tasks').append(label);
    $('extraTask').value = '';
});

$('dressColor').addEventListener('input', () => {
    const names = {
        '#244a38': 'Verde oscuro',
        '#ffffff': 'Blanco',
        '#000000': 'Negro',
        '#0000ff': 'Azul',
        '#ff0000': 'Rojo'
    };

    if (names[$('dressColor').value]) {
        $('dress').value = names[$('dressColor').value];
    }
});

try {
    const saved = localStorage.getItem('cmbAvPrototype');

    if (saved) {
        const d = JSON.parse(saved);

        if (d.state && typeof d.state === 'object') {
            state = {
                ...d.state,
                assignments: cloneAssignments(d.state.assignments),
                people: Array.isArray(d.state.people) ? d.state.people : state.people,
                tasks: Array.isArray(d.state.tasks) ? d.state.tasks : []
            };
        }
        if (d.date) $('serviceDate').value = d.date;
        if (d.arrival) setArrivalTime(d.arrival);
        if (d.dress) $('dress').value = d.dress;
        if (d.dressColor) $('dressColor').value = d.dressColor;
        if (d.notes) $('generalNotes').value = d.notes;

        $('saveStatus').textContent = 'Se cargaron los últimos datos guardados en este navegador.';
    }
} catch (e) {}

renderAssignments();
renderMap();
