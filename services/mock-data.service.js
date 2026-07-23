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

const BRANCHES = [
  { code: "01", label: "Oficina Central" },
  { code: "02", label: "Sede Norte" },
  { code: "03", label: "Sede Sur" },
  { code: "04", label: "Aeropuerto" },
  { code: "05", label: "Centro Comercial" },
];

const MOCK_EMPLOYEES = [
  { id: "UA1", name: "Cajero Uno Aero" },
  { id: "DA2", name: "Cajero Dos Aero" },
  { id: "TA3", name: "Cajero Tres Aero" },
  { id: "BA1", name: "Barista Uno Aero" },
  { id: "BD2", name: "Barista Dos Aero" },
  { id: "BT3", name: "Barista Tres Aero" },
  { id: "EU1", name: "Entrega Uno Aero" },
  { id: "ED2", name: "Entrega Dos Aero" },
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
  "HEDM", "HO", "DPA", "NDPA", "DED", "HE23", "HEFD", "HE25", "HEFN", "HOSM", "RNSM",
  "AHED", "HENM", "HEA", "HDDC", "RFC", "EAOU", "HT", "HE24", "HED2", "HDNC", "HEDF",
  "RN", "HDD", "HDN", "HFD", "HFN", "HED", "HEN", "HEDD", "HEDN", "AHEN", "HENF",
  "LATE", "LUNC", "EDNC", "EDDC", "HENS", "RNF", "HEDT", "EHE", "ET", "RFF",
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

  hourCols.HO = rndH(6, 9);
  hourCols.HT = rndH(0.5, 2);
  hourCols.LUNC = rndH(0.5, 1);

  return {
    person_id_ALIAS_3: emp.id,
    person_id_ALIAS_2: emp.name,
    date_arr: date,
    time_arr: rndTime(arrHour),
    time_left: rndTime(arrHour + workedH),
    worked_hours: `${workedH}.00`,
    ...hourCols,
    GC_NOVEDADES: MOCK_NOVEDADES[Math.floor(Math.random() * MOCK_NOVEDADES.length)],
  };
}

function buildPayrollRows(days = 3) {
  const allRows = [];
  for (let d = 0; d < days; d += 1) {
    const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    for (const emp of MOCK_EMPLOYEES) {
      allRows.push(generateMockRow(emp, date));
    }
  }
  return allRows;
}

module.exports = {
  WIDGET_FILTERS,
  BRANCHES,
  MOCK_EMPLOYEES,
  MOCK_HOUR_COLS,
  buildPayrollRows,
};
