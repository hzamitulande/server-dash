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

const app = express();
const server = http.createServer(app);

app.use(cors());
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
