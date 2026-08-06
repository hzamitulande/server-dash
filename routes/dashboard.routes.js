const express = require("express");
const { randomUUID } = require("crypto");
const { readDashboards, writeDashboards } = require("../services/store.service");
const { WIDGET_FILTERS } = require("../services/mock-data.service");
const { type } = require("os");

function buildAttendanceWidgets() {
  return [
    // { id: "w-kpi-present", type: "kpi", subtype: "kpi", title: "attendance.kpi.present", endpoint: "/widget/kpi-present" },
    // { id: "w-kpi-absent", type: "kpi", subtype: "kpi", title: "attendance.kpi.absent", endpoint: "/widget/kpi-absent" },
    // { id: "w-kpi-late", type: "kpi", subtype: "kpi", title: "attendance.kpi.late", endpoint: "/widget/kpi-late" },
    { id: "w-bar-daily", label: "attendance.chart.daily", endpoint: "/widget/bar-daily" },
    { id: "w-area-weekly", label: "Evolución de Horas Extras", endpoint: "/widget/area-weekly" },
    // { id: "w-pie-absence", type: "chart", subtype: "pie", title: "attendance.chart.absence_distribution", endpoint: "/widget/pie-absence" },
    // { id: "w-inactive-user", type: "chart", subtype: "table", title: "attendance.chart.inactive_users", endpoint: "/widget/inactive-users" },
    { id: "w-kpi-coverage", label: "attendance.kpi.coverage", endpoint: "/widget/kpi-coverage" },
    // { id: "w-bar-methods", type: "chart", subtype: "bar", stylized: "bar-group", title: "attendance.chart.methods", endpoint: "/widget/bar-methods" },
    { id: "w-diaria-desglose", label: "Asistencia Diaria y Desglose Operativo", endpoint: "/widget/asistencia-desglose" },
    { id: "w-area-overtime", label: "Análisis de Horas Extras (Sobrecostos de Nómina)", endpoint: "/widget/area-overtime" },
    { id: "w-monitoreo-hardware", label: "Monitoreo de Hardware (Lectores Biométricos)", endpoint: "/widget/monitoreo-hardware" },
    { id: "w-fugas-tiempo-combinadas", label: "Fugas de Tiempo Combinadas por Sucursal", endpoint: "/widget/fugas-tiempo-combinadas" },
  ];
}

function createDashboardRouter(requireAuth) {
  const router = express.Router();

  router.get("/attendance", requireAuth, (_req, res) => {
    return res.json({ data: { widgets: buildAttendanceWidgets() } });
  });

  router.post("/widget/kpi-present", requireAuth, (_req, res) => {
    return res.json({
      data: {
        mainValue: { value: 142 },
        metrics: [
          { type: "numeric", key: "inbound", value: 130, label: "attendance.kpi.entries" },
          { type: "numeric", key: "outbound", value: 12, label: "attendance.kpi.exits" },
          {
            key: "distribution",
            type: "distribution",
            label: "attendance.kpi.distribution",
            segments: [
              { label: "Presentes", value: 130, color: "#22c55e" },
              { label: "Ausentes", value: 12, color: "#ef4444" },
            ],
          },
        ],
        trend: { direction: "up", value: "3", unit: "%", color: "#22c55e", label: "attendance.trend.vs_yesterday", create_at: "" },
      },
    });
  });

  router.post("/widget/kpi-coverage", requireAuth, (_req, res) => {
    return res.json({
      data: [
        {
          type: "gauge",
          props: {
            label: "Cobertura en Tiempo Real",
            value: 87,
          }
        },
        {
          type: "trend",
          props: {
            label: "Tendencia",
            value: 3,
            unit: "%",
            direction: "up",
            color: "#22C55E"
          }
        },
        {
          type: "distribution",
          props: [
            {
              key: "presentes",
              label: "EMPLEADOS PRESENTES",
              value: 2740
            },
            {
              key: "programados",
              label: "EMPLEADOS PROGRAMADOS",
              value: 3140
            },
            {
              key: "distribution",
              type: "distribution",
              label: "Distribución de Estado",
              segments: [
                { label: "A tiempo", value: 2740, color: "#22C55E" },
                { label: "Atrasos", value: 280, color: "#F59E0B" },
                { label: "Ausentes", value: 120, color: "#EF4444" }
              ]
            }
          ]
        }
      ]
    });
  });

  router.post("/widget/kpi-absent", requireAuth, (_req, res) => {
    return res.json({
      data: {
        mainValue: { value: 18 },
        metrics: [
          { type: "numeric", key: "justified", value: 10, label: "attendance.kpi.justified" },
          { type: "numeric", key: "unjustified", value: 8, label: "attendance.kpi.unjustified" },
          {
            key: "distribution",
            type: "distribution",
            label: "attendance.kpi.absence_type",
            segments: [
              { label: "Justificadas", value: 10, color: "#f59e0b" },
              { label: "No justificadas", value: 8, color: "#ef4444" },
            ],
          },
        ],
        trend: { direction: "down", value: "2", unit: "%", color: "#22c55e", label: "attendance.trend.vs_yesterday", create_at: "" },
      },
    });
  });

  router.post("/widget/kpi-late", requireAuth, (_req, res) => {
    return res.json({
      data: {
        mainValue: { value: 7 },
        metrics: [
          { type: "numeric", key: "avg_minutes", value: "12:30", label: "attendance.kpi.avg_delay" },
          {
            key: "distribution",
            type: "distribution",
            label: "attendance.kpi.delay_range",
            segments: [
              { label: "< 15 min", value: 4, color: "#f59e0b" },
              { label: "15-30 min", value: 2, color: "#f97316" },
              { label: "> 30 min", value: 1, color: "#ef4444" },
            ],
          },
        ],
        trend: { direction: "up", value: "1", unit: "", color: "#ef4444", label: "attendance.trend.vs_yesterday", create_at: "" },
      },
    });
  });

  router.post("/widget/bar-daily", requireAuth, (_req, res) => {
    const days = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
    return res.json({
      data: [
        {
          type: "bar",
          props: {
            isStacked: true,
            series_config: [
              {
                key: "value_1",
                label: "Minutos de Retraso",
                color: "#0091ec"
              },
              {
                key: "value_2",
                label: "Total Ausencias",
                color: "#adeccd"
              }
            ],
            series: [
              {
                label: "Operaciones",
                value_1: 845,
                value_2: 120
              },
              {
                label: "Logística",
                value_1: 620,
                value_2: 80
              },
              {
                label: "Ventas",
                value_1: 315,
                value_2: 30
              },
              {
                label: "Administración",
                value_1: 120,
                value_2: 10
              }
            ]
          }
        },
        {
          type: "kpi",
          props: {
            label: "Total Minutos Perdidos",
            value: 1900
          },
        },
        {
          type: "kpi",
          props: {
            label: "Total Ausencias",
            value: 240
          },
        },
        {
          type: "kpi",
          props: {
            label: "Foco de Atención (Retrasos)",
            value: "Operaciones"
          }
        }
      ]
    });
  });

  router.post("/widget/bar-weekly", requireAuth, (_req, res) => {
    const weeks = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
    return res.json({
      data: {
        series: [
          { name: "Entradas", data: weeks.map((w) => ({ type: w, value: 700 + Math.floor(Math.random() * 100) })) },
        ],
      },
    });
  });

  router.post("/widget/area-weekly", requireAuth, (_req, res) => {

    return res.json({
      data: [
        {
          type: "area",
          props: {
            series_config: [
              {
                key: "value_1",
                label: "Horas Extras (Total)",
                color: "#adeccd"
              }
            ],
            series: [
              {
                label: "01 Jul",
                value_1: 105
              },
              {
                label: "08 Jul",
                value_1: 145
              },
              {
                label: "15 Jul",
                value_1: 110
              },
              {
                label: "22 Jul",
                value_1: 180
              },
              {
                label: "29 Jul",
                value_1: 95
              },
              {
                label: "05 Ago",
                value_1: 105
              }
            ]
          }
        },
        {
          type: "kpi",
          props: {
            label: "Total Acumulado",
            value: 755
          },
        },
        {
          type: "kpi",
          props: {
            label: "Promedio Semanal",
            value: 125.8
          },
        },
        {
          type: "kpi",
          props: {
            label: "Pico Máximo",
            value: "Semana 22 Jul"
          },
        }
      ]
    });
  });

  router.post("/widget/pie-absence", requireAuth, (_req, res) => {
    return res.json({
      data: {
        series: [
          {
            name: "Distribucion",
            data: [
              { type: "Presentes", value: 142 },
              { type: "Ausentes", value: 18 },
              { type: "Tardanzas", value: 7 },
              { type: "Vacaciones", value: 5 },
              { type: "Incapacidades", value: 3 },
            ],
          },
        ],
      },
    });
  });

  router.post("/widget/inactive-users", requireAuth, (_req, res) => {
    return res.json({
      data: {
        summary: { label: "Usuarios Inactivos", value: 3 },
        series: [
          {
            name: "Top Enterprices",
            type: "table",
            columns: [
              { key: "enterprice", label: "enterprice" },
              { key: "devices", label: "devices" },
            ],
            data: [
              {
                enterprice: "Dipsa Food",
                devices: "CELL PHONES FO00067 - LIVANOVA-OUTSOURCING DE RECEPCION",
                tooltip: "2018-10-18 09:43:01",
              },
              {
                enterprice: "Adecco Outsourcing Colombia",
                devices: "CELL PHONES FO00068 - LIVANOVA-OUTSOURCING DE RECEPCION",
                tooltip: "2018-10-19 10:00:00",
              },
              {
                enterprice: "Empresa 3",
                devices: "CELL PHONES FO00069 - LIVANOVA-OUTSOURCING DE RECEPCION",
                tooltip: "2018-10-20 11:00:00",
              },
            ],
          },
        ],
      },
    });
  });

  router.post("/widget/bar-methods", requireAuth, (_req, res) => {
    const days = Array.from({ length: 30 }, (_, index) => index + 1);
    const biometricoValues = [22, 18, 95, 19, 89, 186, 14, 11, 17, 176, 13, 70, 18, 15, 16, 160, 17, 54, 15, 149, 14, 143, 10, 137, 14, 111, 128, 125, 122, 119];
    const manualValues = [15, 52, 14, 17, 10, 102, 165, 168, 70, 73, 16, 78, 81, 14, 16, 89, 191, 14, 19, 19, 10, 24, 6, 19, 21, 11, 116, 219, 21, 224];
    const manualTotal = manualValues.reduce((acc, value) => acc + value, 0);
    const biometricoTotal = biometricoValues.reduce((acc, value) => acc + value, 0);
    const combinedTotal = manualTotal + biometricoTotal;
    const manualRatePercent = combinedTotal > 0 ? Number(((manualTotal / combinedTotal) * 100).toFixed(1)) : 0;

    return res.json({
      data: {
        summary: {
          type: "gauge",
          label: "% tasa mensual promedio",
          context: "Ultimos 30 días",
          value: `${manualRatePercent}`,
          unit: "%",
          color: "#2196f3",
        },
        series: [
          {
            label: "Biometrico",
            stackId: "a",
            yAxisId: "left",
            color: "#4caf50",
            data: days.map((day, index) => ({
              type: String(day),
              label: "Feb",
              value: biometricoValues[index],
            })),
          },
          {
            label: "Manual",
            stackId: "a",
            yAxisId: "left",
            color: "#2196f3",
            data: days.map((day, index) => ({
              type: String(day),
              label: "Feb",
              value: manualValues[index],
            })),
          },
        ],
      },
    });
  });

  router.post("/widget/asistencia-desglose", requireAuth, (_req, res) => {

    return res.json({
      data: [

        {
          type: "bar",
          props: {
            series_config: [
              {
                key: "value_1",
                label: "Empleados Presentes",
                color: "#adeccd"
              },
              {
                key: "value_2",
                label: "Empleados Ausentes",
                color: "#0091ec"
              }
            ],
            series: [
              {
                label: "Operaciones",
                value_1: 310,
                value_2: 24
              },
              {
                label: "Logística",
                value_1: 185,
                value_2: 18
              },
              {
                label: "Ventas",
                value_1: 150,
                value_2: 12
              },
              {
                label: "Administración",
                value_1: 75,
                value_2: 5
              }
            ]
          }
        },
        {
          type: "gauge",
          props: {
            label: "Asistencia Global (Hoy)",
            value: 92.4,
            context: "720 de 779 empleados presentes",
            unit: "%",
            color: "#adeccd"
          }
        },
        {
          type: "kpi",
          props: {
            label: "Total Ausencias Hoy",
            value: 59
          }
        },
        {
          type: "kpi",
          props: {
            label: "Foco de Atención (Más Ausencias)",
            value: "Operaciones"
          }
        },
        {
          type: "kpi",
          props: {
            label: "Mejor Asistencia",
            value: "Administración"
          }
        }
      ]
    });
  });

  router.post("/widget/area-overtime", requireAuth, (_req, res) => {
    return res.json({
      data: [
        {
          type: "area",
          props: {
            series_config: [
              {
                key: "value_1",
                label: "Horas Extras Generadas",
                color: "#F59E0B"
              }
            ],
            series: [
              {
                label: "Semana 1",
                value_1: 120
              },
              {
                label: "Semana 2",
                value_1: 150
              },
              {
                label: "Semana 3",
                value_1: 90
              },
              {
                label: "Semana 4",
                value_1: 140
              }
            ]
          }
        },
        {
          type: "kpi",
          props: {
            label: "Total Horas Extras (Mes)",
            value: 500
          }
        },
        {
          type: "kpi",
          props: {
            label: "Promedio Semanal",
            value: 125
          }
        },
        {
          type: "kpi",
          props: {
            label: "Semana Crítica (Pico)",
            value: "Semana 2"
          }
        }
      ]
    });
  });

  router.post("/widget/monitoreo-hardware", requireAuth, (_req, res) => {
    return res.json({
      data: [
        {
          type: "gauge",
          props: {
            label: "Dispositivos en Línea",
            value: 95,
            unit: "%",
            color: "#22C55E"
          }
        },
        {
          type: "trend",
          props: {
            label: "Estabilidad vs Mes Anterior",
            value: 2,
            unit: "%",
            direction: "up",
            color: "#22C55E"
          }
        },
        {
          type: "distribution",
          props: [
            {
              key: "total",
              label: "TOTAL DISPOSITIVOS INSTALADOS",
              value: 200
            },
            {
              key: "activos",
              label: "ACTIVOS Y SINCRONIZANDO",
              value: 190
            },
            {
              key: "distribution",
              type: "distribution",
              label: "Estado de Red",
              segments: [
                { label: "Online", value: 190, color: "#22C55E" },
                { label: "Falla de Sincronización", value: 6, color: "#F59E0B" },
                { label: "Offline (Caídos)", value: 4, color: "#EF4444" }
              ]
            }
          ]
        },
        {
          type: "kpi",
          props: {
            label: "Equipos que requieren Soporte Hoy",
            value: 10
          }
        }
      ]
    });
  });

  router.post("/widget/fugas-tiempo-combinadas", requireAuth, (_req, res) => {
    return res.json({
      data: [
        {
          type: "bar",
          props: {
            isStacked: true,
            series_config: [
              {
                key: "value_1",
                label: "Llegadas Tarde (Min)",
                color: "#0091ec"
              },
              {
                key: "value_2",
                label: "Salidas Tempranas (Min)",
                color: "#adeccd"
              }
            ],
            series: [
              {
                label: "Sucursal Norte",
                value_1: 420,
                value_2: 180
              },
              {
                label: "Sucursal Sur",
                value_1: 310,
                value_2: 90
              },
              {
                label: "Sucursal Este",
                value_1: 200,
                value_2: 45
              },
              {
                label: "Sucursal Oeste",
                value_1: 150,
                value_2: 30
              }
            ]
          }
        },
        {
          type: "kpi",
          props: {
            label: "Total Tiempo Perdido",
            value: "1425 Min"
          }
        },
        {
          type: "kpi",
          props: {
            label: "Infracción Principal",
            value: "Llegadas Tarde (1080 Min)"
          }
        },
        {
          type: "kpi",
          props: {
            label: "Sucursal Crítica",
            value: "Norte"
          }
        }
      ]
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
        widgets: [
          // { id: "kpi-present", type: "kpi", subtype: "kpi", title: "Presentes Hoy", endpoint: "/widget/kpi-present", path_widget: "/widget/kpi-present", description: "Total de empleados presentes hoy", filters: WIDGET_FILTERS },
          // { id: "kpi-absent", type: "kpi", subtype: "kpi", title: "Ausentes Hoy", endpoint: "/widget/kpi-absent", path_widget: "/widget/kpi-absent", description: "Total de empleados ausentes hoy", filters: WIDGET_FILTERS },
          // { id: "kpi-late", type: "kpi", subtype: "kpi", title: "Tardanzas", endpoint: "/widget/kpi-late", path_widget: "/widget/kpi-late", description: "Empleados con tardanza hoy", filters: WIDGET_FILTERS },
          { id: "bar-daily", label: "Asistencia Diaria", endpoint: "/widget/bar-daily", filters: WIDGET_FILTERS },
          // { id: "bar-weekly", type: "chart", subtype: "bar", title: "Asistencia Semanal", endpoint: "/widget/bar-weekly", path_widget: "/widget/bar-weekly", stylized: "bar-basic", description: "Asistencia por semana (ultimas 4 sem)", filters: WIDGET_FILTERS },
          { id: "area-weekly", label: "Evolución de Horas Extras", endpoint: "/widget/area-weekly", filters: WIDGET_FILTERS },
          // { id: "pie-absence", type: "chart", subtype: "pie", title: "Distribucion de Ausencias", endpoint: "/widget/pie-absence", path_widget: "/widget/pie-absence", description: "Distribucion por tipo de ausencia", filters: WIDGET_FILTERS },
          // { id: "inactive-users", type: "chart", subtype: "table", title: "Usuarios Inactivos", endpoint: "/widget/inactive-users", path_widget: "/widget/inactive-users", description: "Lista de usuarios inactivos recientemente", filters: WIDGET_FILTERS },
          { id: "kpi-coverage", label: "Cobertura de Turno en Tiempo Real (Presentismo)", endpoint: "/widget/kpi-coverage", filters: WIDGET_FILTERS },
          // { id: "bar-methods", type: "chart", subtype: "bar", title: "Distribución de Métodos de Registro", endpoint: "/widget/bar-methods", path_widget: "/widget/bar-methods", stylized: "bar-group", description: "Distribución de métodos de registro (últimas 4 semanas)", filters: WIDGET_FILTERS },
          { id: "asistencia-desglose", label: "Asistencia Diaria y Desglose Operativo", endpoint: "/widget/asistencia-desglose", filters: WIDGET_FILTERS },
          { id: "area-overtime", label: "Análisis de Horas Extras (Sobrecostos de Nómina)", endpoint: "/widget/area-overtime", filters: WIDGET_FILTERS },
          { id: "monitoreo-hardware", label: "Monitoreo de Hardware (Lectores Biométricos)", endpoint: "/widget/monitoreo-hardware", filters: WIDGET_FILTERS },
          { id: "fugas-tiempo-combinadas", label: "Fugas de Tiempo Combinadas por Sucursal", endpoint: "/widget/fugas-tiempo-combinadas", filters: WIDGET_FILTERS }
        ],
        global_filters: {},
      },
    });
  });

  return router;
}

module.exports = { createDashboardRouter };
