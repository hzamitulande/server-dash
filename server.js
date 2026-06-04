const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const server = http.createServer(app);

const PORT = 3001;
const DATA_FILE = path.join(__dirname, "data", "notifications.json");

app.use(cors());
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

server.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
  console.log(`WebSocket en ws://localhost:${PORT}/ws`);
});

