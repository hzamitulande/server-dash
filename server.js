const express = require("express");
const http = require("http");
const cors = require("cors");

const { requireAuth } = require("./middleware/auth");
const { attachWebSocket } = require("./services/ws.service");
const { createAuthRouter } = require("./routes/auth.routes");
const { createDashboardRouter } = require("./routes/dashboard.routes");
const { createReportRouter } = require("./routes/report.routes");
const { createNotificationRouter } = require("./routes/notification.routes");

const PORT = 3001;
const allowedOrigins = [
  "https://falcon-qa.cariai.com",
  "https://development.cariai.com",
  "https://qa.cariai.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin) || localhostOriginPattern.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-requested-with"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

const { sendToUser } = attachWebSocket(server, PORT);

const authRouter = createAuthRouter(requireAuth);
const dashboardsRouter = createDashboardRouter(requireAuth);
const reportRouter = createReportRouter(requireAuth);
const notificationRouter = createNotificationRouter({ sendToUser, port: PORT });

// Gateway interno por servicio
app.use("/services/dashboards", dashboardsRouter);
app.use("/services/report", reportRouter);
app.use("/services/notifications", notificationRouter);

// Compatibilidad con rutas actuales del frontend
app.use("/", authRouter);
app.use("/", dashboardsRouter);
app.use("/", reportRouter);
app.use("/", notificationRouter);

function start(port = PORT) {
  return server.listen(port, () => {
    console.log(`Backend unificado corriendo en http://localhost:${port}`);
    console.log(`WebSocket en ws://localhost:${port}/ws`);
    console.log("Servicios: /services/dashboards, /services/report, /services/notifications");
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  app,
  server,
  start,
};
