const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);

const PORT = 3001;
const DATA_FILE = path.join(__dirname, "data", "notifications.json");
const DASHBOARDS_FILE = path.join(__dirname, "data", "dashboards.json");

// JWT — mismo secret que local-server.js
const JWT_SECRET = "cari-local-dev-secret-2024";

app.use(cors());

/* ---------- Mock users + login/user-context (copiado de local-server.js) ---------- */
const USERS = [
  { id: "1", username: "admin@cari.com", password: "admin123", name: "Admin Local", role: "admin" },
  { id: "2", username: "user@cari.com",  password: "user123",  name: "Usuario Local", role: "user" },
];

const MENU_BY_ROLE = {
  admin: [
    { code: "dashboards", items: [{ code: "dashboards.attendances", path: "/attendance" }, { code: "dashboards.list", path: "/dashboards-list" }] },
    { code: "reports",    items: [{ code: "reports.payroll", path: "/prenomina-data" }] },
  ],
  user: [
    { code: "dashboards", items: [{ code: "dashboards.attendances", path: "/attendance" }] },
  ],
};

const PERMISSIONS_BY_ROLE = {
  admin: ["read", "write", "delete", "export"],
  user:  ["read"],
};

const JWT_EXPIRES_IN = "8h";

app.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ message: "Credenciales requeridas" });

  const user = USERS.find((u) => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: "Usuario o contraseña incorrectos" });

  const token = jwt.sign(
    { sub: user.id, path: "", userContext: "/user-context" },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.json({ token });
});

app.get("/user-context", requireAuth, (req, res) => {
  const user = USERS.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const menu = MENU_BY_ROLE[user.role] ?? [];
  const permissions = PERMISSIONS_BY_ROLE[user.role] ?? [];

  return res.json({
    user: { id: user.id, name: user.name, role: user.role },
    menu,
    permissions,
  });
});
/* --------------------------------------------------------------------------------- */


// ── Auth middleware ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token requerido" });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}

// ── Dashboards persistence ──────────────────────────────────────────────────
function readDashboards() {
  try {
    const raw = fs.readFileSync(DASHBOARDS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { items: [] };
  }
}
function writeDashboards(data) {
  fs.writeFileSync(DASHBOARDS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ── Widget filters comunes ──────────────────────────────────────────────────
const WIDGET_FILTERS = {
  name_id: { type: "string", label: "filter.name", endpoint: "/filter/name", required: false },
  branch_office_id: { type: "string", label: "filter.branch_office", endpoint: "/filter/branch-office", required: false },
  identification_id: { type: "string", label: "filter.identification", endpoint: "/filter/identification", required: false },
};
app.use(express.json());

// ── JSON persistence ────────────────────────────────────────────────────────

function readNotifications() {
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}
function writeNotifications(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ── WebSocket ───────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Map(); // userId → Set<ws>

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const userId = url.searchParams.get("userId") || "anonymous";

  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);
  console.log(`[WS] conectado: userId=${userId}`);

  ws.on("close", () => {
    clients.get(userId)?.delete(ws);
    if (clients.get(userId)?.size === 0) clients.delete(userId);
    console.log(`[WS] desconectado: userId=${userId}`);
  });
});

function sendToUser(userId, event) {
  const payload = JSON.stringify(event);
  const sockets = clients.get(userId);
  if (!sockets) return;
  for (const ws of sockets) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

// ── GET /notifications ──────────────────────────────────────────────────────

app.get("/notifications", (_req, res) => {
  const data = readNotifications();
  const unreadCount = data.items.filter((n) => !n.read).length;

  res.json({
    ok: true,
    data: {
      items: data.items,
      summary: { total: data.items.length, unreadCount },
    },
  });
});

// ── POST /reports/exports ───────────────────────────────────────────────────
// 1. Crea notificación queued y la retorna al frontend
// 2. Simula progresión vía WebSocket (processing 20→80, completed 100)

app.post("/reports/exports", (req, res) => {
  const { format = "xlsx" } = req.body;
  const userId = req.query.userId || req.headers["x-user-id"] || "anonymous";

  const jobId = `job_${randomUUID().slice(0, 8)}`;
  const notifId = `notif_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const notification = {
    id: notifId,
    jobId,
    kind: "report.export",
    entityType: "report_export",
    entityId: jobId,
    code: "REPORT_EXPORT_QUEUED",
    status: "queued",
    priority: "medium",
    read: false,
    title: "Solicitud enviada",
    message: `La exportación ${format.toUpperCase()} fue enviada correctamente`,
    format,
    progress: 0,
    downloadUrl: null,
    action: { type: "none", label: null, url: null, target: null },
    createdAt: now,
    updatedAt: now,
    sequence: 1,
    metadata: {},
  };

  const data = readNotifications();
  data.items.unshift(notification);
  writeNotifications(data);

  res.json({ ok: true, data: { jobId, notification } });

  simulateProgress(userId, notification);
});

// ── Simulación de progresión ────────────────────────────────────────────────

function simulateProgress(userId, notification) {
  const steps = [20, 40, 60, 80, 100];
  let seq = notification.sequence;

  steps.forEach((progress, i) => {
    setTimeout(() => {
      seq++;
      const isLast = progress === 100;
      const updated = {
        ...notification,
        status: isLast ? "completed" : "processing",
        code: isLast ? "REPORT_EXPORT_COMPLETED" : "REPORT_EXPORT_PROCESSING",
        title: isLast ? "Reporte listo" : "Exportación en proceso",
        message: isLast
          ? `Tu reporte ${notification.format.toUpperCase()} ya está disponible para descargar`
          : `Tu reporte ${notification.format.toUpperCase()} va en ${progress / 10}%`,
        progress: isLast ? 100 : progress / 10,
        downloadUrl: isLast
          ? `http://localhost:${PORT}/downloads/${notification.jobId}.${notification.format}`
          : null,
        action: isLast
          ? { type: "download", label: "Descargar", url: `http://localhost:${PORT}/downloads/${notification.jobId}.${notification.format}`, target: "_blank" }
          : { type: "none", label: null, url: null, target: null },
        updatedAt: new Date().toISOString(),
        sequence: seq,
      };

      const data = readNotifications();
      const idx = data.items.findIndex((n) => n.id === notification.id);
      if (idx !== -1) data.items[idx] = updated;
      writeNotifications(data);

      sendToUser(userId, {
        event: "notification.upsert",
        data: { notification: updated },
      });
    }, (i + 1) * 2000);
  });
}

// ── PUT /notifications/:id (marcar leída) ───────────────────────────────────

app.put("/notifications/:id", (req, res) => {
  const data = readNotifications();
  const idx = data.items.findIndex((n) => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, message: "No encontrada" });

  data.items[idx] = { ...data.items[idx], ...req.body, updatedAt: new Date().toISOString() };
  data.items[idx].id = readNotifications().items[idx]?.id ?? data.items[idx].id;
  writeNotifications(data);

  res.json({ ok: true, data: { notification: data.items[idx] } });
});

// ── PUT /notifications-mark-all-read ────────────────────────────────────────

app.put("/notifications-mark-all-read", (_req, res) => {
  const data = readNotifications();
  data.items = data.items.map((n) => ({ ...n, read: true, updatedAt: new Date().toISOString() }));
  writeNotifications(data);
  res.json({ ok: true });
});

// ── DELETE /notifications (limpiar todo) ────────────────────────────────────

app.delete("/notifications", (_req, res) => {
  writeNotifications({ items: [] });
  res.json({ ok: true });
});

// ── Mock /report ────────────────────────────────────────────────────────────

const MOCK_EMPLOYEES = [
  { id: "UA1",  name: "Cajero Uno Aero" },
  { id: "DA2",  name: "Cajero Dos Aero" },
  { id: "TA3",  name: "Cajero Tres Aero" },
  { id: "BA1",  name: "Barista Uno Aero" },
  { id: "BD2",  name: "Barista Dos Aero" },
  { id: "BT3",  name: "Barista Tres Aero" },
  { id: "EU1",  name: "Entrega Uno Aero" },
  { id: "ED2",  name: "Entrega Dos Aero" },
  { id: "FTA3", name: "Frios Tres Aero" },
  { id: "FDA2", name: "Frios Dos Aero" },
  { id: "FUA1", name: "Frios Uno Aero" },
  { id: "VUA1", name: "Varios Uno Aero" },
  { id: "VDA2", name: "Varios Dos Aero" },
  { id: "VTA3", name: "Varios Tres Aero" },
  { id: "AUA1", name: "Apoyo Uno Aero" },
  { id: "ADA2", name: "Apoyo Dos Aero" },
  { id: "CUP1", name: "Cajero Juan Perez" },
  { id: "CDP2", name: "Mario Lopez Cajero" },
  { id: "BUP1", name: "Barista Lorena" },
  { id: "BDP2", name: "Valentina Barista Lopez" },
];

const MOCK_HOUR_COLS = [
  "HEDM","HO","DPA","NDPA","DED","HE23","HEFD","HE25","HEFN","HOSM","RNSM",
  "AHED","HENM","HEA","HDDC","RFC","EAOU","HT","HE24","HED2","HDNC","HEDF",
  "RN","HDD","HDN","HFD","HFN","HED","HEN","HEDD","HEDN","AHEN","HENF",
  "LATE","LUNC","EDNC","EDDC","HENS","RNF","HEDT","EHE","ET","RFF",
];

const MOCK_NOVEDADES = [null, null, null, "Permiso remunerado", "Incapacidad", "Vacaciones"];

function rndH(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}
function rndTime(baseHour) {
  const minutes = ["00", "15", "30", "45"][Math.floor(Math.random() * 4)];
  return `${String(baseHour).padStart(2, "0")}:${minutes}:00`;
}

function generateMockRow(emp, date) {
  const arrHour   = 6 + Math.floor(Math.random() * 4);      // entrada 06-09
  const workedH   = 7 + Math.floor(Math.random() * 3);      // jornada 7-9 h
  const hourCols  = {};

  for (const col of MOCK_HOUR_COLS) {
    // ~65 % de las columnas vacías (no todo tipo de hora aplica cada día)
    hourCols[col] = Math.random() < 0.65 ? "" : rndH(0.5, 4);
  }

  // Horas ordinarias y totales siempre presentes
  hourCols.HO   = rndH(6, 9);
  hourCols.HT   = rndH(0.5, 2);
  hourCols.LUNC = rndH(0.5, 1);

  return {
    person_id_ALIAS_3: emp.id,
    person_id_ALIAS_2: emp.name,
    date_arr:          date,
    time_arr:          rndTime(arrHour),
    time_left:         rndTime(arrHour + workedH),
    worked_hours:      String(workedH) + ".00",
    ...hourCols,
    GC_NOVEDADES: MOCK_NOVEDADES[Math.floor(Math.random() * MOCK_NOVEDADES.length)],
  };
}

app.post("/mock/report", (req, res) => {
  const { page = 1, pageSize = 20 } = req.body ?? {};

  // Genera 3 días de datos para todos los empleados
  const allRows = [];
  for (let d = 0; d < 3; d++) {
    const date = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
    for (const emp of MOCK_EMPLOYEES) {
      allRows.push(generateMockRow(emp, date));
    }
  }

  const total   = allRows.length;
  const start   = (page - 1) * pageSize;
  const content = allRows.slice(start, start + pageSize);

  res.json({
    data: {
      columnGroups: [
        {
          label: "report.group.general.info",
          columns: ["person_id_ALIAS_3","person_id_ALIAS_2","date_arr","time_arr","time_left","worked_hours"],
        },
        {
          label: "report.group.regular.hours",
          columns: ["person_id_ALIAS_2","HO","HT","LUNC","HOSM"],
        },
        {
          label: "report.group.extra.daytime.hours",
          columns: ["person_id_ALIAS_2","HED","HED2","HEDM","AHED","HEA","HEDT"],
        },
        {
          label: "report.group.extra.nighttime.hours",
          columns: ["person_id_ALIAS_2","HEN","HENM"],
        },
      ],
      columns: [
        { key: "person_id_ALIAS_3", label: "identification", type: "string" },
        { key: "person_id_ALIAS_2", label: "name",           type: "string" },
        { key: "date_arr",          label: "date",           type: "string" },
        { key: "time_arr",          label: "arrival",        type: "string" },
        { key: "time_left",         label: "departure",      type: "string" },
        { key: "worked_hours",      label: "total",          type: "string" },
        ...MOCK_HOUR_COLS.map((k) => ({ key: k, label: k, type: "string" })),
        { key: "GC_NOVEDADES",     label: "notice",         type: "string" },
      ],
      content,
      filters: {
        start_time:    { type: "time-range", required: true,  format: "Y-m-d H:i:s", label: "report.filter.datetime" },
        identification:{ type: "string",    required: false, label: "report.filter.identification", endpoint: "/v3/config/filter/identification" },
        branch_office: { type: "string",    required: false, label: "report.filter.branch_office",  endpoint: "/v3/config/filter/branch-office" },
        name:          { type: "string",    required: false, label: "report.filter.name",           endpoint: "/v3/config/filter/name" },
        view:          { endpoint: "/v3/report/config/view" },
      },
      pagination: { page, pageSize, total },
      meta: { generatedAt: new Date().toISOString(), exportAvailable: true },
    },
    code: 200,
    message: "Reporte generado exitosamente.",
  });
});

// ── Start ───────────────────────────────────────────────────────────────────

// ── Dashboard de Asistencias ────────────────────────────────────────────────

app.get("/attendance", requireAuth, (_req, res) => {
  res.json({
    data: {
      widgets: [
        { id: "w-kpi-present",  type: "kpi",   subtype: "kpi",  title: "attendance.kpi.present",           endpoint: "/widget/kpi-present" },
        { id: "w-kpi-absent",   type: "kpi",   subtype: "kpi",  title: "attendance.kpi.absent",            endpoint: "/widget/kpi-absent" },
        { id: "w-kpi-late",     type: "kpi",   subtype: "kpi",  title: "attendance.kpi.late",              endpoint: "/widget/kpi-late" },
        { id: "w-bar-daily",    type: "chart", subtype: "bar",  stylized: "bar-group", title: "attendance.chart.daily",        endpoint: "/widget/bar-daily" },
        { id: "w-area-weekly",  type: "chart", subtype: "area", stylized: "none",      title: "attendance.chart.weekly_trend", endpoint: "/widget/area-weekly" },
        { id: "w-pie-absence",  type: "chart", subtype: "pie",                         title: "attendance.chart.absence_distribution", endpoint: "/widget/pie-absence" },
        { id: "w-inactive-user", type: "chart", subtype: "table", title: "attendance.chart.inactive_users", endpoint: "/widget/inactive-users" },
      ],
    },
  });
});

app.post("/widget/kpi-present", requireAuth, (_req, res) => {
  res.json({ data: { mainValue: { value: 142 }, metrics: [{ type: "numeric", key: "inbound", value: 130, label: "attendance.kpi.entries" }, { type: "numeric", key: "outbound", value: 12, label: "attendance.kpi.exits" }, { key: "distribution", type: "distribution", label: "attendance.kpi.distribution", segments: [{ label: "Presentes", value: 130, color: "#22c55e" }, { label: "Ausentes", value: 12, color: "#ef4444" }] }], trend: { direction: "up", value: "3", unit: "%", color: "#22c55e", label: "attendance.trend.vs_yesterday", create_at: "" } } });
});

app.post("/widget/kpi-absent", requireAuth, (_req, res) => {
  res.json({ data: { mainValue: { value: 18 }, metrics: [{ type: "numeric", key: "justified", value: 10, label: "attendance.kpi.justified" }, { type: "numeric", key: "unjustified", value: 8, label: "attendance.kpi.unjustified" }, { key: "distribution", type: "distribution", label: "attendance.kpi.absence_type", segments: [{ label: "Justificadas", value: 10, color: "#f59e0b" }, { label: "No justificadas", value: 8, color: "#ef4444" }] }], trend: { direction: "down", value: "2", unit: "%", color: "#22c55e", label: "attendance.trend.vs_yesterday", create_at: "" } } });
});

app.post("/widget/kpi-late", requireAuth, (_req, res) => {
  res.json({ data: { mainValue: { value: 7 }, metrics: [{ type: "numeric", key: "avg_minutes", value: "12:30", label: "attendance.kpi.avg_delay" }, { key: "distribution", type: "distribution", label: "attendance.kpi.delay_range", segments: [{ label: "< 15 min", value: 4, color: "#f59e0b" }, { label: "15-30 min", value: 2, color: "#f97316" }, { label: "> 30 min", value: 1, color: "#ef4444" }] }], trend: { direction: "up", value: "1", unit: "", color: "#ef4444", label: "attendance.trend.vs_yesterday", create_at: "" } } });
});

app.post("/widget/bar-daily", requireAuth, (_req, res) => {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  res.json({ data: { series: [{ name: "Entradas", data: days.map((d) => ({ type: d, value: 110 + Math.floor(Math.random() * 40) })) }, { name: "Ausentes", data: days.map((d) => ({ type: d, value: 5 + Math.floor(Math.random() * 20) })) }] } });
});

app.post("/widget/bar-weekly", requireAuth, (_req, res) => {
  const weeks = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
  res.json({ data: { series: [{ name: "Entradas", data: weeks.map((w) => ({ type: w, value: 700 + Math.floor(Math.random() * 100) })) }] } });
});

app.post("/widget/area-weekly", requireAuth, (_req, res) => {
  const weeks = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
  const base = new Date();
  res.json({ data: { series: [{ name: "Presentes", data: weeks.map((w, i) => { const d = new Date(base); d.setDate(d.getDate() - (3 - i) * 7); return { type: w, value: 120 + Math.floor(Math.random() * 30), date: d.toISOString().slice(0, 10) }; }) }, { name: "Ausentes", data: weeks.map((w, i) => { const d = new Date(base); d.setDate(d.getDate() - (3 - i) * 7); return { type: w, value: 10 + Math.floor(Math.random() * 15), date: d.toISOString().slice(0, 10) }; }) }] } });
});

app.post("/widget/pie-absence", requireAuth, (_req, res) => {
  res.json({ data: { series: [{ name: "Distribución", data: [{ type: "Presentes", value: 142 }, { type: "Ausentes", value: 18 }, { type: "Tardanzas", value: 7 }, { type: "Vacaciones", value: 5 }, { type: "Incapacidades", value: 3 }] }] } });
});

app.post("/widget/inactive-users", requireAuth, (_req, res) => {
  res.json({ data: { columns: [{ key: "id", label: "identification", type: "string" }, { key: "name", label: "name", type: "string" }, { key: "last_active", label: "last_active", type: "string" }], content: [{ id: "UA1", name: "Cajero Uno Aero", last_active: "2024-06-01 08:15" }, { id: "DA2", name: "Cajero Dos Aero", last_active: "2024-06-02 09:30" }, { id: "TA3", name: "Cajero Tres Aero", last_active: "2024-06-03 07:45" }] } });
});
// ── Dashboards CRUD ─────────────────────────────────────────────────────────

app.get("/dashboards-list", requireAuth, (_req, res) => {
  const { items } = readDashboards();
  const views = items.map((dash) => ({
    ...dash,
    layout_config: (dash.layout_config || []).map((widget) => ({
      ...widget,
      filters: widget.filters ?? WIDGET_FILTERS,
    })),
  }));
  res.json({ data: { endpoint: "/widgets-list", views } });
});

app.post("/dashboards-list", requireAuth, (req, res) => {
  const { name, layout_config = [] } = req.body ?? {};
  if (!name) return res.status(400).json({ message: "El campo 'name' es requerido" });
  const store = readDashboards();
  const newDash = { id: randomUUID(), name, layout_config, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  store.items.push(newDash);
  writeDashboards(store);
  return res.status(201).json({ data: newDash });
});

app.put("/dashboards-list/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, layout_config } = req.body ?? {};
  const store = readDashboards();
  const idx = store.items.findIndex((d) => d.id === id);
  if (idx === -1) return res.status(404).json({ message: "Dashboard no encontrado" });
  if (name !== undefined) store.items[idx].name = name;
  if (layout_config !== undefined) store.items[idx].layout_config = layout_config;
  store.items[idx].updated_at = new Date().toISOString();
  writeDashboards(store);
  return res.json({ data: store.items[idx] });
});

app.delete("/dashboards-list/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const store = readDashboards();
  const before = store.items.length;
  store.items = store.items.filter((d) => d.id !== id);
  if (store.items.length === before) return res.status(404).json({ message: "Dashboard no encontrado" });
  writeDashboards(store);
  return res.json({ data: {} });
});

app.get("/widgets-list", requireAuth, (_req, res) => {
  res.json({
    data: {
      widgets: [
        { id: "kpi-present",  type: "kpi",   subtype: "kpi",  title: "Presentes Hoy",            endpoint: "/widget/kpi-present",  path_widget: "/widget/kpi-present",  description: "Total de empleados presentes hoy",      filters: WIDGET_FILTERS },
        { id: "kpi-absent",   type: "kpi",   subtype: "kpi",  title: "Ausentes Hoy",              endpoint: "/widget/kpi-absent",   path_widget: "/widget/kpi-absent",   description: "Total de empleados ausentes hoy",       filters: WIDGET_FILTERS },
        { id: "kpi-late",     type: "kpi",   subtype: "kpi",  title: "Tardanzas",                 endpoint: "/widget/kpi-late",     path_widget: "/widget/kpi-late",     description: "Empleados con tardanza hoy",            filters: WIDGET_FILTERS },
        { id: "bar-daily",    type: "chart", subtype: "bar",  title: "Asistencia Diaria",         endpoint: "/widget/bar-daily",    path_widget: "/widget/bar-daily",    stylized: "bar-group", description: "Asistencia por día (últimos 7 días)",   filters: WIDGET_FILTERS },
        { id: "bar-weekly",   type: "chart", subtype: "bar",  title: "Asistencia Semanal",        endpoint: "/widget/bar-weekly",   path_widget: "/widget/bar-weekly",   stylized: "bar-basic", description: "Asistencia por semana (últimas 4 sem)", filters: WIDGET_FILTERS },
        { id: "area-weekly",  type: "chart", subtype: "area", title: "Tendencia Semanal",         endpoint: "/widget/area-weekly",  path_widget: "/widget/area-weekly",  stylized: "none",      description: "Tendencia de asistencia semanal",       filters: WIDGET_FILTERS },
        { id: "pie-absence",  type: "chart", subtype: "pie",  title: "Distribución de Ausencias", endpoint: "/widget/pie-absence",  path_widget: "/widget/pie-absence",  description: "Distribución por tipo de ausencia",     filters: WIDGET_FILTERS },
        { id: "inactive-users", type: "chart", subtype: "table", title: "Usuarios Inactivos",     endpoint: "/widget/inactive-users", path_widget: "/widget/inactive-users", description: "Lista de usuarios inactivos", filters: WIDGET_FILTERS },
      ],
      global_filters: {},
    },
  });
});

// ── Filtros de autocomplete ─────────────────────────────────────────────────

const MOCK_EMPLOYEES_FILTER = [
  { id: "UA1", name: "Cajero Uno Aero" }, { id: "DA2", name: "Cajero Dos Aero" },
  { id: "TA3", name: "Cajero Tres Aero" }, { id: "BA1", name: "Barista Uno Aero" },
  { id: "BD2", name: "Barista Dos Aero" }, { id: "CUP1", name: "Cajero Juan Perez" },
  { id: "BUP1", name: "Barista Lorena" }, { id: "BDP2", name: "Valentina Barista Lopez" },
];

app.post("/filter/identification", requireAuth, (req, res) => {
  const { identification = "" } = req.body ?? {};
  const q = String(identification).toLowerCase();
  const matches = MOCK_EMPLOYEES_FILTER.filter((e) => e.id.toLowerCase().includes(q)).slice(0, 8).map((e) => ({ id: e.id, code: e.id, label: e.name }));
  res.json({ data: matches });
});

app.post("/filter/branch-office", requireAuth, (req, res) => {
  const { branch_office = "" } = req.body ?? {};
  const q = String(branch_office).toLowerCase();
  const BRANCHES = [{ code: "01", label: "Oficina Central" }, { code: "02", label: "Sede Norte" }, { code: "03", label: "Sede Sur" }, { code: "04", label: "Aeropuerto" }, { code: "05", label: "Centro Comercial" }];
  const matches = BRANCHES.filter((b) => b.label.toLowerCase().includes(q) || b.code.includes(q)).map((b) => ({ id: b.code, code: b.code, label: b.label }));
  res.json({ data: matches });
});

app.post("/filter/name", requireAuth, (req, res) => {
  const { name = "" } = req.body ?? {};
  const q = String(name).toLowerCase();
  const matches = MOCK_EMPLOYEES_FILTER.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8).map((e) => ({ id: e.id, code: e.id, label: e.name }));
  res.json({ data: matches });
});

app.get("/report/config/view", requireAuth, (_req, res) => {
  res.json({ data: [{ code: "daily", label: "Diario" }, { code: "weekly", label: "Semanal" }, { code: "monthly", label: "Mensual" }] });
});

// ── Start ───────────────────────────────────────────────────────────────────

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Backend corriendo en http://localhost:${PORT}`);
    console.log(`WebSocket en ws://localhost:${PORT}/ws`);
  });
}

module.exports = app;

