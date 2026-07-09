const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { data } = require("react-router-dom");

const app = express();
const PORT = 3002;

// Solo para desarrollo local — no usar en producción
const JWT_SECRET = "cari-local-dev-secret-2024";
const JWT_EXPIRES_IN = "8h";

app.use(cors());
app.use(express.json());

// ── Usuarios mock ────────────────────────────────────────────────────────────
// En producción esto vendría de una base de datos real
const USERS = [
  {
    id: "1",
    username: "admin@cari.com",
    password: "admin123",
    name: "Admin Local",
    role: "admin",
  },
  {
    id: "2",
    username: "user@cari.com",
    password: "user123",
    name: "Usuario Local",
    role: "user",
  },
];

// ── Menú dinámico por rol ────────────────────────────────────────────────────
// Los 'path' de los items NO incluyen '/local-api' porque buildApiUrl ya lo agrega.
// Estos codes deben coincidir con las keys de routeMap en src/routes/routes.tsx.
const MENU_BY_ROLE = {
  admin: [
    {
      code: "dashboards",
      items: [
        { code: "dashboards.attendances", path: "/attendance" },
        { code: "dashboards.list", path: "/dashboards-list" },
      ],
    },
    {
      code: "reports",
      items: [
        { code: "reports.payroll", path: "/prenomina-data" },
      ],
    },
  ],
  user: [
    {
      code: "dashboards",
      items: [
        { code: "dashboards.attendances", path: "/attendance" },
      ],
    },
  ],
};

const PERMISSIONS_BY_ROLE = {
  admin: ["read", "write", "delete", "export"],
  user: ["read"],
};

// ── Middleware: verificar JWT ─────────────────────────────────────────────────
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

// ── POST /login ───────────────────────────────────────────────────────────────
// El frontend llama a buildApiUrl("local", "", "/login") → /local-api/login
// vite.config.ts reescribe /local-api/login → /login en este servidor
app.post("/login", (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ message: "Credenciales requeridas" });
  }

  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
  }

  // Los claims 'path' y 'userContext' son leídos por el frontend en Login.tsx:
  //   decodedToken.path      → base de la URL para el buildApiUrl
  //   decodedToken.userContext → sufijo para llamar al endpoint de contexto
  //
  // Como buildApiUrl("local", "", path) ya antepone "/local-api",
  // aquí 'path' va vacío y 'userContext' es solo "/user-context"
  const token = jwt.sign(
    {
      sub: user.id,
      path: "",
      userContext: "/user-context",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.json({ token });
});

// ── GET /user-context ─────────────────────────────────────────────────────────
// El frontend llama a esto justo después del login para obtener
// usuario, menú y permisos (useUserContext.ts → initializeUserContext)
app.get("/user-context", requireAuth, (req, res) => {
  const user = USERS.find((u) => u.id === req.user.sub);
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  const menu = MENU_BY_ROLE[user.role] ?? [];
  const permissions = PERMISSIONS_BY_ROLE[user.role] ?? [];

  return res.json({
    user: { id: user.id, name: user.name, role: user.role },
    menu,
    permissions,
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FASE 2 — Dashboard de Asistencias, Dashboards CRUD, Prenómina
// ════════════════════════════════════════════════════════════════════════════

// ── Filtros comunes para widgets del sistema new-dash ────────────────────────
// Cada widget en /dashboards-list y /widgets-list debe incluir este objeto.
// Los endpoints son relativos: buildApiUrl("local","",endpoint) → /local-api/filter/...
// FilterAutocomplete toma filterKey (ej: "name_id") → payloadKey = "name" para el body POST.
const WIDGET_FILTERS = {
  name_id: {
    type: "string",
    label: "filter.name",
    endpoint: "/filter/name",
    required: false,
  },
  branch_office_id: {
    type: "string",
    label: "filter.branch_office",
    endpoint: "/filter/branch-office",
    required: false,
  },
  identification_id: {
    type: "string",
    label: "filter.identification",
    endpoint: "/filter/identification",
    required: false,
  },
};

// ── Persistencia: Dashboards guardados del usuario ──────────────────────────
const DASHBOARDS_FILE = path.join(__dirname, "data", "dashboards.json");

function readDashboards() {
  const raw = fs.readFileSync(DASHBOARDS_FILE, "utf-8");
  return JSON.parse(raw);
}
function writeDashboards(data) {
  fs.writeFileSync(DASHBOARDS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ── Mock de empleados para prenómina ─────────────────────────────────────────
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
  const arrHour = 6 + Math.floor(Math.random() * 4);
  const workedH = 7 + Math.floor(Math.random() * 3);
  const hourCols = {};
  for (const col of MOCK_HOUR_COLS) {
    hourCols[col] = Math.random() < 0.65 ? "" : rndH(0.5, 4);
  }
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

// ═══════════════════════════════════════════
// 2.1 — Dashboard de Asistencias
// ═══════════════════════════════════════════

// GET /attendance
// Devuelve la lista de widgets del dashboard.
// El frontend (DashboardContext.tsx) llama a buildApiUrl("local","","/attendance")
// → /local-api/attendance → vite proxy → este servidor.
//
// IMPORTANTE: Los widgets KPI, Bar y Area usan buildApiUrl(productLogin, target, endpoint)
// → su endpoint es RELATIVO (sin /local-api).
// El widget Pie usa el endpoint DIRECTO sin buildApiUrl → debe incluir /local-api completo.
app.get("/attendance", requireAuth, (_req, res) => {
  res.json({
    data: {
      widgets: [
        {
          id: "w-kpi-present",
          type: "kpi",
          subtype: "kpi",
          title: "attendance.kpi.present",
          endpoint: "/widget/kpi-present",
        },
        {
          id: "w-kpi-absent",
          type: "kpi",
          subtype: "kpi",
          title: "attendance.kpi.absent",
          endpoint: "/widget/kpi-absent",
        },
        {
          id: "w-kpi-late",
          type: "kpi",
          subtype: "kpi",
          title: "attendance.kpi.late",
          endpoint: "/widget/kpi-late",
        },
        {
          id: "w-bar-daily",
          type: "chart",
          subtype: "bar",
          stylized: "bar-group",
          title: "attendance.chart.daily",
          endpoint: "/widget/bar-daily",
        },
        {
          id: "w-area-weekly",
          type: "chart",
          subtype: "area",
          stylized: "none",
          title: "attendance.chart.weekly_trend",
          endpoint: "/widget/area-weekly",
        },
        {
          id: "w-pie-absence",
          type: "chart",
          subtype: "pie",
          title: "attendance.chart.absence_distribution",
          // ChartPie.tsx usa el endpoint directamente sin buildApiUrl,
          // por lo que debe contener el prefijo /local-api completo.
          endpoint: "/widget/pie-absence",
        },
        {
          id: "w-inactive-user",
          type: "chart",
          subtype: "table",
          title: "attendance.chart.inactive_users",
          endpoint: "/widget/inactive-users",
        }
      ],
    },
  });
});

// GET /widget/kpi-present — Presentes hoy
// KpiContent espera: data.mainValue, data.metrics[], data.trend
app.post("/widget/kpi-present", requireAuth, (_req, res) => {
  res.json({
    data: {
      mainValue: { value: 142 },
      metrics: [
        { type: "numeric", key: "inbound",  value: 130, label: "attendance.kpi.entries" },
        { type: "numeric", key: "outbound", value: 12,  label: "attendance.kpi.exits" },
        {
          key: "distribution",
          type: "distribution",
          label: "attendance.kpi.distribution",
          segments: [
            { label: "Presentes", value: 130, color: "#22c55e" },
            { label: "Ausentes",  value: 12,  color: "#ef4444" },
          ],
        },
      ],
      trend: { direction: "up", value: "3", unit: "%", color: "#22c55e", label: "attendance.trend.vs_yesterday", create_at: "" },
    },
  });
});

// GET /widget/kpi-absent — Ausentes hoy
app.post("/widget/kpi-absent", requireAuth, (_req, res) => {
  res.json({
    data: {
      mainValue: { value: 18 },
      metrics: [
        { type: "numeric", key: "justified",   value: 10, label: "attendance.kpi.justified" },
        { type: "numeric", key: "unjustified", value: 8,  label: "attendance.kpi.unjustified" },
        {
          key: "distribution",
          type: "distribution",
          label: "attendance.kpi.absence_type",
          segments: [
            { label: "Justificadas",   value: 10, color: "#f59e0b" },
            { label: "No justificadas", value: 8, color: "#ef4444" },
          ],
        },
      ],
      trend: { direction: "down", value: "2", unit: "%", color: "#22c55e", label: "attendance.trend.vs_yesterday", create_at: "" },
    },
  });
});

// GET /widget/kpi-late — Tardanzas hoy
app.post("/widget/kpi-late", requireAuth, (_req, res) => {
  res.json({
    data: {
      mainValue: { value: 7 },
      metrics: [
        { type: "numeric", key: "avg_minutes", value: "12:30", label: "attendance.kpi.avg_delay" },
        {
          key: "distribution",
          type: "distribution",
          label: "attendance.kpi.delay_range",
          segments: [
            { label: "< 15 min",  value: 4, color: "#f59e0b" },
            { label: "15-30 min", value: 2, color: "#f97316" },
            { label: "> 30 min",  value: 1, color: "#ef4444" },
          ],
        },
      ],
      trend: { direction: "up", value: "1", unit: "", color: "#ef4444", label: "attendance.trend.vs_yesterday", create_at: "" },
    },
  });
});

// GET /widget/bar-daily — Asistencia diaria (últimos 7 días)
// ChartBar espera: data.series[].name + data.series[].data[].{ type, value }
app.post("/widget/bar-daily", requireAuth, (_req, res) => {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  res.json({
    data: {
      series: [
        {
          name: "Entradas",
          data: days.map((d) => ({ type: d, value: 110 + Math.floor(Math.random() * 40) })),
        },
        {
          name: "Ausentes",
          data: days.map((d) => ({ type: d, value: 5 + Math.floor(Math.random() * 20) })),
        },
      ],
    },
  });
});

app.post("/widget/bar-weekly", requireAuth, (_req, res) => {
  const weeks = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
  res.json({
    data: {
      series: [
        {
          name: "Entradas",
          data: weeks.map((w) => ({ type: w, value: 700 + Math.floor(Math.random() * 100) })),
        },
      ],
    },
  });
});

// GET /widget/area-weekly — Tendencia semanal (últimas 4 semanas)
// ChartArea espera el mismo formato que ChartBar + campo date opcional
app.post("/widget/area-weekly", requireAuth, (_req, res) => {
  const weeks = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
  const base = new Date();
  res.json({
    data: {
      series: [
        {
          name: "Presentes",
          data: weeks.map((w, i) => {
            const d = new Date(base);
            d.setDate(d.getDate() - (3 - i) * 7);
            return { type: w, value: 120 + Math.floor(Math.random() * 30), date: d.toISOString().slice(0, 10) };
          }),
        },
        {
          name: "Ausentes",
          data: weeks.map((w, i) => {
            const d = new Date(base);
            d.setDate(d.getDate() - (3 - i) * 7);
            return { type: w, value: 10 + Math.floor(Math.random() * 15), date: d.toISOString().slice(0, 10) };
          }),
        },
      ],
    },
  });
});

// GET /widget/pie-absence — Distribución de ausencias
// ChartPie llama este endpoint DIRECTO (sin buildApiUrl), el proxy de Vite
// reescribe /local-api/widget/pie-absence → /widget/pie-absence en este servidor.
app.post("/widget/pie-absence", requireAuth, (_req, res) => {
  res.json({
    data: {
      series: [
        {
          name: "Distribución",
          data: [
            { type: "Presentes",      value: 142 },
            { type: "Ausentes",       value: 18 },
            { type: "Tardanzas",      value: 7 },
            { type: "Vacaciones",     value: 5 },
            { type: "Incapacidades",  value: 3 },
          ],
        },
      ],
    },
  });
});

app.post("/widget/inactive-users", requireAuth, (_req, res) => {
    res.json({data:{summary: {label: "Usuarios Inactivos", value: 3}, series: [{name: "Top Enterprices", type: "table", columns: [{key: "enterprice", label: "enterprice"}, {key: "devices", label: "devices"}], data: [{enterprice: "Dipsa Food", devices: "CELL PHONES FO00067 - LIVANOVA-OUTSOURCING DE RECEPCI\u00d3N , CELL PHONES IMAGENOLOGIA, CELL PHONES IMAGENOLOGIA", tooltip: "2018-10-18 09:43:01"}, {enterprice: "Adecco Outsourcing Colombia", devices: "CELL PHONES FO00068 - LIVANOVA-OUTSOURCING DE RECEPCI\u00d3N", tooltip: "2018-10-19 10:00:00"}, {enterprice: "Empresa 3", devices: "CELL PHONES FO00069 - LIVANOVA-OUTSOURCING DE RECEPCI\u00d3N", tooltip: "2018-10-20 11:00:00"}]}] }});
});


// ═══════════════════════════════════════════
// 2.2 — Dashboards CRUD
// ═══════════════════════════════════════════

// GET /dashboards-list
// DashBoardsContext (y la librería) espera:
//   data.endpoint → path para cargar widgets disponibles (buildApiUrl lo prefija)
//   data.views    → dashboards guardados del usuario
//
// Inyectamos WIDGET_FILTERS en cada widget de layout_config para garantizar
// compatibilidad con FilterAdvance (que espera widget.filters definido).
app.get("/dashboards-list", requireAuth, (_req, res) => {
  const { items } = readDashboards();
  const views = items.map((dash) => ({
    ...dash,
    layout_config: (dash.layout_config || []).map((widget) => ({
      ...widget,
      filters: widget.filters ?? WIDGET_FILTERS,
    })),
  }));
  res.json({
    data: {
      endpoint: "/widgets-list",
      views,
    },
  });
});

// POST /dashboards-list — Crear dashboard
app.post("/dashboards-list", requireAuth, (req, res) => {
  const { name, layout_config = [] } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ message: "El campo 'name' es requerido" });
  }
  const store = readDashboards();
  const newDash = {
    id: randomUUID(),
    name,
    layout_config,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.items.push(newDash);
  writeDashboards(store);
  return res.status(201).json({ data: newDash });
});

// PUT /dashboards-list/:id — Actualizar dashboard
app.put("/dashboards-list/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, layout_config } = req.body ?? {};
  const store = readDashboards();
  const idx = store.items.findIndex((d) => d.id === id);
  if (idx === -1) {
    return res.status(404).json({ message: "Dashboard no encontrado" });
  }
  if (name !== undefined) store.items[idx].name = name;
  if (layout_config !== undefined) store.items[idx].layout_config = layout_config;
  store.items[idx].updated_at = new Date().toISOString();
  writeDashboards(store);
  return res.json({ data: store.items[idx] });
});

// DELETE /dashboards-list/:id — Eliminar dashboard
app.delete("/dashboards-list/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const store = readDashboards();
  const before = store.items.length;
  store.items = store.items.filter((d) => d.id !== id);
  if (store.items.length === before) {
    return res.status(404).json({ message: "Dashboard no encontrado" });
  }
  writeDashboards(store);
  return res.json({ data: {} });
});

// GET /widgets-list
// Lista de widgets disponibles para armar dashboards custom.
// Incluye 'filters' (para FilterAdvance) y 'path_widget' (requerido por Widget interface).
app.get("/widgets-list", requireAuth, (_req, res) => {
  res.json({
    data: {
      widgets: [
        { id: "kpi-present",  type: "kpi",   subtype: "kpi",  title: "Presentes Hoy",            endpoint: "/widget/kpi-present",  path_widget: "/widget/kpi-present",  description: "Total de empleados presentes hoy",        filters: WIDGET_FILTERS },
        { id: "kpi-absent",   type: "kpi",   subtype: "kpi",  title: "Ausentes Hoy",              endpoint: "/widget/kpi-absent",   path_widget: "/widget/kpi-absent",   description: "Total de empleados ausentes hoy",         filters: WIDGET_FILTERS },
        { id: "kpi-late",     type: "kpi",   subtype: "kpi",  title: "Tardanzas",                 endpoint: "/widget/kpi-late",     path_widget: "/widget/kpi-late",     description: "Empleados con tardanza hoy",              filters: WIDGET_FILTERS },
        { id: "bar-daily",    type: "chart", subtype: "bar",  title: "Asistencia Diaria",         endpoint: "/widget/bar-daily",    path_widget: "/widget/bar-daily",    stylized: "bar-group", description: "Asistencia por día (últimos 7 días)",     filters: WIDGET_FILTERS },
        { id: "bar-weekly",   type: "chart", subtype: "bar",  title: "Asistencia Semanal",        endpoint: "/widget/bar-weekly",   path_widget: "/widget/bar-weekly",   stylized: "bar-basic", description: "Asistencia por semana (últimas 4 sem)",   filters: WIDGET_FILTERS },
        { id: "area-weekly",  type: "chart", subtype: "area", title: "Tendencia Semanal",         endpoint: "/widget/area-weekly",  path_widget: "/widget/area-weekly",  stylized: "none",      description: "Tendencia de asistencia semanal",         filters: WIDGET_FILTERS },
        { id: "pie-absence",  type: "chart", subtype: "pie",  title: "Distribución de Ausencias", endpoint: "/widget/pie-absence",  path_widget: "/widget/pie-absence",  description: "Distribución por tipo de ausencia",       filters: WIDGET_FILTERS },
        { id: "inactive-users", type: "chart", subtype: "table", title: "Usuarios Inactivos", endpoint: "/widget/inactive-users", path_widget: "/widget/inactive-users", description: "Lista de usuarios inactivos recientemente", filters: WIDGET_FILTERS },
      ],
      global_filters: {},
    },
  });
});

// ═══════════════════════════════════════════
// 2.3 — Reporte de Prenómina
// ═══════════════════════════════════════════

// POST /prenomina-data
// Portado del mock en backend/server.js (/mock/report).
// El frontend llama a buildApiUrl("local","","/prenomina-data") → /local-api/prenomina-data.
app.post("/prenomina-data", requireAuth, (req, res) => {
  const { page = 1, pageSize = 20 } = req.body ?? {};

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
        { label: "report.group.general.info",        columns: ["person_id_ALIAS_3","person_id_ALIAS_2","date_arr","time_arr","time_left","worked_hours"] },
        { label: "report.group.regular.hours",       columns: ["person_id_ALIAS_2","HO","HT","LUNC","HOSM"] },
        { label: "report.group.extra.daytime.hours", columns: ["person_id_ALIAS_2","HED","HED2","HEDM","AHED","HEA","HEDT"] },
        { label: "report.group.extra.nighttime.hours", columns: ["person_id_ALIAS_2","HEN","HENM"] },
      ],
      columns: [
        { key: "person_id_ALIAS_3", label: "identification", type: "string" },
        { key: "person_id_ALIAS_2", label: "name",           type: "string" },
        { key: "date_arr",          label: "date",           type: "string" },
        { key: "time_arr",          label: "arrival",        type: "string" },
        { key: "time_left",         label: "departure",      type: "string" },
        { key: "worked_hours",      label: "total",          type: "string" },
        ...MOCK_HOUR_COLS.map((k) => ({ key: k, label: k, type: "string" })),
        { key: "GC_NOVEDADES", label: "notice", type: "string" },
      ],
      content,
      filters: {
        start_time:    { type: "time-range", required: true,  format: "Y-m-d H:i:s", label: "report.filter.datetime" },
        identification:{ type: "string",    required: false, label: "report.filter.identification", endpoint: "/local-api/filter/identification" },
        branch_office: { type: "string",    required: false, label: "report.filter.branch_office",  endpoint: "/local-api/filter/branch-office" },
        name:          { type: "string",    required: false, label: "report.filter.name",           endpoint: "/local-api/filter/name" },
        view:          { endpoint: "/local-api/report/config/view" },
      },
      pagination: { page, pageSize, total },
      meta: { generatedAt: new Date().toISOString(), exportAvailable: true },
    },
    code: 200,
    message: "Reporte generado exitosamente.",
  });
});

// ═══════════════════════════════════════════
// 2.4 — Endpoints de filtros (autocomplete)
// ═══════════════════════════════════════════
// Usados por los filtros del reporte de prenómina.
// Reciben { identification | branch_office | name } en el body y devuelven sugerencias.

app.post("/filter/identification", requireAuth, (req, res) => {
  const { identification = "" } = req.body ?? {};
  const q = String(identification).toLowerCase();
  const matches = MOCK_EMPLOYEES
    .filter((e) => e.id.toLowerCase().includes(q))
    .slice(0, 8)
    .map((e) => ({ id: e.id, code: e.id, label: e.name }));
  res.json({ data: matches });
});

app.post("/filter/branch-office", requireAuth, (req, res) => {
  const { branch_office = "" } = req.body ?? {};
  const q = String(branch_office).toLowerCase();
  const BRANCHES = [
    { code: "01", label: "Oficina Central" },
    { code: "02", label: "Sede Norte" },
    { code: "03", label: "Sede Sur" },
    { code: "04", label: "Aeropuerto" },
    { code: "05", label: "Centro Comercial" },
  ];
  const matches = BRANCHES
    .filter((b) => b.label.toLowerCase().includes(q) || b.code.includes(q))
    .map((b) => ({ id: b.code, code: b.code, label: b.label }));
  res.json({ data: matches });
});

app.post("/filter/name", requireAuth, (req, res) => {
  const { name = "" } = req.body ?? {};
  const q = String(name).toLowerCase();
  const matches = MOCK_EMPLOYEES
    .filter((e) => e.name.toLowerCase().includes(q))
    .slice(0, 8)
    .map((e) => ({ id: e.id, code: e.id, label: e.name }));
  res.json({ data: matches });
});

app.get("/report/config/view", requireAuth, (_req, res) => {
  res.json({
    data: [
      { code: "daily",   label: "Diario" },
      { code: "weekly",  label: "Semanal" },
      { code: "monthly", label: "Mensual" },
    ],
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Local Backend] corriendo en http://localhost:${PORT}`);
  console.log(`  POST /login`);
  console.log(`  GET  /user-context            (auth)`);
  console.log(`  --- Fase 2 ---`);
  console.log(`  GET  /attendance              (auth) → lista de widgets`);
  console.log(`  POST  /widget/kpi-present|kpi-absent|kpi-late (auth)`);
  console.log(`  POST  /widget/bar-daily|area-weekly|pie-absence (auth)`);
  console.log(`  GET  /dashboards-list         (auth)`);
  console.log(`  POST /dashboards-list         (auth) → crear`);
  console.log(`  PUT  /dashboards-list/:id     (auth) → editar`);
  console.log(`  DEL  /dashboards-list/:id     (auth) → borrar`);
  console.log(`  GET  /widgets-list            (auth) → widgets disponibles`);
  console.log(`  POST /prenomina-data          (auth) → reporte prenómina`);
  console.log(`  POST /filter/identification|branch-office|name (auth)`);
  console.log(`  GET  /report/config/view      (auth)`);
});
