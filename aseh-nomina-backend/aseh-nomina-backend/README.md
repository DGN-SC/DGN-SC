# Backend Sistema de Nómina ASEH

Backend Node.js/Express que funciona como intermediario entre el frontend y la API REST de Nómina ASEH.

## ¿Por qué existe este backend?

La API ASEH funciona correctamente desde Postman, pero el navegador bloquea la llamada directa por CORS.

La arquitectura queda:

Frontend -> este backend -> API ASEH

El backend obtiene el Bearer Token de ASEH y lo guarda en la sesión del servidor. El frontend no necesita recibir ni almacenar el token ASEH.

## Requisitos

- Node.js 18 o superior
- npm

## Instalación

```bash
npm install
```

Copia `.env.example` como `.env`.

Windows CMD:

```cmd
copy .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux/macOS:

```bash
cp .env.example .env
```

Edita `.env` y cambia como mínimo:

```env
SESSION_SECRET=una-clave-larga-y-aleatoria
```

## Ejecutar

Desarrollo:

```bash
npm run dev
```

Producción/local:

```bash
npm start
```

El backend quedará en:

http://localhost:3000

Prueba:

http://localhost:3000/api/health

Debe responder:

```json
{
  "ok": true,
  "servicio": "aseh-nomina-backend"
}
```

## Frontend

Si el frontend continúa usando Live Server:

```text
http://127.0.0.1:5500
```

el `.env` debe tener:

```env
FRONTEND_ORIGIN=http://127.0.0.1:5500
```

Si usas `localhost`:

```env
FRONTEND_ORIGIN=http://localhost:5500
```

## Endpoints propios

### Login

POST `/api/auth/login`

Body:

```json
{
  "clientId": "SCHIDALGO",
  "clientSecret": "TU_SECRET"
}
```

### Estado

GET `/api/auth/status`

### Consulta

POST `/api/nomina/consulta`

Body:

```json
{
  "ejercicio": 2025,
  "trimestre": "01",
  "pagina": 1,
  "tamanoPagina": 100
}
```

### Logout

POST `/api/auth/logout`

## Importante sobre GitHub

GitHub puede almacenar el código, pero GitHub Pages no ejecuta este backend Node.js.

Para producción necesitarás publicar el backend en un servicio que ejecute Node.js y configurar las variables de entorno allí.

Nunca subas `.env` ni credenciales reales al repositorio.
