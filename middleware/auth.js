const jwt = require("jsonwebtoken");

const JWT_SECRET = "cari-local-dev-secret-2024";

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Token invalido o expirado" });
  }
}

module.exports = {
  JWT_SECRET,
  requireAuth,
};
