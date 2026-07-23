const { start } = require("./server");

console.warn("[DEPRECATED] local-server.js fue unificado en server.js. Iniciando backend unico en puerto 3001...");

start(3001);
