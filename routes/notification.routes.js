const express = require("express");
const { randomUUID } = require("crypto");
const { readNotifications, writeNotifications } = require("../services/store.service");

function createNotificationRouter({ sendToUser, port }) {
  const router = express.Router();

  router.get("/notifications", (_req, res) => {
    const data = readNotifications();
    const unreadCount = data.items.filter((item) => !item.read).length;

    return res.json({
      ok: true,
      data: {
        items: data.items,
        summary: { total: data.items.length, unreadCount },
      },
    });
  });

  router.post("/reports/exports", (req, res) => {
    const { format = "xlsx" } = req.body ?? {};
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
      message: `La exportacion ${format.toUpperCase()} fue enviada correctamente`,
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

    simulateProgress({ userId, notification, sendToUser, port });
  });

  router.put("/notifications/:id", (req, res) => {
    const data = readNotifications();
    const index = data.items.findIndex((item) => item.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ ok: false, message: "No encontrada" });
    }

    data.items[index] = {
      ...data.items[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    writeNotifications(data);
    return res.json({ ok: true, data: { notification: data.items[index] } });
  });

  router.put("/notifications-mark-all-read", (_req, res) => {
    const data = readNotifications();
    data.items = data.items.map((item) => ({
      ...item,
      read: true,
      updatedAt: new Date().toISOString(),
    }));

    writeNotifications(data);
    return res.json({ ok: true });
  });

  router.delete("/notifications", (_req, res) => {
    writeNotifications({ items: [] });
    return res.json({ ok: true });
  });

  return router;
}

function simulateProgress({ userId, notification, sendToUser, port }) {
  const steps = [20, 40, 60, 80, 100];
  let sequence = notification.sequence;

  steps.forEach((progress, index) => {
    setTimeout(() => {
      sequence += 1;
      const isCompleted = progress === 100;
      const normalizedProgress = isCompleted ? 100 : progress / 10;

      const updated = {
        ...notification,
        status: isCompleted ? "completed" : "processing",
        code: isCompleted ? "REPORT_EXPORT_COMPLETED" : "REPORT_EXPORT_PROCESSING",
        title: isCompleted ? "Reporte listo" : "Exportacion en proceso",
        message: isCompleted
          ? `Tu reporte ${notification.format.toUpperCase()} ya esta disponible para descargar`
          : `Tu reporte ${notification.format.toUpperCase()} va en ${normalizedProgress}%`,
        progress: normalizedProgress,
        downloadUrl: isCompleted
          ? `http://localhost:${port}/downloads/${notification.jobId}.${notification.format}`
          : null,
        action: isCompleted
          ? {
              type: "download",
              label: "Descargar",
              url: `http://localhost:${port}/downloads/${notification.jobId}.${notification.format}`,
              target: "_blank",
            }
          : { type: "none", label: null, url: null, target: null },
        updatedAt: new Date().toISOString(),
        sequence,
      };

      const store = readNotifications();
      const itemIndex = store.items.findIndex((item) => item.id === notification.id);
      if (itemIndex !== -1) {
        store.items[itemIndex] = updated;
        writeNotifications(store);
      }

      sendToUser(userId, {
        event: "notification.upsert",
        data: { notification: updated },
      });
    }, (index + 1) * 2000);
  });
}

module.exports = { createNotificationRouter };
