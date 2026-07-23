const fs = require("fs");
const path = require("path");

const NOTIFICATIONS_FILE = path.join(__dirname, "..", "data", "notifications.json");
const DASHBOARDS_FILE = path.join(__dirname, "..", "data", "dashboards.json");

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readNotifications() {
  return readJson(NOTIFICATIONS_FILE, { items: [] });
}

function writeNotifications(data) {
  writeJson(NOTIFICATIONS_FILE, data);
}

function readDashboards() {
  return readJson(DASHBOARDS_FILE, { items: [] });
}

function writeDashboards(data) {
  writeJson(DASHBOARDS_FILE, data);
}

module.exports = {
  readNotifications,
  writeNotifications,
  readDashboards,
  writeDashboards,
};
