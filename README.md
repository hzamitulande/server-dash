# Backend de Notificaciones - cari-ui

Backend básico con **Express** + **WebSocket (ws)** para gestionar notificaciones de exportación de reportes. Los datos se persisten en un archivo JSON.

## Requisitos

- Node.js 18+

## Instalación

```bash
cd backend
npm install
```

## Ejecución

```bash
# Producción
npm start

# Desarrollo (auto-reload con --watch)
npm run dev
```

El servidor se levanta en `http://localhost:3001` por defecto.

## Estructura

```
backend/
├── data/
│   └── notifications.json   ← Datos persistidos
├── server.js                 ← Servidor Express + WebSocket
├── package.json
└── README.md
```

## Endpoints REST

### Obtener notificaciones

```
GET /notifications?page=1&pageSize=20
```

**Respuesta:**

```json
{
  "ok": true,
  "data": {
    "items": [...],
    "summary": { "total": 2, "unreadCount": 1 },
    "pagination": { "page": 1, "pageSize": 20, "total": 2, "hasNext": false }
  }
}
```

### Obtener una notificación

```
GET /notifications/:id
```

### Solicitar exportación de reporte

```
POST /reports/exports
```

**Headers opcionales:** `x-user-id: mi-usuario`  
**Query opcional:** `?userId=mi-usuario`

**Body:**

```json
{
  "format": "xlsx",
  "filters": {},
  "page": 1,
  "pageSize": 50,
  "range": { "start": "2026-03-01", "end": "2026-03-31" }
}
```

**Respuesta:**

```json
{
  "ok": true,
  "data": {
    "jobId": "job_abc12345",
    "notification": { ... }
  }
}
```

> Al hacer esta petición, el backend simula la progresión del reporte:  
> `queued` → `processing (20%)` → `processing (40%)` → ... → `completed (100%)`  
> Cada paso se envía por **WebSocket** cada 2 segundos.

### Actualizar una notificación (marcar como leída)

```
PUT /notifications/:id
```

**Body:**

```json
{
  "read": true
}
```

### Marcar todas como leídas

```
PUT /notifications-mark-all-read
```

### Eliminar una notificación

```
DELETE /notifications/:id
```

### Eliminar todas las notificaciones

```
DELETE /notifications
```

## WebSocket

### Conexión

```
ws://localhost:3001/ws?userId=mi-usuario
```

El parámetro `userId` asocia la conexión WebSocket al usuario para recibir notificaciones específicas.

### Eventos recibidos

Cuando se crea o actualiza una notificación, el backend envía:

```json
{
  "event": "notification.upsert",
  "data": {
    "notification": {
      "id": "notif_abc12345",
      "jobId": "job_abc12345",
      "kind": "report.export",
      "status": "processing",
      "progress": 40,
      "message": "Tu reporte XLSX va en 40%",
      "sequence": 3,
      ...
    }
  }
}
```

## Integración con el frontend (cari-ui)

En el hook `useReportExportNotifications`, usar estas URLs:

```ts
// Ejemplo de parámetros
{
  wsBaseUrl: "ws://localhost:3001/ws",
  buildApiUrl: () => "http://localhost:3001/reports/exports",
}
```

El componente `Notifications.tsx` no necesita cambios — recibe los datos del hook.

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT`   | `3001`  | Puerto del servidor |
