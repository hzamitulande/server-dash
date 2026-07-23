const express = require("express");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");
const { USERS, MENU_BY_ROLE, PERMISSIONS_BY_ROLE, JWT_EXPIRES_IN } = require("../services/users.service");

function createAuthRouter(requireAuth) {
  const router = express.Router();

  router.post("/login", (req, res) => {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({ message: "Credenciales requeridas" });
    }

    const user = USERS.find((item) => item.username === username && item.password === password);
    if (!user) {
      return res.status(401).json({ message: "Usuario o contrasena incorrectos" });
    }

    const token = jwt.sign(
      { sub: user.id, path: "", userContext: "/user-context" },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({ token });
  });

  router.get("/user-context", requireAuth, (req, res) => {
    const user = USERS.find((item) => item.id === req.user.sub);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.json({
      user: { id: user.id, name: user.name, role: user.role },
      menu: MENU_BY_ROLE[user.role] ?? [],
      permissions: PERMISSIONS_BY_ROLE[user.role] ?? [],
    });
  });

  return router;
}

module.exports = { createAuthRouter };
