const USERS = [
  { id: "1", username: "admin@cari.com", password: "admin123", name: "Admin Local", role: "admin" },
  { id: "2", username: "user@cari.com", password: "user123", name: "Usuario Local", role: "user" },
];

const MENU_BY_ROLE = {
  admin: [
    {
      code: "dashboards",
      items: [
        { code: "dashboards.attendances", path: "/attendance" },
        { code: "dashboards.list", path: "/dashboards-list" },
      ],
    },
    {
      code: "reports",
      items: [{ code: "reports.payroll", path: "/prenomina-data" }],
    },
  ],
  user: [
    {
      code: "dashboards",
      items: [{ code: "dashboards.attendances", path: "/attendance" }],
    },
  ],
};

const PERMISSIONS_BY_ROLE = {
  admin: ["read", "write", "delete", "export"],
  user: ["read"],
};

const JWT_EXPIRES_IN = "8h";

module.exports = {
  USERS,
  MENU_BY_ROLE,
  PERMISSIONS_BY_ROLE,
  JWT_EXPIRES_IN,
};
