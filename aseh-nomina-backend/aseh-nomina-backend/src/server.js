require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

const app = express();

// ============================================================
// CONFIGURACIÓN DE PROXY DE SALIDA (FIXIE / QUOTAGUARD / CUSTOM)
// ============================================================
const PROXY_URL = process.env.FIXIE_URL || process.env.QUOTAGUARDSTATIC_URL || process.env.PROXY_URL;
const proxyAgent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : null;

if (proxyAgent) {
    console.log(" Proxy configurado correctamente para peticiones a la ASEH.");
} else {
    console.log(" Sin proxy configurado. Las peticiones saldrán directamente (Entorno Local/Sin Proxy).");
}

// Lista de orígenes permitidos
const allowedOrigins = [
  'https://dgn-sc.github.io',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://dgn-sc.onrender.com'  
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));

// ============================================================
// CONFIGURACIÓN
// ============================================================

const PORT = Number(process.env.PORT || 3000);

const FRONTEND_ORIGINS = (
    process.env.FRONTEND_ORIGIN ||
    "http://127.0.0.1:5500"
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const clientId = process.env.clientId;
const clientSecret = process.env.clientSecret;

const ASEH_TOKEN_URL =
    process.env.ASEH_TOKEN_URL ||
    "https://webapp.aseh.gob.mx/api.nomina.sc/api/auth/token";

const ASEH_NOMINA_URL =
    process.env.ASEH_NOMINA_URL ||
    "https://webapp.aseh.gob.mx/api.nomina.sc/api/nomina/consulta";

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    "CAMBIAR_ESTO_EN_PRODUCCION";

const COOKIE_SECURE =
    String(process.env.COOKIE_SECURE).toLowerCase() === "true";

// ============================================================
// PROXY HTTPS
// ============================================================

if (COOKIE_SECURE) {
    app.set("trust proxy", 1);
}

// ============================================================
// JSON
// ============================================================

app.use(
    express.json({
        limit: "100kb"
    })
);

// ============================================================
// SESIONES
// ============================================================

app.use(
    session({
        name: "aseh.sid",
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: COOKIE_SECURE,
            sameSite: COOKIE_SECURE ? "none" : "lax",
            maxAge: 8 * 60 * 60 * 1000
        }
    })
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/api/health",
    (req, res) => {
        return res.json({
            ok: true,
            servicio: "aseh-nomina-backend",
            proxyActivo: Boolean(proxyAgent)
        });
    }
);

// ============================================================
// OBTENER TOKEN ASEH
// ============================================================

app.post(
    "/api/auth/login",
    async (req, res) => {

        const clientId = process.env.clientId;
        const clientSecret = process.env.clientSecret;

        if (!clientId || !clientSecret) {
            return res.status(500).json({
                ok: false,
                message: "Las credenciales ASEH no están configuradas en el servidor."
            });
        }

        try {
            console.log("");
            console.log("======================================");
            console.log("SOLICITUD DE TOKEN ASEH");
            console.log("======================================");
            console.log("Client ID configurado:", clientId);
            console.log("Conectando con ASEH...");

            // Configuración de la petición Axios
            const axiosConfig = {
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                timeout: 30000
            };

            // Inyectar agente proxy si existe
            if (proxyAgent) {
                axiosConfig.httpsAgent = proxyAgent;
            }

            const response = await axios.post(
                ASEH_TOKEN_URL,
                {
                    clientId,
                    clientSecret
                },
                axiosConfig
            );

            const data = response.data || {};
            console.log("Respuesta recibida desde ASEH");

            const token = data.access_token || data.accessToken || data.token;

            if (!token) {
                console.error("ASEH respondió pero no devolvió access_token:", data);
                return res.status(502).json({
                    ok: false,
                    message: "La API ASEH respondió, pero no devolvió el token."
                });
            }

            const expiresIn = Number(data.expires_in || data.expiresIn || 28800);

            req.session.aseh = {
                token,
                expiresAt: Date.now() + expiresIn * 1000,
                clientId
            };

            console.log("TOKEN ASEH OBTENIDO CORRECTAMENTE");
            console.log("Expira en:", expiresIn, "segundos");

            req.session.save((error) => {
                if (error) {
                    console.error("Error guardando sesión:", error);
                    return res.status(500).json({
                        ok: false,
                        message: "El token se obtuvo, pero no fue posible guardar la sesión."
                    });
                }

                console.log("Sesión ASEH guardada correctamente.");
                return res.json({
                    ok: true,
                    token: token,
                    message: "Conexión con ASEH establecida correctamente.",
                    expiresIn: expiresIn
                });
            });

        } catch (error) {
            console.error("");
            console.error("==========================================");
            console.error("ERROR CONECTANDO CON ASEH");
            console.error("==========================================");
            console.error("Status:", error.response?.status);
            console.error("Respuesta ASEH:", error.response?.data || error.message);

            if (error.response) {
                const status = error.response.status;
                return res.status(status >= 400 ? status : 502).json({
                    ok: false,
                    message: error.response.data?.message || "La API ASEH rechazó la solicitud.",
                    detalle: error.response.data || null
                });
            }

            return res.status(502).json({
                ok: false,
                message: "No fue posible comunicarse con la API ASEH.",
                detalle: error.message
            });
        }
    }
);

// ============================================================
// ESTADO DE SESIÓN
// ============================================================

app.get(
    "/api/auth/status",
    (req, res) => {
        const auth = req.session.aseh;

        if (!auth || !auth.token) {
            return res.json({ authenticated: false });
        }

        if (auth.expiresAt && Date.now() >= auth.expiresAt) {
            req.session.destroy(() => {});
            return res.json({ authenticated: false });
        }

        return res.json({
            authenticated: true,
            clientId: auth.clientId
        });
    }
);

// ============================================================
// LOGOUT
// ============================================================

app.post(
    "/api/auth/logout",
    (req, res) => {
        req.session.destroy((error) => {
            if (error) {
                console.error("Error cerrando sesión:", error);
                return res.status(500).json({
                    ok: false,
                    message: "No fue posible cerrar la sesión."
                });
            }

            res.clearCookie("aseh.sid");
            return res.json({
                ok: true,
                message: "Sesión cerrada."
            });
        });
    }
);

// ============================================================
// CONSULTA DE NÓMINA
// ============================================================

app.post(
    "/api/nomina/consulta",
    async (req, res) => {
        console.log("");
        console.log("======================================");
        console.log("CONSULTA DE NÓMINA");
        console.log("======================================");

        const auth = req.session.aseh;

        if (!auth || !auth.token) {
            return res.status(401).json({
                ok: false,
                message: "No hay una sesión autenticada. Obtenga primero el token."
            });
        }

        if (auth.expiresAt && Date.now() >= auth.expiresAt) {
            req.session.destroy(() => {});
            return res.status(401).json({
                ok: false,
                message: "El token ASEH ha expirado. Obtenga un nuevo token."
            });
        }

        const { ejercicio, trimestre, rfc } = req.body || {};

        if (!ejercicio || !trimestre || !rfc) {
            return res.status(400).json({
                ok: false,
                message: "Los campos ejercicio, trimestre y rfc son obligatorios."
            });
        }

        const body = {
            ejercicio: Number(ejercicio),
            trimestre: String(trimestre),
            rfc: String(rfc).trim().toUpperCase()
        };

        try {
            const axiosConfig = {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                timeout: 120000
            };

            // Inyectar agente proxy si existe
            if (proxyAgent) {
                axiosConfig.httpsAgent = proxyAgent;
            }

            const response = await axios.post(ASEH_NOMINA_URL, body, axiosConfig);

            console.log("ASEH respondió correctamente.");
            return res.json(response.data);

        } catch (error) {
            console.error("Error ASEH /nomina/consulta:");
            console.error("Status:", error.response?.status);
            console.error("Respuesta:", error.response?.data || error.message);

            if (error.response) {
                const status = error.response.status;

                if (status === 401 || status === 403) {
                    req.session.destroy(() => {});
                    return res.status(401).json({
                        ok: false,
                        message: "El token ASEH ya no es válido. Obtenga un nuevo token."
                    });
                }

                return res.status(status >= 400 ? status : 502).json({
                    ok: false,
                    message: "Error devuelto por la API de ASEH.",
                    detalle: error.response.data || null
                });
            }

            return res.status(502).json({
                ok: false,
                message: "No fue posible comunicarse con la API ASEH."
            });
        }
    }
);

// ============================================================
// MANEJADOR GLOBAL DE ERRORES
// ============================================================

app.use((error, req, res, next) => {
    if (error?.message?.startsWith("Origen no permitido por CORS:")) {
        return res.status(403).json({
            ok: false,
            message: error.message
        });
    }

    console.error("Error no controlado:", error);
    return res.status(500).json({
        ok: false,
        message: "Error interno del servidor."
    });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================

app.listen(PORT, async () => {
    console.log("");
    console.log("==============================================");
    console.log("   BACKEND SISTEMA DE NÓMINA ASEH");
    console.log("==============================================");
    console.log(`  Puerto: ${PORT}`);
    console.log(`  Token ASEH: ${ASEH_TOKEN_URL}`);
    console.log("==============================================");

    // Diagnóstico de IP pública de salida
    try {
        const axiosConfig = proxyAgent ? { httpsAgent: proxyAgent } : {};
        const ipRes = await axios.get("https://api.ipify.org?format=json", axiosConfig);
        console.log(`  IP Pública de Salida Backend: ${ipRes.data.ip}`);
    } catch (e) {
        console.log("  No se pudo obtener la IP de salida.");
    }
    console.log("==============================================");
    console.log("");
});