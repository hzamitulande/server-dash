const express = require("express");
const { randomUUID } = require("crypto");
const { readDashboards, writeDashboards } = require("../services/store.service");
const { WIDGET_FILTERS } = require("../services/mock-data.service");

const WIDGET_CATEGORIES = Object.freeze({
  EXECUTIVE: "executive",
  ENGINEERING: "engineering",
  PRODUCT: "product",
  INFRASTRUCTURE: "infrastructure",
  SUPPORT: "support",
  SECURITY: "security",
  FINOPS: "finops",
});

const WIDGETS_FOR_ATTENDANCE_ROUTE = Object.freeze([
  { id: "w-bar-daily", label: "Throughput IA por Producto", endpoint: "/widget/bar-daily", category: WIDGET_CATEGORIES.PRODUCT },
  { id: "w-area-weekly", label: "Latencia p95 Semanal", endpoint: "/widget/area-weekly", category: WIDGET_CATEGORIES.INFRASTRUCTURE },
  { id: "w-kpi-coverage", label: "SLA General de Plataforma", endpoint: "/widget/kpi-coverage", category: WIDGET_CATEGORIES.EXECUTIVE },
  { id: "w-diaria-desglose", label: "Adopcion de Copilot por Area", endpoint: "/widget/asistencia-desglose", category: WIDGET_CATEGORIES.PRODUCT },
  { id: "w-area-overtime", label: "Costo Cloud y Eficiencia", endpoint: "/widget/area-overtime", category: WIDGET_CATEGORIES.FINOPS },
  { id: "w-monitoreo-hardware", label: "Capacidad de Clusters GPU", endpoint: "/widget/monitoreo-hardware", category: WIDGET_CATEGORIES.INFRASTRUCTURE },
  { id: "w-fugas-tiempo-combinadas", label: "Incidentes por Dominio", endpoint: "/widget/fugas-tiempo-combinadas", category: WIDGET_CATEGORIES.ENGINEERING },
  { id: "w-puntualidad", label: "Pipeline de Despliegue", endpoint: "/widget/puntualidad", category: WIDGET_CATEGORIES.ENGINEERING },
  { id: "w-table-absent", label: "Backlog de Soporte Enterprise", endpoint: "/widget/table-absent", category: WIDGET_CATEGORIES.SUPPORT },
  { id: "w-kpi-coverage-2", label: "Calidad de Despliegues", endpoint: "/widget/kpi-coverage-2", category: WIDGET_CATEGORIES.ENGINEERING },
  { id: "w-kpi-coverage-3", label: "Riesgo de Seguridad", endpoint: "/widget/kpi-coverage-3", category: WIDGET_CATEGORIES.SECURITY },
  { id: "w-close", label: "Resolucion de Incidentes Criticos", endpoint: "/widget/close", category: WIDGET_CATEGORIES.SUPPORT },
  { id: "w-widget-pie", label: "MRR por Linea de Producto", endpoint: "/widget/widget-pie", category: WIDGET_CATEGORIES.EXECUTIVE },
]);

const WIDGETS_FOR_PICKER = Object.freeze([
  { id: "bar-daily", label: "Throughput IA por Producto", endpoint: "/widget/bar-daily", category: WIDGET_CATEGORIES.PRODUCT },
  { id: "area-weekly", label: "Latencia p95 Semanal", endpoint: "/widget/area-weekly", category: WIDGET_CATEGORIES.INFRASTRUCTURE },
  { id: "kpi-coverage", label: "SLA General de Plataforma", endpoint: "/widget/kpi-coverage", category: WIDGET_CATEGORIES.EXECUTIVE },
  { id: "asistencia-desglose", label: "Adopcion de Copilot por Area", endpoint: "/widget/asistencia-desglose", category: WIDGET_CATEGORIES.PRODUCT },
  { id: "area-overtime", label: "Costo Cloud y Eficiencia", endpoint: "/widget/area-overtime", category: WIDGET_CATEGORIES.FINOPS },
  { id: "monitoreo-hardware", label: "Capacidad de Clusters GPU", endpoint: "/widget/monitoreo-hardware", category: WIDGET_CATEGORIES.INFRASTRUCTURE },
  { id: "fugas-tiempo-combinadas", label: "Incidentes por Dominio", endpoint: "/widget/fugas-tiempo-combinadas", category: WIDGET_CATEGORIES.ENGINEERING },
  { id: "w-puntualidad", label: "Pipeline de Despliegue", endpoint: "/widget/puntualidad", category: WIDGET_CATEGORIES.ENGINEERING },
  { id: "w-table-absent", label: "Backlog de Soporte Enterprise", endpoint: "/widget/table-absent", category: WIDGET_CATEGORIES.SUPPORT },
  { id: "kpi-coverage-2", label: "Calidad de Despliegues", endpoint: "/widget/kpi-coverage-2", category: WIDGET_CATEGORIES.ENGINEERING },
  { id: "kpi-coverage-3", label: "Riesgo de Seguridad", endpoint: "/widget/kpi-coverage-3", category: WIDGET_CATEGORIES.SECURITY },
  { id: "w-close", label: "Resolucion de Incidentes Criticos", endpoint: "/widget/close", category: WIDGET_CATEGORIES.SUPPORT },
  { id: "w-widget-pie", label: "MRR por Linea de Producto", endpoint: "/widget/widget-pie", category: WIDGET_CATEGORIES.EXECUTIVE },
]);

function withMetaData(blocks) {
  return [
    ...blocks,
    {
      metaData: {
        updateAt: new Date().toISOString(),
      },
    },
  ];
}

function createDashboardRouter(requireAuth) {
  const router = express.Router();

  router.get("/attendance", requireAuth, (_req, res) => {
    return res.json({ data: { widgets: WIDGETS_FOR_ATTENDANCE_ROUTE } });
  });

  router.post("/widget/kpi-coverage", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "gauge",
          props: {
            label: "SLA mensual de plataforma",
            value: 99.92,
            unit: "%",
            context: "Objetivo 99.90%",
            colorStops: [
              { limit: 98.5, color: "#ef4444" },
              { limit: 99.5, color: "#f59e0b" },
              { limit: 100, color: "#22c55e" },
            ],
          },
        },
        {
          type: "trend",
          props: {
            label: "Variacion semanal",
            value: 0.18,
            unit: "pp",
            direction: "up",
            color: "#22C55E",
          },
        },
        {
          type: "distribution",
          props: [
            { key: "tenants", label: "Clientes enterprise activos", value: 187 },
            { key: "incidents", label: "Incidentes con brecha SLA (30d)", value: 3 },
            {
              key: "distribution",
              type: "distribution",
              label: "Estado operativo de servicios",
              segments: [
                { label: "Operacion normal", value: 92, color: "#5371c2" },
                { label: "Degradacion parcial", value: 6, color: "#94A3B8" },
                { label: "Interrupcion", value: 2, color: "#475569" },
              ],
            },
          ],
        },
      ]),
    });
  });

  router.post("/widget/bar-daily", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "bar",
          props: {
            isStacked: true,
            series_config: [
              { key: "value_1", label: "Solicitudes IA (k)", color: "#0ea5e9" },
              { key: "value_2", label: "Tokens procesados (M)", color: "#86efac" },
            ],
            series: [
              { label: "Cari Assistant", value_1: 1280, value_2: 56 },
              { label: "Falcon Analytics", value_1: 980, value_2: 42 },
              { label: "Gik Copilot", value_1: 760, value_2: 35 },
              { label: "Cari Vision", value_1: 420, value_2: 18 },
            ],
          },
        },
        { type: "kpi", props: { label: "Solicitudes IA del dia", value: "3.44M" } },
        { type: "kpi", props: { label: "Tokens procesados", value: "151M" } },
        { type: "kpi", props: { label: "Producto con mayor carga", value: "Cari Assistant" } },
      ]),
    });
  });

  router.post("/widget/area-weekly", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "area",
          props: {
            series_config: [
              { key: "value_1", label: "Latencia p95 API (ms)", color: "#5371c2" },
            ],
            series: [
              { label: "Sem 1", value_1: 212 },
              { label: "Sem 2", value_1: 206 },
              { label: "Sem 3", value_1: 198 },
              { label: "Sem 4", value_1: 221 },
              { label: "Sem 5", value_1: 194 },
              { label: "Sem 6", value_1: 187 },
            ],
          },
        },
        { type: "kpi", props: { label: "Promedio p95 mensual", value: "203 ms" } },
        { type: "kpi", props: { label: "Mejor semana", value: "Sem 6 (187 ms)" } },
        { type: "kpi", props: { label: "Peor semana", value: "Sem 4 (221 ms)" } },
      ]),
    });
  });

  router.post("/widget/puntualidad", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
         {
          type: "gauge",
          props: {
            label: "SLA mensual de plataforma",
            value: 99.92,
            unit: "%",
            context: "Objetivo 99.90%",
            colorStops: [
              { limit: 18.5, color: "#ef4444" },
              { limit: 49.5, color: "#f59e0b" },
              { limit: 100, color: "#22c55e" },
            ],
          },
        },
        {
          type: "distribution",
          props: [
            { key: "deployments", label: "Despliegues completados (7d)", value: 64 },
            { key: "rollback_rate", label: "Rollback rate", value: "3.1%" },
            {
              key: "distribution",
              type: "distribution",
              label: "Resultado de despliegues",
              segments: [
                { label: "Exitosos", value: 58, color: "#5371c2" },
                { label: "Con rollback", value: 4, color: "#94A3B8" },
                { label: "Fallidos", value: 2, color: "#475569" },
              ],
            },
          ],
        },
        {
          type: "trend",
          props: {
            label: "Cambio en lead time",
            value: 11,
            unit: "%",
            direction: "down",
            color: "#22C55E",
          },
        },
      ]),
    });
  });

  router.post("/widget/asistencia-desglose", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "bar",
          props: {
            isStacked: true,
            series_config: [
              { key: "value_1", label: "Usuarios activos IA", color: "#67e8f9" },
              { key: "value_2", label: "Usuarios objetivo", color: "#0ea5e9" },
            ],
            series: [
              { label: "Operaciones", value_1: 930, value_2: 1200 },
              { label: "Comercial", value_1: 640, value_2: 800 },
              { label: "Soporte", value_1: 510, value_2: 700 },
              { label: "Finanzas", value_1: 320, value_2: 450 },
            ],
          },
        },
        {
          type: "gauge",
          props: {
            label: "Adopcion mensual de IA",
            value: 68.4,
            unit: "%",
            context: "2,400 de 3,150 usuarios objetivo",
            colorStops: [
              { limit: 40, color: "#FF6B6B" },
              { limit: 75, color: "#FFC857" },
              { limit: 100, color: "#2EC4B6" },
            ],
          },
        },
        {
          type: "trend",
          props: {
            label: "Crecimiento vs mes anterior",
            value: 6.7,
            unit: "%",
            direction: "up",
            color: "#22C55E",
          },
        },
        { type: "kpi", props: { label: "Usuarios activos hoy", value: 2400 } },
        { type: "kpi", props: { label: "Area con mayor adopcion", value: "Operaciones" } },
        { type: "kpi", props: { label: "Objetivo mensual", value: "72%" } },
      ]),
    });
  });

  router.post("/widget/area-overtime", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "area",
          props: {
            series_config: [
              { key: "value_1", label: "Costo cloud semanal (COP MM)", color: "#5371c2" },
            ],
            series: [
              { label: "Sem 1", value_1: 182 },
              { label: "Sem 2", value_1: 176 },
              { label: "Sem 3", value_1: 191 },
              { label: "Sem 4", value_1: 169 },
              { label: "Sem 5", value_1: 165 },
            ],
          },
        },
        { type: "kpi", props: { label: "Gasto cloud acumulado", value: "883 COP MM" } },
        { type: "kpi", props: { label: "Costo por 1k requests", value: "COP 2,140" } },
        { type: "kpi", props: { label: "Semana de mayor costo", value: "Sem 3" } },
      ]),
    });
  });

  router.post("/widget/monitoreo-hardware", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "gauge",
          props: {
            label: "Capacidad disponible de GPU",
            value: 74,
            unit: "%",
            context: "222 GPUs libres de 300",
            colorStops: [
              { limit: 35, color: "#EF4444" },
              { limit: 65, color: "#F59E0B" },
              { limit: 100, color: "#22C55E" },
            ],
          },
        },
        {
          type: "trend",
          props: {
            label: "Variacion de temperatura media",
            value: 2.1,
            unit: "C",
            direction: "down",
            color: "#22C55E",
          },
        },
        {
          type: "distribution",
          props: [
            { key: "nodes", label: "Nodos monitoreados", value: 57 },
            { key: "maintenance", label: "Nodos en mantenimiento", value: 4 },
            {
              key: "distribution",
              type: "distribution",
              label: "Estado de salud de nodos",
              segments: [
                { label: "Saludable", value: 49, color: "#5371c2" },
                { label: "Observacion", value: 6, color: "#94A3B8" },
                { label: "Critico", value: 2, color: "#475569" },
              ],
            },
          ],
        },
      ]),
    });
  });

  router.post("/widget/fugas-tiempo-combinadas", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "bar",
          props: {
            isStacked: true,
            series_config: [
              { key: "value_1", label: "Incidentes abiertos", color: "#38bdf8" },
              { key: "value_2", label: "Incidentes resueltos", color: "#86efac" },
            ],
            series: [
              { label: "API Gateway", value_1: 19, value_2: 36 },
              { label: "Data Platform", value_1: 14, value_2: 31 },
              { label: "LLM Serving", value_1: 27, value_2: 42 },
              { label: "Auth & IAM", value_1: 8, value_2: 19 },
            ],
          },
        },
        { type: "kpi", props: { label: "Total incidentes del periodo", value: 196 } },
        { type: "kpi", props: { label: "Dominio con mayor recurrencia", value: "LLM Serving" } },
        { type: "kpi", props: { label: "MTTR promedio", value: "1h 42m" } },
      ]),
    });
  });

  router.post("/widget/table-absent", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "table",
          props: {
            columns: [
              { key: "account", label: "Cuenta" },
              { key: "ticket", label: "Ticket" },
              { key: "severity", label: "Severidad" },
              { key: "open_since", label: "Abierto desde" },
              { key: "sla_risk", label: "Riesgo SLA" },
              { key: "owner", label: "Owner" },
              { key: "region", label: "Region" },
              { key: "status", label: "Estado" },
            ],
            rows: [
              { account: "Andina Retail Group", ticket: "SUP-3145", severity: "P1", open_since: "2026-10-05 09:12", sla_risk: "Alto", owner: "Lina G.", region: "Bogota", status: "En investigacion" },
              { account: "Banco Cumbre", ticket: "SUP-3138", severity: "P2", open_since: "2026-10-05 11:45", sla_risk: "Medio", owner: "David M.", region: "Medellin", status: "Pendiente cliente" },
              { account: "Nova Logistics", ticket: "SUP-3132", severity: "P2", open_since: "2026-10-04 17:26", sla_risk: "Medio", owner: "Carla O.", region: "Cali", status: "En validacion" },
              { account: "Salud TotalNet", ticket: "SUP-3127", severity: "P1", open_since: "2026-10-04 08:31", sla_risk: "Alto", owner: "Johan R.", region: "Bogota", status: "Escalado a SRE" },
              { account: "Energia Pacifico", ticket: "SUP-3119", severity: "P3", open_since: "2026-10-03 14:09", sla_risk: "Bajo", owner: "Diana P.", region: "Barranquilla", status: "En cola" },
              { account: "Grupo Prisma", ticket: "SUP-3110", severity: "P2", open_since: "2026-10-03 09:20", sla_risk: "Medio", owner: "Fabian C.", region: "Bucaramanga", status: "En curso" },
              { account: "Cooperativa Alto Norte", ticket: "SUP-3107", severity: "P3", open_since: "2026-10-02 16:55", sla_risk: "Bajo", owner: "Sandra N.", region: "Pereira", status: "Pendiente patch" },
              { account: "Telecom Oriente", ticket: "SUP-3098", severity: "P2", open_since: "2026-10-02 10:02", sla_risk: "Medio", owner: "Juan S.", region: "Bogota", status: "Mitigado" },
            ],
          },
        },
      ]),
    });
  });

  router.post("/widget/kpi-coverage-2", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "gauge",
          props: {
            label: "Change failure rate saludable",
            value: 96.8,
            unit: "%",
            context: "Objetivo >= 95%",
            colorStops: [
              { limit: 84, color: "#ef4444" },
              { limit: 94, color: "#eab308" },
              { limit: 100, color: "#22c55e" },
            ],
          },
        },
        {
          type: "trend",
          props: {
            label: "Variacion quincenal",
            value: 1.4,
            unit: "pp",
            direction: "up",
            color: "#22C55E",
          },
        },
        {
          type: "distribution",
          props: [
            { key: "deploys", label: "Despliegues totales (30d)", value: 182 },
            { key: "failed", label: "Despliegues fallidos", value: 6 },
            {
              key: "distribution",
              type: "distribution",
              label: "Resultado de despliegues",
              segments: [
                { label: "Exitosos", value: 176, color: "#5371c2" },
                { label: "Con rollback", value: 4, color: "#94A3B8" },
                { label: "Fallidos", value: 2, color: "#475569" },
              ],
            },
          ],
        },
      ]),
    });
  });

  router.post("/widget/kpi-coverage-3", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "gauge",
          props: {
            label: "Security hardening score",
            value: 88.1,
            unit: "%",
            context: "Target trimestral: 90%",
            colorStops: [
              { limit: 70, color: "#ef4444" },
              { limit: 85, color: "#eab308" },
              { limit: 100, color: "#22c55e" },
            ],
          },
        },
        {
          type: "trend",
          props: {
            label: "Riesgo residual vs semana anterior",
            value: 8,
            unit: "%",
            direction: "down",
            color: "#22C55E",
          },
        },
        {
          type: "distribution",
          props: [
            { key: "critical_open", label: "Vulnerabilidades criticas abiertas", value: 2 },
            { key: "high_open", label: "Vulnerabilidades altas abiertas", value: 9 },
            {
              key: "distribution",
              type: "distribution",
              label: "Inventario de vulnerabilidades",
              segments: [
                { label: "Criticas", value: 2, color: "#475569" },
                { label: "Altas", value: 9, color: "#94A3B8" },
                { label: "Medias", value: 17, color: "#5371c2" },
              ],
            },
          ],
        },
      ]),
    });
  });

  router.post("/widget/close", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "pie",
          props: {
            series: [
              { label: "Resueltos en SLA", value: 47, color: "#22C55E" },
              { label: "Resueltos fuera de SLA", value: 9, color: "#F59E0B" },
              { label: "Abiertos", value: 6, color: "#EF4444" },
            ],
          },
        },
        {
          type: "kpi",
          props: {
            label: "Incidentes P1/P2 activos",
            value: 6,
            context: "Ultimos 7 dias",
          },
        },
        {
          type: "distribution",
          props: [
            {
              key: "distribution",
              type: "distribution",
              label: "Tiempo de respuesta inicial",
              segments: [
                { label: "< 10 min", value: 38, valueLabel: "casos", color: "#22C55E" },
                { label: "10-30 min", value: 17, valueLabel: "casos", color: "#F59E0B" },
                { label: "> 30 min", value: 7, valueLabel: "casos", color: "#EF4444" },
              ],
            },
          ],
        },
      ]),
    });
  });

  router.post("/widget/widget-pie", requireAuth, (_req, res) => {
    return res.json({
      data: withMetaData([
        {
          type: "pie",
          props: {
            series: [
              { label: "Cari Assistant", value: 38, color: "#22C55E" },
              { label: "Falcon Analytics", value: 27, color: "#0EA5E9" },
              { label: "Gik Copilot", value: 21, color: "#F59E0B" },
              { label: "Servicios Profesionales", value: 14, color: "#A855F7" },
            ],
          },
        },
      ]),
    });
  });

  router.get("/dashboards-list", requireAuth, (_req, res) => {
    const { items } = readDashboards();
    const views = items.map((dashboard) => ({
      ...dashboard,
      layout_config: (dashboard.layout_config || []).map((widget) => ({
        ...widget,
        filters: widget.filters ?? WIDGET_FILTERS,
      })),
    }));

    return res.json({ data: { endpoint: "/widgets-list", views } });
  });

  router.post("/dashboards-list", requireAuth, (req, res) => {
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

  router.put("/dashboards-list/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const { name, layout_config } = req.body ?? {};
    const store = readDashboards();
    const index = store.items.findIndex((item) => item.id === id);

    if (index === -1) {
      return res.status(404).json({ message: "Dashboard no encontrado" });
    }

    if (name !== undefined) store.items[index].name = name;
    if (layout_config !== undefined) store.items[index].layout_config = layout_config;
    store.items[index].updated_at = new Date().toISOString();

    writeDashboards(store);
    return res.json({ data: store.items[index] });
  });

  router.delete("/dashboards-list/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const store = readDashboards();
    const before = store.items.length;

    store.items = store.items.filter((item) => item.id !== id);
    if (store.items.length === before) {
      return res.status(404).json({ message: "Dashboard no encontrado" });
    }

    writeDashboards(store);
    return res.json({ data: {} });
  });

  router.get("/widgets-list", requireAuth, (_req, res) => {
    return res.json({
      data: {
        widgets: WIDGETS_FOR_PICKER.map((widget) => ({
          ...widget,
          filters: WIDGET_FILTERS,
        })),
        global_filters: {},
      },
    });
  });

  return router;
}

module.exports = { createDashboardRouter };
