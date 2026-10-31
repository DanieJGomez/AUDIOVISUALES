import { MEETINGS, getMeetingLabel } from './meetings.js';
import { findScheduleAssignmentConflicts } from './assignment-conflicts.js';
import {
    readData,
    subscribeToConnection,
} from './database.js';
import { cameraConePath, normalizeAngle } from './camera-orientation.js';
import {
    signInWithGoogleUser,
    signOutUser,
    subscribeToAuthState,
} from './auth.js';
import {
    saveScheduleIfUnchanged,
    saveScheduleProjectionIfUnchanged,
    publishScheduleProjectionIfUnchanged,
    subscribeToPublicSchedule,
    subscribeToSchedule,
} from './scheduling.js';

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
        name: 'Transmisión, pantallas y letras',
        color: '#d65f76',
        marker: 'L'
    },
    {
        id: 'stageFirst',
        segment: 'worship',
        name: 'Dirección de escena · alabanza',
        color: '#9b72cf',
        marker: 'A'
    },
    {
        id: 'stageSermon',
        segment: 'sermon',
        name: 'Dirección de escena · prédica',
        color: '#9b72cf',
        marker: 'D'
    }
];

const initial = { first: {}, second: {} };
const PREDEFINED_PEOPLE = [
    'Juan Pablo', 'Liseth Chiquiza','Lizeth Londoño', 'Dilan', 'Marco',
     'Daniel Gomez','Evelin','Daniel Pineda','David Mateus',
     'Johana','Samuel Herrera',
    'Stiven', 'Maicol', 'Evelin', 'David Bonilla', 'Laura'
];

function cloneAssignments(source) {
    const assignments = source && typeof source === 'object' ? source : {};

    return Object.fromEntries(
        MEETINGS.map(({ id }) => [id, { ...(assignments[id] || {}) }])
    );
}

let state = {
    assignments: cloneAssignments(initial),
    people: [],
    tasks: []
};

const $ = id => document.getElementById(id);
if (!$('serviceDate').value) {
    const today = new Date();
    $('serviceDate').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
let selectedRole = 'mainCamera';
let currentUser = null;
let isEditor = false;
let scheduleUnsubscribe = null;
let projectionUnsubscribe = null;
let scheduleBaseline = null;
let projectionBaseline = null;
let latestRemoteSchedule = null;
let scheduleDirty = false;
let scheduleConflict = false;
let scheduleReadReady = false;
let projectionReadReady = false;
let isSaving = false;
let isAdmin = false;
let localTestMode = false;
let authCheckSequence = 0;
let databaseOnline = false;
let activeRoute = null;
let legacySavedDate = '';
const routeDrafts = new Map();
const LOCAL_TEST_SCHEDULES_KEY = 'cmbAvLocalTestSchedules';
let localTestPeople = [...PREDEFINED_PEOPLE];

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
const exampleDetails = {
    arrival: '07:00 AM',
    dress: $('dress').value,
    dressColor: $('dressColor').value,
    notes: $('generalNotes').value
};
const exampleTasks = Array.from(document.querySelectorAll('#tasks .task')).map((item) => ({
    text: item.textContent.trim().replace(/\s+/g, ' '),
    completed: Boolean(item.querySelector('input')?.checked)
}));

function meetingKey() {
    return $('meeting').value;
}

function routeKey(route) {
    return `${route.date}/${route.meeting}`;
}

function selectedRoute() {
    return { date: $('serviceDate').value, meeting: meetingKey() };
}

function canEditSchedule() {
    return localTestMode || (isEditor && databaseOnline && scheduleReadReady && projectionReadReady && !scheduleConflict && !isSaving);
}

function stableJson(value) {
    if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(stableJson(item))));
    if (value && typeof value === 'object') {
        return JSON.stringify(Object.fromEntries(
            Object.keys(value).sort().map((key) => [key, JSON.parse(stableJson(value[key]))])
        ));
    }
    return JSON.stringify(value);
}

function currentAssignmentConflicts() {
    const route = activeRoute || selectedRoute();
    return findScheduleAssignmentConflicts([{
        date: route.date,
        meeting: route.meeting,
        assignments: state.assignments?.[route.meeting] || {},
    }], roles);
}

function updateAssignmentConflictStatus(conflicts = currentAssignmentConflicts()) {
    const status = $('assignmentConflictStatus');
    if (conflicts.length) {
        status.textContent = conflicts.map(({ person, firstRole, secondRole, date, meeting }) =>
            `${person}: ${firstRole} y ${secondRole} · ${date} · ${getMeetingLabel(meeting)}`
        ).join(' | ');
        status.classList.add('is-error');
        return;
    }
    const route = activeRoute || selectedRoute();
    status.textContent = `Sin conflictos detectados · ${route.date} · ${getMeetingLabel(route.meeting)}.`;
    status.classList.remove('is-error');
}

function updateEditorControls() {
    const enabled = canEditSchedule();
    const conflicts = currentAssignmentConflicts();
    updateAssignmentConflictStatus(conflicts);
    document.body.classList.toggle('public-view', !isEditor && !localTestMode);
    $('localTestModeBtn').classList.toggle('hidden', isEditor || localTestMode);
    $('exitLocalTestModeBtn').classList.toggle('hidden', !localTestMode);
    $('localRosterHint').classList.toggle('hidden', !localTestMode);
    $('localTestStatus').textContent = localTestMode
        ? 'Modo de prueba local activo. Los cambios se guardan solo en este navegador; Firebase no se modifica.'
        : 'La prueba local se guarda solo en este navegador; no se sincroniza con Firebase.';
    [
        'arrivalHour', 'arrivalMinute', 'arrivalPeriod', 'dress', 'dressColor',
        'generalNotes', 'saveBtn', 'resetBtn', 'extraTask', 'extraTaskAssignee', 'addTask'
    ].forEach((id) => { $(id).disabled = !enabled; });
    $('saveBtn').disabled = !enabled || conflicts.length > 0;
    document.querySelectorAll('#tasks input').forEach((input) => { input.disabled = !enabled; });
    $('publishScheduleBtn').classList.toggle('hidden', !isAdmin);
    $('publishScheduleBtn').disabled = !isAdmin || !databaseOnline || !scheduleReadReady
        || !projectionReadReady || !scheduleBaseline || scheduleDirty || isSaving || scheduleConflict;
    $('saveBtn').textContent = enabled
        ? localTestMode ? 'Guardar borrador local' : 'Guardar para todos'
        : isEditor ? 'Esperando conexión y lectura' : 'Inicia sesión para editar';
}

function scheduleRecord(route = selectedRoute()) {
    const currentAssignments = state.assignments?.[route.meeting] || {};
    const assignments = Object.fromEntries(
        roles.filter(({ id }) => typeof currentAssignments[id] === 'string')
            .map(({ id }) => [id, currentAssignments[id]])
    );
    const tasks = Array.from(document.querySelectorAll('#tasks .task')).map((item) => ({
        text: item.querySelector('[data-task-text]')?.textContent.trim().replace(/\s+/g, ' ') || '',
        completed: Boolean(item.querySelector('input')?.checked),
        assignee: item.querySelector('[data-task-assignee]')?.textContent.replace(/^Responsable:\s*/, '').trim() || ''
    })).filter((item) => item.text);

    return {
        assignments,
        people: Array.isArray(state.people) ? [...state.people] : [],
        tasks,
        arrival: `${arrivalHour.value}:${arrivalMinute.value} ${$('arrivalPeriod').value}`,
        dress: $('dress').value,
        dressColor: $('dressColor').value,
        notes: $('generalNotes').value
    };
}

function createTaskElement(task) {
    if (!task || typeof task.text !== 'string') return null;
    const label = document.createElement('label');
    label.className = 'task';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed === true;
    checkbox.disabled = !canEditSchedule();
    checkbox.addEventListener('change', markScheduleDirty);
    const detail = document.createElement('span');
    const text = document.createElement('span');
    text.dataset.taskText = 'true';
    text.textContent = task.text;
    detail.append(text);
    if (typeof task.assignee === 'string' && task.assignee.trim()) {
        const assignee = document.createElement('small');
        assignee.className = 'sub task-assignee';
        assignee.dataset.taskAssignee = 'true';
        assignee.textContent = `Responsable: ${task.assignee.trim()}`;
        detail.append(document.createElement('br'), assignee);
    }
    label.append(checkbox, detail);
    return label;
}

function renderTasks(tasks) {
    if (!Array.isArray(tasks)) return;
    const list = $('tasks');
    list.replaceChildren();
    tasks.forEach((task) => {
        const element = createTaskElement(task);
        if (element) list.append(element);
    });
}

function refreshTaskAssigneeOptions() {
    const select = $('extraTaskAssignee');
    if (!select) return;
    const current = select.value;
    select.replaceChildren(new Option('Sin responsable', ''));
    const people = [...new Set([...state.people, current].filter(Boolean))];
    people.forEach((person) => select.add(new Option(person, person)));
    select.value = current;
}

function applyScheduleRecord(record) {
    const route = selectedRoute();
    if (record && typeof record === 'object') {
        state.assignments = {
            ...state.assignments,
            [route.meeting]: record.assignments && typeof record.assignments === 'object'
                ? { ...record.assignments }
                : {}
        };
        state.people = Array.isArray(record.people) ? [...record.people] : [];
        state.tasks = Array.isArray(record.tasks) ? [...record.tasks] : [];
        setArrivalTime(typeof record.arrival === 'string' ? record.arrival : exampleDetails.arrival);
        $('dress').value = typeof record.dress === 'string' ? record.dress : exampleDetails.dress;
        $('dressColor').value = typeof record.dressColor === 'string' ? record.dressColor : exampleDetails.dressColor;
        $('generalNotes').value = typeof record.notes === 'string' ? record.notes : '';
        renderTasks(state.tasks);
    } else {
        state.people = [];
        state.tasks = [];
        state.assignments = {
            ...state.assignments,
            [route.meeting]: { ...(initial[route.meeting] || {}) }
        };
        setArrivalTime(exampleDetails.arrival);
        $('dress').value = exampleDetails.dress;
        $('dressColor').value = exampleDetails.dressColor;
        $('generalNotes').value = exampleDetails.notes;
        renderTasks(exampleTasks);
    }
    renderAssignments();
    renderMap();
    updateEditorControls();
}

function applyPublicProjection(projection) {
    const route = selectedRoute();
    const assignments = projection?.published === true && projection.assignments
        && typeof projection.assignments === 'object'
        ? { ...projection.assignments }
        : {};
    state.assignments = { ...state.assignments, [route.meeting]: assignments };
    state.people = [...new Set(Object.values(assignments).filter((name) => typeof name === 'string' && name))];
    state.tasks = [];
    $('generalNotes').value = '';
    $('dress').value = '';
    renderTasks([]);
    renderAssignments();
    renderMap();
    updateEditorControls();
}

function updateSaveStatus(message) {
    $('saveStatus').textContent = message;
}

function markScheduleDirty() {
    if (!canEditSchedule()) return;
    scheduleDirty = true;
    updateSaveStatus(localTestMode
        ? 'Borrador local con cambios sin guardar; no se enviará a Firebase.'
        : 'Hay cambios sin guardar. Se conservarán localmente al guardar.');
}

function saveLocalSnapshot(route = selectedRoute()) {
    state.tasks = scheduleRecord(route).tasks;
    const data = {
        state,
        date: route.date,
        arrival: `${arrivalHour.value}:${arrivalMinute.value} ${$('arrivalPeriod').value}`,
        dress: $('dress').value,
        dressColor: $('dressColor').value,
        notes: $('generalNotes').value
    };

    try {
        const previous = localStorage.getItem('cmbAvPrototype');
        if (previous && !localStorage.getItem('cmbAvPrototypeBackup')) {
            localStorage.setItem('cmbAvPrototypeBackup', previous);
        }
        localStorage.setItem('cmbAvPrototype', JSON.stringify(data));
        routeDrafts.set(routeKey(route), scheduleRecord(route));
        return true;
    } catch {
        return false;
    }
}

function readLocalTestData(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function saveLocalTestDraft(route = selectedRoute()) {
    try {
        const drafts = readLocalTestData(LOCAL_TEST_SCHEDULES_KEY, {});
        drafts[routeKey(route)] = scheduleRecord(route);
        localStorage.setItem(LOCAL_TEST_SCHEDULES_KEY, JSON.stringify(drafts));
        scheduleDirty = false;
        updateSaveStatus('Borrador local guardado en este navegador. No se envió a Firebase.');
        return true;
    } catch {
        updateSaveStatus('No se pudo guardar el borrador local en este navegador.');
        return false;
    }
}

function loadLocalTestDraft(route = selectedRoute()) {
    const drafts = readLocalTestData(LOCAL_TEST_SCHEDULES_KEY, {});
    const record = drafts?.[routeKey(route)];
    state.people = [...localTestPeople];
    state.assignments = { ...state.assignments, [route.meeting]: { ...(record?.assignments || {}) } };
    state.tasks = Array.isArray(record?.tasks) ? [...record.tasks] : [];
    setArrivalTime(typeof record?.arrival === 'string' ? record.arrival : exampleDetails.arrival);
    $('dress').value = typeof record?.dress === 'string' ? record.dress : exampleDetails.dress;
    $('dressColor').value = typeof record?.dressColor === 'string' ? record.dressColor : exampleDetails.dressColor;
    $('generalNotes').value = typeof record?.notes === 'string' ? record.notes : '';
    renderTasks(state.tasks);
    renderAssignments();
    renderMap();
    updateSaveStatus(record ? 'Borrador local cargado desde este navegador.' : 'Prueba local vacía. Elige personas de la lista predefinida para las asignaciones.');
    $('cloudStatus').textContent = 'Modo de prueba local · estos datos no se leen ni se escriben en Firebase.';
    document.querySelectorAll('#tasks input').forEach((input) => {
        input.disabled = false;
        input.addEventListener('change', markScheduleDirty);
    });
}

function enterLocalTestMode() {
    if (scheduleUnsubscribe) scheduleUnsubscribe();
    if (projectionUnsubscribe) projectionUnsubscribe();
    scheduleUnsubscribe = null;
    projectionUnsubscribe = null;
    localTestPeople = [...PREDEFINED_PEOPLE];
    state = { assignments: cloneAssignments(initial), people: [...localTestPeople], tasks: [] };
    localTestMode = true;
    scheduleDirty = false;
    loadLocalTestDraft(activeRoute || selectedRoute());
    updateEditorControls();
}

function exitLocalTestMode() {
    if (scheduleDirty) saveLocalTestDraft(activeRoute || selectedRoute());
    localTestMode = false;
    scheduleDirty = false;
    activeRoute = selectedRoute();
    updateEditorControls();
    watchSchedule(activeRoute);
}

function watchSchedule(route) {
    if (localTestMode) return;
    if (scheduleUnsubscribe) scheduleUnsubscribe();
    if (projectionUnsubscribe) projectionUnsubscribe();
    scheduleBaseline = null;
    projectionBaseline = null;
    latestRemoteSchedule = null;
    scheduleReadReady = false;
    projectionReadReady = false;
    scheduleConflict = false;
    $('reloadRemoteBtn').classList.add('hidden');
    $('cloudStatus').textContent = `Cargando programación de ${route.date}…`;
    updateEditorControls();

    if (!isEditor) {
        applyPublicProjection(null);
        scheduleUnsubscribe = subscribeToPublicSchedule(route.date, route.meeting, (value) => {
            if (!activeRoute || routeKey(activeRoute) !== routeKey(route)) return;
            projectionBaseline = value;
            projectionReadReady = true;
            scheduleReadReady = true;
            applyPublicProjection(value);
            $('cloudStatus').textContent = value?.published === true
                ? `Asignaciones publicadas · ${route.date} · ${getMeetingLabel(route.meeting)}`
                : 'Esta programación todavía no se ha publicado.';
            updateEditorControls();
        }, (error) => {
            if (!activeRoute || routeKey(activeRoute) !== routeKey(route)) return;
            scheduleReadReady = false;
            projectionReadReady = false;
            applyPublicProjection(null);
            $('cloudStatus').textContent = 'No hay una vista pública disponible para esta programación.';
            console.error('Error leyendo la proyección pública:', error);
            updateEditorControls();
        });
        return;
    }

    projectionUnsubscribe = subscribeToPublicSchedule(route.date, route.meeting, (value) => {
        if (!activeRoute || routeKey(activeRoute) !== routeKey(route)) return;
        projectionBaseline = value;
        projectionReadReady = true;
        updateEditorControls();
    }, (error) => {
        if (!activeRoute || routeKey(activeRoute) !== routeKey(route)) return;
        projectionReadReady = false;
        $('cloudStatus').textContent = 'No se pudo leer el estado de publicación; la edición queda bloqueada.';
        console.error('Error leyendo el estado de publicación:', error);
        updateEditorControls();
    });

    scheduleUnsubscribe = subscribeToSchedule(route.date, route.meeting, (value) => {
        if (!activeRoute || routeKey(activeRoute) !== routeKey(route)) return;
        latestRemoteSchedule = value;
        if (scheduleDirty && !isSaving && stableJson(value) !== stableJson(scheduleBaseline)) {
            const localSaved = saveLocalSnapshot(route);
            scheduleConflict = true;
            $('reloadRemoteBtn').classList.remove('hidden');
            $('cloudStatus').textContent = localSaved
                ? 'Hay una versión más reciente en Firebase. Tus cambios locales se conservaron en este dispositivo.'
                : 'Hay una versión más reciente en Firebase y no se pudo crear una copia local. No se sobrescribieron datos.';
            updateEditorControls();
            return;
        }

        scheduleBaseline = value;
        scheduleReadReady = true;
        if (value) {
            applyScheduleRecord(value);
            routeDrafts.set(routeKey(route), scheduleRecord(route));
            $('cloudStatus').textContent = `Programación compartida cargada · ${route.date} · ${getMeetingLabel(route.meeting)}`;
        } else {
            const localDraft = routeDrafts.get(routeKey(route));
            applyScheduleRecord(localDraft || null);
            $('cloudStatus').textContent = localDraft
                ? 'No hay una versión compartida; se conservó la copia local de esta programación.'
                : 'Aún no hay una versión compartida; se muestran los datos de ejemplo.';
        }
        scheduleConflict = false;
        updateEditorControls();
    }, (error) => {
        if (!activeRoute || routeKey(activeRoute) !== routeKey(route)) return;
        scheduleReadReady = false;
        $('cloudStatus').textContent = 'No se pudo leer Firebase; se conserva la copia local. Revisa las reglas públicas.';
        updateEditorControls();
        console.error('Error leyendo programación de Firebase:', error);
    });
}

function changeScheduleRoute() {
    const nextRoute = selectedRoute();
    if (activeRoute && routeKey(nextRoute) === routeKey(activeRoute)) return;

    if (scheduleDirty) {
        const conflicts = currentAssignmentConflicts();
        if (conflicts.length) {
            updateAssignmentConflictStatus(conflicts);
            alert(conflicts.map(({ person, firstRole, secondRole }) =>
                `${person}: ${firstRole} y ${secondRole}`
            ).join('\n'));
            $('serviceDate').value = activeRoute.date;
            $('meeting').value = activeRoute.meeting;
            return;
        }
        const keepLocal = confirm('Hay cambios sin guardar. Guardaré una copia local antes de cambiar de programación.');
        if (!keepLocal) {
            $('serviceDate').value = activeRoute.date;
            $('meeting').value = activeRoute.meeting;
            return;
        }
        if (localTestMode) saveLocalTestDraft(activeRoute);
        else saveLocalSnapshot(activeRoute);
    }

    scheduleDirty = false;
    activeRoute = nextRoute;
    if (localTestMode) {
        loadLocalTestDraft(activeRoute);
        updateEditorControls();
        return;
    }
    watchSchedule(activeRoute);
    renderAssignments();
    renderMap();
}

function checkEditorAuthorization(user, sequence) {
    return Promise.all([
        readData(`access/admins/${user.uid}`),
        readData(`access/editors/${user.uid}`)
    ]).then(([admin, editor]) => {
        if (sequence !== authCheckSequence) return;
        isAdmin = admin === true;
        isEditor = admin === true || editor === true;
        $('authStatus').textContent = isEditor
            ? `Sesión de edición autorizada: ${user.email || user.uid}`
            : `Sesión iniciada (${user.email || user.uid}), sin autorización para editar.`;
        updateEditorControls();
        if (activeRoute) watchSchedule(activeRoute);
    }).catch((error) => {
        if (sequence !== authCheckSequence) return;
        isAdmin = false;
        isEditor = false;
        $('authStatus').textContent = 'No se pudo verificar el permiso del editor. La edición queda desactivada.';
        console.error('Error verificando permisos del editor:', error);
        updateEditorControls();
        if (activeRoute) watchSchedule(activeRoute);
    });
}

subscribeToAuthState((user) => {
    currentUser = user;
    const sequence = ++authCheckSequence;
    $('loginBtn').classList.toggle('hidden', Boolean(user));
    $('logoutBtn').classList.toggle('hidden', !user);

    if (!user) {
        isAdmin = false;
        isEditor = false;
        $('authStatus').textContent = 'La consulta pública no requiere iniciar sesión.';
        updateEditorControls();
        if (activeRoute) watchSchedule(activeRoute);
        return;
    }

    isAdmin = false;
    isEditor = false;
    $('authStatus').textContent = 'Verificando autorización de edición…';
    updateEditorControls();
    if (activeRoute) watchSchedule(activeRoute);
    checkEditorAuthorization(user, sequence);
});

$('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('loginBtn').disabled = true;
    $('authStatus').textContent = 'Iniciando sesión con Google…';

    try {
        await signInWithGoogleUser();
    } catch (error) {
        $('authStatus').textContent =
            error?.code === 'auth/popup-closed-by-user'
                ? 'Se cerró la ventana de inicio de sesión.'
                : `No se pudo iniciar sesión: ${error?.code || 'error de autenticación'}`;
    } finally {
        $('loginBtn').disabled = false;
    }
});

$('logoutBtn').addEventListener('click', async () => {
    try {
        await signOutUser();
    } catch (error) {
        $('authStatus').textContent = `No se pudo cerrar sesión: ${error?.code || 'error'}`;
    }
});

subscribeToConnection((online) => {
    databaseOnline = online;
    $('connectionStatus').textContent = online
        ? 'Conexión Realtime Database: en línea'
        : 'Conexión Realtime Database: sin conexión';
    updateEditorControls();
}, () => {
    databaseOnline = false;
    $('connectionStatus').textContent = 'No se pudo comprobar la conexión con Firebase.';
    updateEditorControls();
});

$('reloadRemoteBtn').addEventListener('click', () => {
    if (!confirm('Descartar los cambios locales de esta programación y cargar la versión compartida?')) return;
    scheduleDirty = false;
    scheduleConflict = false;
    scheduleBaseline = latestRemoteSchedule;
    if (latestRemoteSchedule) {
        applyScheduleRecord(latestRemoteSchedule);
        $('cloudStatus').textContent = 'Se cargó la versión compartida más reciente.';
    } else {
        applyScheduleRecord(null);
        $('cloudStatus').textContent = 'No hay una versión compartida; se muestran los datos de ejemplo.';
    }
    $('reloadRemoteBtn').classList.add('hidden');
    updateEditorControls();
});

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

        const currentAssignment = assignments[r.id] || '';
        const roster = [...new Set([...state.people, currentAssignment].filter(Boolean))];
        let opts = ['', ...roster];
        opts.forEach(p => {
            let o = document.createElement('option');
            o.value = p;
            o.textContent = p || 'Sin asignar';
            sel.appendChild(o);
        });

        sel.value = assignments[r.id] || '';
        sel.disabled = !canEditSchedule();
        sel.addEventListener('change', () => {
            if (!canEditSchedule()) return;
            assignments[r.id] = sel.value;
            renderMap();
            markScheduleDirty();
            updateEditorControls();
        });

        wrap.append(dot, name, sel);
        $('assignments').appendChild(wrap);
    });
    refreshTaskAssigneeOptions();
}

const NS = 'http://www.w3.org/2000/svg';
let selectedPost = 'mainCamera';
let mapBuilt = false;
const cameraOrientations = { mainCamera: -90, camera1: -150, camera2: -30 };
const cameraIds = new Set(Object.keys(cameraOrientations));

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
        t: ['Transmisión,', 'pantallas y', 'letras'],
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
    const coneLayer = el('g', { id: 'cameraCones', 'aria-hidden': 'true' });
    $('churchMap').insertBefore(coneLayer, $('posts'));
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

        if (cameraIds.has(p.id)) {
            const cone = el('g', { class: 'camera-cone', transform: `translate(${p.x} ${p.y}) rotate(${cameraOrientations[p.id]})` });
            cone.appendChild(el('path', { d: cameraConePath(), fill: p.color, 'fill-opacity': '.16', stroke: p.color, 'stroke-opacity': '.65', 'stroke-width': 5 }));
            coneLayer.appendChild(cone);
            p.cone = cone;
        }
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

    posts.forEach(p => {
        p.el.classList.toggle('selected', p.id === selectedPost);
        if (p.cone) p.cone.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${cameraOrientations[p.id]})`);
    });

    let h = '';
    posts.forEach(p => {
        h += '<span class="legenditem"><i class="dot" style="background:' + p.color + '"></i>' + p.t.join(' ') + '</span>';
    });
    h += '<span class="legenditem"><i class="sw" style="background:#cfe3f9;border:2px solid #3b78bf"></i>Altar</span><span class="legenditem"><i class="sw" style="background:#1f2a24"></i>Columnas</span><span class="legenditem"><i class="sw" style="border:2px dashed #6f8077"></i>Sillas</span>';
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

    if (cameraIds.has(p.id)) {
        const controls = document.createElement('div');
        controls.className = 'camera-orientation';
        const label = document.createElement('label');
        const input = document.createElement('input');
        const value = document.createElement('output');
        input.type = 'range';
        input.min = '-180';
        input.max = '180';
        input.step = '5';
        input.value = cameraOrientations[p.id] > 180 ? cameraOrientations[p.id] - 360 : cameraOrientations[p.id];
        input.setAttribute('aria-label', `Orientación de ${p.t.join(' ')}`);
        label.textContent = 'Orientación aproximada';
        value.textContent = `${input.value}°`;
        input.addEventListener('input', () => {
            cameraOrientations[p.id] = normalizeAngle(input.value);
            value.textContent = `${input.value}°`;
            if (p.cone) p.cone.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${input.value})`);
        });
        controls.append(label, input, value);
        const hint = document.createElement('p');
        hint.className = 'camera-hint';
        hint.textContent = 'Cono esquemático; posición, alcance y ángulo deben calibrarse con el plano real.';
        controls.appendChild(hint);
        b.appendChild(controls);
    }

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
    changeScheduleRoute();
});
$('serviceDate').addEventListener('change', changeScheduleRoute);
$('localTestModeBtn').addEventListener('click', enterLocalTestMode);
$('exitLocalTestModeBtn').addEventListener('click', exitLocalTestMode);

function setServiceDate(date) {
    $('serviceDate').value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    changeScheduleRoute();
}

$('previousDayBtn').addEventListener('click', () => {
    const [year, month, day] = $('serviceDate').value.split('-').map(Number);
    setServiceDate(new Date(year, month - 1, day - 1));
});
$('nextDayBtn').addEventListener('click', () => {
    const [year, month, day] = $('serviceDate').value.split('-').map(Number);
    setServiceDate(new Date(year, month - 1, day + 1));
});
$('todayBtn').addEventListener('click', () => setServiceDate(new Date()));

['arrivalHour', 'arrivalMinute', 'arrivalPeriod', 'dress', 'dressColor', 'generalNotes']
    .forEach((id) => $(id).addEventListener('change', markScheduleDirty));
$('generalNotes').addEventListener('input', markScheduleDirty);

$('saveBtn').addEventListener('click', async () => {
    const assignmentConflicts = currentAssignmentConflicts();
    updateAssignmentConflictStatus(assignmentConflicts);
    if (assignmentConflicts.length) {
        const messages = assignmentConflicts.map(({ person, firstRole, secondRole }) => `${person}: ${firstRole} y ${secondRole}`);
        alert(`Hay asignaciones incompatibles:\n${messages.join('\n')}\n\nAlabanza y prédica pueden tener responsables distintos si son segmentos diferentes.`);
        updateSaveStatus('No se guardó: corrige primero los conflictos indicados.');
        return;
    }
    if (localTestMode) {
        saveLocalTestDraft(activeRoute || selectedRoute());
        return;
    }
    if (!isEditor) return;
    if (!saveLocalSnapshot(activeRoute || selectedRoute())) {
        updateSaveStatus('No se pudo guardar la copia local; no se envió a Firebase.');
        return;
    }
    if (!canEditSchedule()) {
        updateSaveStatus('Copia local guardada. Firebase no está listo o existe un conflicto; no se sobrescribió la versión compartida.');
        return;
    }

    const assignments = state.assignments?.[meetingKey()] || {};
    const conflicts = findAssignmentConflicts(assignments, roles);
    if (conflicts.length) {
        const messages = conflicts.map(({ person, firstRole, secondRole }) => `${person}: ${firstRole} y ${secondRole}`);
        alert(`Hay asignaciones incompatibles:\n${messages.join('\n')}\n\nAlabanza y prédica sí pueden tener responsables distintos.`);
        updateSaveStatus('Copia local guardada. Revisa las asignaciones antes de compartirlas.');
        return;
    }

    const route = activeRoute || selectedRoute();
    if (projectionBaseline?.published === true && !confirm('Al guardar, la vista publica pasara a no publicada. Un administrador tendra que aprobarla de nuevo. Continuar?')) return;
    const payload = {
        ...(scheduleBaseline && typeof scheduleBaseline === 'object' ? scheduleBaseline : {}),
        ...scheduleRecord(route),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid
    };
    isSaving = true;
    updateEditorControls();
    updateSaveStatus('Guardando en Firebase…');
    try {
        if (projectionBaseline?.published === true) {
            const unpublished = await saveScheduleProjectionIfUnchanged(
                route.date, route.meeting, scheduleBaseline, projectionBaseline
            );
            if (!unpublished.committed) {
                projectionBaseline = unpublished.snapshot.exists() ? unpublished.snapshot.val() : null;
                $('cloudStatus').textContent = 'La proyeccion cambio antes del guardado. No se modifico la fuente privada; revisa y reintenta.';
                updateSaveStatus('No se guardo: la publicacion cambio en paralelo.');
                return;
            }
            projectionBaseline = unpublished.snapshot.val();
        }
        const result = await saveScheduleIfUnchanged(route.date, route.meeting, payload, scheduleBaseline);
        if (!result.committed) {
            latestRemoteSchedule = result.snapshot.exists() ? result.snapshot.val() : null;
            scheduleConflict = true;
            $('reloadRemoteBtn').classList.remove('hidden');
            $('cloudStatus').textContent = 'Otra persona guardó una versión más reciente. No se sobrescribieron sus cambios.';
            updateSaveStatus('Conflicto detectado. Recarga la versión compartida o conserva tu copia local.');
            return;
        }
        scheduleBaseline = result.snapshot.val();
        latestRemoteSchedule = scheduleBaseline;
        routeDrafts.set(routeKey(route), scheduleBaseline);
        try {
            const projectionResult = await saveScheduleProjectionIfUnchanged(
                route.date, route.meeting, scheduleBaseline, projectionBaseline
            );
            if (!projectionResult.committed) {
                $('cloudStatus').textContent = 'La fuente privada se guardo, pero la proyeccion publica cambio en paralelo. No se reemplazo; vuelve a guardar para reintentar.';
                updateSaveStatus('Guardado privado confirmado; falta sincronizar la proyeccion publica.');
                scheduleDirty = false;
                return;
            }
            projectionBaseline = projectionResult.snapshot.val();
        } catch (projectionError) {
            $('cloudStatus').textContent = 'La fuente privada se guardo, pero no se pudo sincronizar la proyeccion publica. Reintenta guardar.';
            updateSaveStatus(`Guardado privado confirmado; proyeccion pendiente (${projectionError?.code || 'error'}).`);
            scheduleDirty = false;
            console.error('Error sincronizando la proyeccion publica:', projectionError);
            return;
        }
        scheduleDirty = false;
        scheduleConflict = false;
        $('reloadRemoteBtn').classList.add('hidden');
        $('cloudStatus').textContent = `Programación compartida guardada · ${new Date().toLocaleTimeString('es-CO')}`;
        updateSaveStatus('Guardado en este dispositivo y compartido con los editores autorizados.');
    } catch (error) {
        updateSaveStatus(`No se pudo guardar en Firebase (${error?.code || 'error'}). La copia local se conservó.`);
        console.error('Error guardando programación:', error);
    } finally {
        isSaving = false;
        updateEditorControls();
    }
});

$('publishScheduleBtn').addEventListener('click', async () => {
    if (!isAdmin || !scheduleBaseline || scheduleDirty || !canEditSchedule()) return;
    if (!confirm('Esto hara publicos unicamente los nombres asignados a puestos en esta reunion. No publicara lista de personas, tareas, horario, vestimenta, avisos ni UID. Confirmas la publicacion?')) return;

    const route = activeRoute || selectedRoute();
    isSaving = true;
    updateEditorControls();
    try {
        const result = await publishScheduleProjectionIfUnchanged(
            route.date, route.meeting, scheduleBaseline, projectionBaseline
        );
        if (!result.committed) {
            projectionBaseline = result.snapshot.exists() ? result.snapshot.val() : null;
            $('cloudStatus').textContent = 'La proyeccion cambio antes de publicar. Se conserva la version mas reciente; vuelve a revisar.';
            return;
        }
        projectionBaseline = result.snapshot.val();
        $('cloudStatus').textContent = 'Publicacion confirmada: solo se exponen las asignaciones de esta reunion.';
        updateSaveStatus('La programacion publica ya muestra las asignaciones aprobadas.');
    } catch (error) {
        $('cloudStatus').textContent = `No se pudo publicar la proyeccion (${error?.code || 'error'}).`;
        console.error('Error publicando la proyeccion:', error);
    } finally {
        isSaving = false;
        updateEditorControls();
    }
});

$('resetBtn').addEventListener('click', () => {
    if (confirm('Vaciar la programacion privada de esta reunion? Guarda para confirmar el cambio.')) {
        state = {
            assignments: cloneAssignments(initial),
            people: localTestMode ? [...localTestPeople] : [],
            tasks: []
        };
        $('extraTaskAssignee').value = '';
        setArrivalTime(exampleDetails.arrival);
        $('dress').value = exampleDetails.dress;
        $('dressColor').value = exampleDetails.dressColor;
        $('generalNotes').value = exampleDetails.notes;
        renderTasks([]);
        renderAssignments();
        renderMap();
        updateEditorControls();
        markScheduleDirty();
    }
});

$('addTask').addEventListener('click', () => {
    const text = $('extraTask').value.trim();
    if (!text) return;
    const task = createTaskElement({
        text,
        completed: false,
        assignee: $('extraTaskAssignee').value,
    });
    if (task) $('tasks').append(task);
    $('extraTask').value = '';
    $('extraTaskAssignee').value = '';
    markScheduleDirty();
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
        if (d.date) {
            $('serviceDate').value = d.date;
            legacySavedDate = d.date;
        }
        if (d.arrival) setArrivalTime(d.arrival);
        if (d.dress) $('dress').value = d.dress;
        if (d.dressColor) $('dressColor').value = d.dressColor;
        if (d.notes) $('generalNotes').value = d.notes;

        $('saveStatus').textContent = 'Se cargaron los últimos datos guardados en este navegador.';
    }
} catch (e) {}

renderTasks(state.tasks);
renderAssignments();
renderMap();
document.querySelectorAll('#tasks input').forEach((input) => {
    input.disabled = !canEditSchedule();
    input.addEventListener('change', markScheduleDirty);
});
if (legacySavedDate) {
    for (const meeting of MEETINGS) {
        const route = { date: legacySavedDate, meeting: meeting.id };
        routeDrafts.set(routeKey(route), scheduleRecord(route));
    }
}
applyPublicProjection(null);
activeRoute = selectedRoute();
watchSchedule(activeRoute);
updateEditorControls();
