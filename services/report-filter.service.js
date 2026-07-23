const LEAF_OPERATORS = [
  "contains", "not_contains", "starts_with", "ends_with", "eq", "neq", "in", "not_in", "is_empty", "is_not_empty",
  "gt", "gte", "lt", "lte", "between",
  "before", "after", "between_date",
];

const GROUP_OPERATORS = ["and", "or", "not"];

function getOperatorsForType(type) {
  switch (type) {
    case "string":
      return ["eq", "neq", "contains", "not_contains", "starts_with", "ends_with", "in", "not_in", "is_empty", "is_not_empty"];
    case "number":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "between", "is_empty", "is_not_empty"];
    case "date":
      return ["eq", "neq", "before", "after", "between_date", "is_empty", "is_not_empty", "today", "yesterday", "this_week", "last_week", "this_month", "last_month"];
    default:
      return ["eq", "neq", "is_empty", "is_not_empty"];
  }
}

function evalCondition(cond, row) {
  if (!cond || !cond.column || !cond.op) return true;

  const raw = row[cond.column];
  const op = cond.op;
  const val = cond.value;

  const asString = (v) => (v === null || v === undefined ? "" : String(v));
  const lower = (v) => asString(v).toLowerCase();

  switch (op) {
    case "contains":
      return lower(raw).includes(lower(val));
    case "not_contains":
      return !lower(raw).includes(lower(val));
    case "starts_with":
      return lower(raw).startsWith(lower(val));
    case "ends_with":
      return lower(raw).endsWith(lower(val));
    case "eq":
      return asString(raw) === String(val);
    case "neq":
      return asString(raw) !== String(val);
    case "in":
      return Array.isArray(val) ? val.map(String).includes(asString(raw)) : false;
    case "not_in":
      return Array.isArray(val) ? !val.map(String).includes(asString(raw)) : false;
    case "is_empty":
      return raw === null || raw === undefined || asString(raw) === "";
    case "is_not_empty":
      return !(raw === null || raw === undefined || asString(raw) === "");
    case "gt":
      return Number(raw) > Number(val);
    case "gte":
      return Number(raw) >= Number(val);
    case "lt":
      return Number(raw) < Number(val);
    case "lte":
      return Number(raw) <= Number(val);
    case "between": {
      if (!Array.isArray(val) || val.length < 2) return false;
      const a = Number(val[0]);
      const b = Number(val[1]);
      const n = Number(raw);
      if (Number.isNaN(n) || Number.isNaN(a) || Number.isNaN(b)) return false;
      return n >= Math.min(a, b) && n <= Math.max(a, b);
    }
    case "before": {
      const d = new Date(raw);
      const v = new Date(val);
      return d < v;
    }
    case "after": {
      const d = new Date(raw);
      const v = new Date(val);
      return d > v;
    }
    case "between_date": {
      if (!Array.isArray(val) || val.length < 2) return false;
      const d = new Date(raw);
      const a = new Date(val[0]);
      const b = new Date(val[1]);
      if (Number.isNaN(d.getTime()) || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
      return d >= (a < b ? a : b) && d <= (a < b ? b : a);
    }
    default:
      return false;
  }
}

function evalExpression(expr, row) {
  if (!expr) return true;

  if (expr.op && Array.isArray(expr.items)) {
    const op = String(expr.op).toLowerCase();
    if (op === "and") return expr.items.every((item) => evalExpression(item, row));
    if (op === "or") return expr.items.some((item) => evalExpression(item, row));
    if (op === "not") return !expr.items.some((item) => evalExpression(item, row));
    return expr.items.every((item) => evalExpression(item, row));
  }

  return evalCondition(expr, row);
}

function validateFilterExpression(expression) {
  const errors = [];

  const isValidDate = (value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  };

  const walk = (node, path) => {
    if (!node || typeof node !== "object") {
      errors.push(`${path}: node must be an object`);
      return;
    }

    if (node.op && Array.isArray(node.items)) {
      const op = String(node.op).toLowerCase();
      if (!GROUP_OPERATORS.includes(op)) {
        errors.push(`${path}.op: unsupported group operator '${node.op}'`);
      }
      if (!Array.isArray(node.items) || node.items.length === 0) {
        errors.push(`${path}.items: must be a non-empty array`);
      }
      if (Array.isArray(node.items)) {
        node.items.forEach((item, index) => walk(item, `${path}.items[${index}]`));
      }
      return;
    }

    if (!node.column || typeof node.column !== "string") {
      errors.push(`${path}.column: required string`);
    }
    if (!node.op || typeof node.op !== "string") {
      errors.push(`${path}.op: required string`);
      return;
    }

    const op = String(node.op);
    if (!LEAF_OPERATORS.includes(op)) {
      errors.push(`${path}.op: unsupported operator '${op}'`);
    }

    if (["contains", "not_contains", "starts_with", "ends_with"].includes(op)) {
      if (node.value === undefined || node.value === null || String(node.value).trim() === "") {
        errors.push(`${path}.value: non-empty string required for '${op}'`);
      }
    }

    if (op === "in" || op === "not_in") {
      if (!Array.isArray(node.value) || node.value.length === 0) {
        errors.push(`${path}.value: non-empty array required for '${op}'`);
      }
    }

    if (["gt", "gte", "lt", "lte"].includes(op)) {
      if (node.value === undefined || node.value === null || Number.isNaN(Number(node.value))) {
        errors.push(`${path}.value: numeric value required for '${op}'`);
      }
    }

    if (op === "between") {
      if (!Array.isArray(node.value) || node.value.length < 2 || Number.isNaN(Number(node.value[0])) || Number.isNaN(Number(node.value[1]))) {
        errors.push(`${path}.value: array of two numeric values required for 'between'`);
      }
    }

    if (["before", "after"].includes(op)) {
      if (node.value === undefined || node.value === null || !isValidDate(node.value)) {
        errors.push(`${path}.value: valid date/time required for '${op}'`);
      }
    }

    if (op === "between_date") {
      if (!Array.isArray(node.value) || node.value.length < 2 || !isValidDate(node.value[0]) || !isValidDate(node.value[1])) {
        errors.push(`${path}.value: array of two valid dates required for 'between_date'`);
      }
    }
  };

  walk(expression, "filterExpression");

  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeLegacyFilters(filters) {
  if (!filters || typeof filters !== "object") return null;

  const items = [];
  for (const key of Object.keys(filters)) {
    const entry = filters[key];
    if (!entry) continue;

    if (entry.type === "time-range" && entry.from && entry.to) {
      items.push({ column: key, op: "between_date", value: [entry.from, entry.to] });
    } else if (Array.isArray(entry.value)) {
      items.push({ column: key, op: "in", value: entry.value });
    } else if (entry.value !== undefined) {
      items.push({ column: key, op: "eq", value: entry.value });
    }
  }

  if (items.length === 0) return null;
  return { op: "and", items };
}

module.exports = {
  getOperatorsForType,
  evalExpression,
  validateFilterExpression,
  normalizeLegacyFilters,
};
