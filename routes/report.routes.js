const express = require("express");
const { BRANCHES, MOCK_EMPLOYEES, MOCK_HOUR_COLS, buildPayrollRows } = require("../services/mock-data.service");
const { getOperatorsForType, evalExpression, validateFilterExpression, normalizeLegacyFilters } = require("../services/report-filter.service");

function buildColumnsMeta() {
  const raw = [
    { key: "person_id_ALIAS_3", label: "identification", type: "string" },
    { key: "person_id_ALIAS_2", label: "name", type: "string" },
    { key: "date_arr", label: "date", type: "date" },
    { key: "time_arr", label: "arrival", type: "string" },
    { key: "time_left", label: "departure", type: "string" },
    { key: "worked_hours", label: "total", type: "number" },
    ...MOCK_HOUR_COLS.map((key) => ({ key, label: key, type: "number" })),
    { key: "GC_NOVEDADES", label: "notice", type: "string" },
  ];

  return raw.map((column) => ({
    ...column,
    filterable: true,
    operators: getOperatorsForType(column.type),
  }));
}

function buildReportResponse({ page, pageSize, rows }) {
  const total = rows.length;
  const start = (page - 1) * pageSize;
  const content = rows.slice(start, start + pageSize);

  return {
    data: {
      columnGroups: [
        { label: "report.group.general.info", columns: ["person_id_ALIAS_3", "person_id_ALIAS_2", "date_arr", "time_arr", "time_left", "worked_hours"] },
        { label: "report.group.regular.hours", columns: ["person_id_ALIAS_2", "HO", "HT", "LUNC", "HOSM"] },
        { label: "report.group.extra.daytime.hours", columns: ["person_id_ALIAS_2", "HED", "HED2", "HEDM", "AHED", "HEA", "HEDT"] },
        { label: "report.group.extra.nighttime.hours", columns: ["person_id_ALIAS_2", "HEN", "HENM"] },
      ],
      columns: buildColumnsMeta(),
      content,
      filters: {
        start_time: { type: "time-range", required: true, format: "Y-m-d H:i:s", label: "report.filter.datetime" },
        identification: { type: "string", required: false, label: "report.filter.identification", endpoint: "/local-api/filter/identification" },
        branch_office: { type: "string", required: false, label: "report.filter.branch_office", endpoint: "/local-api/filter/branch-office" },
        name: { type: "string", required: false, label: "report.filter.name", endpoint: "/local-api/filter/name" },
        view: { endpoint: "/local-api/report/config/view" },
      },
      pagination: { page, pageSize, total },
      meta: { generatedAt: new Date().toISOString(), exportAvailable: true },
    },
    code: 200,
    message: "Reporte generado exitosamente.",
  };
}

function handleReport(req, res) {
  const { page = 1, pageSize = 20, filterExpression, filters } = req.body ?? {};

  const allRows = buildPayrollRows(3);
  const effectiveExpression = filterExpression || normalizeLegacyFilters(filters);

  if (filterExpression) {
    const validation = validateFilterExpression(filterExpression);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        message: "Invalid filterExpression",
        errors: validation.errors,
      });
    }
  }

  if (!filterExpression && effectiveExpression) {
    const validation = validateFilterExpression(effectiveExpression);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        message: "Invalid normalized filters",
        errors: validation.errors,
      });
    }
  }

  const filteredRows = effectiveExpression
    ? allRows.filter((row) => evalExpression(effectiveExpression, row))
    : allRows;

  return res.json(buildReportResponse({ page, pageSize, rows: filteredRows }));
}

function createReportRouter(requireAuth) {
  const router = express.Router();

  router.post("/prenomina-data", requireAuth, handleReport);

  router.post("/filter/identification", requireAuth, (req, res) => {
    const { identification = "" } = req.body ?? {};
    const query = String(identification).toLowerCase();

    const matches = MOCK_EMPLOYEES
      .filter((employee) => employee.id.toLowerCase().includes(query))
      .slice(0, 8)
      .map((employee) => ({ id: employee.id, code: employee.id, label: employee.name }));

    return res.json({ data: matches });
  });

  router.post("/filter/branch-office", requireAuth, (req, res) => {
    const { branch_office = "" } = req.body ?? {};
    const query = String(branch_office).toLowerCase();

    const matches = BRANCHES
      .filter((branch) => branch.label.toLowerCase().includes(query) || branch.code.includes(query))
      .map((branch) => ({ id: branch.code, code: branch.code, label: branch.label }));

    return res.json({ data: matches });
  });

  router.post("/filter/name", requireAuth, (req, res) => {
    const { name = "" } = req.body ?? {};
    const query = String(name).toLowerCase();

    const matches = MOCK_EMPLOYEES
      .filter((employee) => employee.name.toLowerCase().includes(query))
      .slice(0, 8)
      .map((employee) => ({ id: employee.id, code: employee.id, label: employee.name }));

    return res.json({ data: matches });
  });

  router.get("/report/config/view", requireAuth, (_req, res) => {
    return res.json({
      data: [
        { code: "daily", label: "Diario" },
        { code: "weekly", label: "Semanal" },
        { code: "monthly", label: "Mensual" },
      ],
    });
  });

  return router;
}

module.exports = { createReportRouter };
