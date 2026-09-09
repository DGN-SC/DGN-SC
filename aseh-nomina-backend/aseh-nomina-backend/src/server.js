require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const axios = require("axios");

const app = express();


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
// CORS
// ============================================================

app.use(
    cors({

        origin(origin, callback) {

            // Permitir herramientas como Postman/curl
            // que no envían Origin.
            if (!origin) {
                return callback(null, true);
            }


            if (FRONTEND_ORIGINS.includes(origin)) {
                return callback(null, true);
            }


            return callback(
                new Error(
                    `Origen no permitido por CORS: ${origin}`
                )
            );
        },


        credentials: true,


        methods: [
            "GET",
            "POST",
            "OPTIONS"
        ],


        allowedHeaders: [
            "Content-Type",
            "Accept"
        ]

    })
);


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

            sameSite:
                COOKIE_SECURE
                    ? "none"
                    : "lax",

            maxAge:
                8 * 60 * 60 * 1000

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

            servicio:
                "aseh-nomina-backend"

        });

    }
);


// ============================================================
// OBTENER TOKEN ASEH
// ============================================================
//
// IMPORTANTE:
//
// Esta ruta NO depende de login.html.
//
// consulta.html llama a esta ruta cuando el usuario
// presiona "Obtener token".
//
// clientId y clientSecret salen del .env.
//
// ============================================================

app.post(
    "/api/auth/login",
    async (req, res) => {

        // ----------------------------------------------------
        // CREDENCIALES DESDE .ENV
        // ----------------------------------------------------

        const clientId =
            process.env.clientId;


        const clientSecret =
            process.env.clientSecret;


        if (
            !clientId ||
            !clientSecret
        ) {

            return res.status(500).json({

                ok: false,

                message:
                    "Las credenciales ASEH no están configuradas en el servidor."

            });

        }


        try {

            console.log("");
            console.log("======================================");
            console.log("SOLICITUD DE TOKEN ASEH");
            console.log("======================================");

            console.log(
                "Client ID configurado:",
                clientId
            );

            console.log(
                "Conectando con ASEH..."
            );


            // ------------------------------------------------
            // SOLICITUD A ASEH
            // ------------------------------------------------

            const response =
                await axios.post(

                    ASEH_TOKEN_URL,

                    {

                        clientId,
                        clientSecret

                    },

                    {

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"

                        },

                        timeout: 30000

                    }

                );


            const data =
                response.data || {};


            console.log(
                "Respuesta recibida desde ASEH"
            );


            // ------------------------------------------------
            // OBTENER TOKEN
            // ------------------------------------------------

            const token =

                data.access_token ||

                data.accessToken ||

                data.token;


            if (!token) {

                console.error(
                    "ASEH respondió pero no devolvió access_token:",
                    data
                );


                return res.status(502).json({

                    ok: false,

                    message:
                        "La API ASEH respondió, pero no devolvió el token."

                });

            }


            // ------------------------------------------------
            // TIEMPO DE EXPIRACIÓN
            // ------------------------------------------------

            const expiresIn =
                Number(

                    data.expires_in ||

                    data.expiresIn ||

                    28800

                );


            // ------------------------------------------------
            // GUARDAR TOKEN EN SESIÓN
            // ------------------------------------------------

            req.session.aseh = {

                token,

                expiresAt:
                    Date.now() +
                    expiresIn * 1000,

                clientId

            };


            console.log(
                "TOKEN ASEH OBTENIDO CORRECTAMENTE"
            );

            console.log(
                "Expira en:",
                expiresIn,
                "segundos"
            );


            // ------------------------------------------------
            // GUARDAR SESIÓN ANTES DE RESPONDER
            // ------------------------------------------------

            req.session.save(
                (error) => {

                    if (error) {

                        console.error(
                            "Error guardando sesión:",
                            error
                        );


                        return res.status(500).json({

                            ok: false,

                            message:
                                "El token se obtuvo, pero no fue posible guardar la sesión."

                        });

                    }


                    // ----------------------------------------
                    // RESPUESTA AL FRONTEND
                    // ----------------------------------------

                    console.log(
                        "Sesión ASEH guardada correctamente."
                    );


                    return res.json({

                        ok: true,

                        token: token,

                        message:
                            "Conexión con ASEH establecida correctamente.",

                        expiresIn:
                            expiresIn

                    });

                }
            );


        } catch (error) {

            console.error("");

            console.error(
                "ERROR CONECTANDO CON ASEH:"
            );

            console.error(
                "Status:",
                error.response?.status
            );

            console.error(
                "Respuesta:",
                error.response?.data ||
                error.message
            );


            if (error.response) {

                const status =
                    error.response.status;


                return res.status(
                    status >= 400
                        ? status
                        : 502
                ).json({

                    ok: false,

                    message:
                        error.response.data?.message ||
                        "La API ASEH rechazó la solicitud.",

                    detalle:
                        error.response.data ||
                        null

                });

            }


            return res.status(502).json({

                ok: false,

                message:
                    "No fue posible comunicarse con la API ASEH.",

                detalle:
                    error.message

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

        const auth =
            req.session.aseh;


        // ----------------------------------------------------
        // NO EXISTE SESIÓN
        // ----------------------------------------------------

        if (
            !auth ||
            !auth.token
        ) {

            return res.json({

                authenticated: false

            });

        }


        // ----------------------------------------------------
        // TOKEN EXPIRADO
        // ----------------------------------------------------

        if (
            auth.expiresAt &&
            Date.now() >= auth.expiresAt
        ) {

            req.session.destroy(
                () => {}
            );


            return res.json({

                authenticated: false

            });

        }


        // ----------------------------------------------------
        // SESIÓN VÁLIDA
        // ----------------------------------------------------

        return res.json({

            authenticated: true,

            clientId:
                auth.clientId

        });

    }
);


// ============================================================
// LOGOUT
// ============================================================

app.post(
    "/api/auth/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    console.error(
                        "Error cerrando sesión:",
                        error
                    );


                    return res.status(500).json({

                        ok: false,

                        message:
                            "No fue posible cerrar la sesión."

                    });

                }


                res.clearCookie(
                    "aseh.sid"
                );


                return res.json({

                    ok: true,

                    message:
                        "Sesión cerrada."

                });

            }
        );

    }
);


// ============================================================
// CONSULTA DE NÓMINA
// ============================================================
//
// El frontend manda:
//
// {
//     ejercicio: 2025,
//     trimestre: "04",
//     rfc: "EOPJ750127KJ7"
// }
//
// El frontend NO manda Bearer token.
//
// El backend toma el token de:
//
// req.session.aseh.token
//
// y lo agrega a la petición hacia ASEH.
// ============================================================

app.post(
    "/api/nomina/consulta",
    async (req, res) => {

        console.log("");
        console.log("======================================");
        console.log("CONSULTA DE NÓMINA");
        console.log("======================================");


        // ----------------------------------------------------
        // OBTENER SESIÓN
        // ----------------------------------------------------

        const auth =
            req.session.aseh;


        // ----------------------------------------------------
        // COMPROBAR TOKEN
        // ----------------------------------------------------

        if (
            !auth ||
            !auth.token
        ) {

            console.log(
                "No existe token en la sesión."
            );


            return res.status(401).json({

                ok: false,

                message:
                    "No hay una sesión autenticada. Obtenga primero el token."

            });

        }


        // ----------------------------------------------------
        // COMPROBAR EXPIRACIÓN
        // ----------------------------------------------------

        if (
            auth.expiresAt &&
            Date.now() >= auth.expiresAt
        ) {

            console.log(
                "El token ASEH ha expirado."
            );


            req.session.destroy(
                () => {}
            );


            return res.status(401).json({

                ok: false,

                message:
                    "El token ASEH ha expirado. Obtenga un nuevo token."

            });

        }


        // ----------------------------------------------------
        // RECIBIR PARÁMETROS
        // ----------------------------------------------------

        const {

            ejercicio,

            trimestre,

            rfc

        } = req.body || {};


        console.log(
            "Ejercicio recibido:",
            ejercicio
        );

        console.log(
            "Trimestre recibido:",
            trimestre
        );

        console.log(
            "RFC recibido:",
            rfc
        );


        // ----------------------------------------------------
        // VALIDAR EJERCICIO
        // ----------------------------------------------------

        if (!ejercicio) {

            return res.status(400).json({

                ok: false,

                message:
                    "El ejercicio fiscal es obligatorio."

            });

        }


        // ----------------------------------------------------
        // VALIDAR TRIMESTRE
        // ----------------------------------------------------

        if (!trimestre) {

            return res.status(400).json({

                ok: false,

                message:
                    "El trimestre es obligatorio."

            });

        }


        // ----------------------------------------------------
        // VALIDAR RFC
        // ----------------------------------------------------

        if (!rfc) {

            return res.status(400).json({

                ok: false,

                message:
                    "El RFC es obligatorio."

            });

        }


        // ----------------------------------------------------
        // PREPARAR PETICIÓN ASEH
        // ----------------------------------------------------

        const body = {

            ejercicio:
                Number(ejercicio),

            trimestre:
                String(trimestre),

            rfc:
                String(rfc)
                    .trim()
                    .toUpperCase()

        };


        console.log(
            "Enviando a ASEH:"
        );

        console.log(
            JSON.stringify(
                body,
                null,
                2
            )
        );


        try {

            // ------------------------------------------------
            // PETICIÓN A ASEH
            // ------------------------------------------------

            const response =
                await axios.post(

                    ASEH_NOMINA_URL,

                    body,

                    {

                        headers: {

                            Authorization:
                                `Bearer ${auth.token}`,

                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"

                        },

                        timeout: 120000

                    }

                );


            console.log(
                "ASEH respondió correctamente."
            );


            console.log(
                "Respuesta ASEH:",
                response.data
            );


            // ------------------------------------------------
            // DEVOLVER RESPUESTA AL FRONTEND
            // ------------------------------------------------

            return res.json(
                response.data
            );


        } catch (error) {

            console.error(
                "Error ASEH /nomina/consulta:"
            );

            console.error(
                "Status:",
                error.response?.status
            );

            console.error(
                "Respuesta:",
                error.response?.data ||
                error.message
            );


            // ----------------------------------------------
            // TOKEN INVÁLIDO / EXPIRADO
            // ----------------------------------------------

            if (error.response) {

                const status =
                    error.response.status;


                if (
                    status === 401 ||
                    status === 403
                ) {

                    req.session.destroy(
                        () => {}
                    );


                    return res.status(401).json({

                        ok: false,

                        message:
                            "El token ASEH ya no es válido. Obtenga un nuevo token."

                    });

                }


                // ------------------------------------------
                // PARÁMETROS INVÁLIDOS
                // ------------------------------------------

                if (status === 400) {

                    return res.status(400).json({

                        ok: false,

                        message:
                            "Los parámetros enviados no son válidos.",

                        detalle:
                            error.response.data ||
                            null

                    });

                }


                // ------------------------------------------
                // OTRO ERROR ASEH
                // ------------------------------------------

                return res.status(502).json({

                    ok: false,

                    message:
                        "La API ASEH respondió con un error.",

                    upstreamStatus:
                        status,

                    detalle:
                        error.response.data ||
                        null

                });

            }


            // ----------------------------------------------
            // ASEH NO RESPONDIÓ
            // ----------------------------------------------

            return res.status(502).json({

                ok: false,

                message:
                    "No fue posible comunicarse con la API ASEH."

            });

        }

    }
);


// ============================================================
// MANEJADOR GLOBAL DE ERRORES
// ============================================================

app.use(
    (error, req, res, next) => {

        if (
            error?.message?.startsWith(
                "Origen no permitido por CORS:"
            )
        ) {

            return res.status(403).json({

                ok: false,

                message:
                    error.message

            });

        }


        console.error(
            "Error no controlado:",
            error
        );


        return res.status(500).json({

            ok: false,

            message:
                "Error interno del servidor."

        });

    }
);


// ============================================================
// INICIAR SERVIDOR
// ============================================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "=============================================="
        );

        console.log(
            "  BACKEND SISTEMA DE NÓMINA ASEH"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `  Puerto: ${PORT}`
        );

        console.log(
            `  Frontend permitido: ${FRONTEND_ORIGINS.join(", ")}`
        );

        console.log(
            `  Token ASEH: ${ASEH_TOKEN_URL}`
        );

        console.log(
            `  Nómina ASEH: ${ASEH_NOMINA_URL}`
        );

        console.log(
            "=============================================="
        );

        console.log("");

    }
);





//======================================================================
/*nuevo
========================================================================*/




// ============================================================
// BACKEND SISTEMA DE CONSULTA DE NÓMINA ASEH
// ============================================================
/*
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const axios = require("axios");

const app = express();


// ============================================================
// CONFIGURACIÓN
// ============================================================

const PORT = Number(process.env.PORT || 3000);

const FRONTEND_ORIGIN =
    process.env.FRONTEND_ORIGIN ||
    "http://127.0.0.1:5500";

const ASEH_TOKEN_URL =
    process.env.ASEH_TOKEN_URL ||
    "https://webapp.aseh.gob.mx/api.nomina.sc/api/auth/token";

const ASEH_NOMINA_URL =
    process.env.ASEH_NOMINA_URL ||
    "https://webapp.aseh.gob.mx/api.nomina.sc/api/nomina/consulta";

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    "CAMBIAR_SECRETO";

const COOKIE_SECURE =
    String(process.env.COOKIE_SECURE).toLowerCase() === "true";


// ============================================================
// CREDENCIALES ASEH
// ============================================================

const clientId = process.env.clientId;
const clientSecret = process.env.clientSecret;


// ============================================================
// CONFIGURACIÓN DE EXPRESS
// ============================================================

if (COOKIE_SECURE) {
    app.set("trust proxy", 1);
}


// ============================================================
// CORS
// ============================================================

app.use(
    cors({
        origin: FRONTEND_ORIGIN,
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Accept"
        ]
    })
);


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

            sameSite:
                COOKIE_SECURE
                    ? "none"
                    : "lax",

            maxAge:
                8 * 60 * 60 * 1000
        }
    })
);


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            ok: true,
            servicio: "aseh-nomina-backend"
        });

    }
);


// ============================================================
// OBTENER TOKEN
// ============================================================

app.post(
    "/api/auth/login",
    async (req, res) => {

        console.log("");
        console.log("==========================================");
        console.log("SOLICITUD DE TOKEN ASEH");
        console.log("==========================================");


        // ------------------------------------------------------
        // COMPROBAR CREDENCIALES
        // ------------------------------------------------------

        if (!clientId || !clientSecret) {

            console.error(
                "ERROR: Las credenciales ASEH no están configuradas."
            );

            return res.status(500).json({

                ok: false,

                message:
                    "Las credenciales ASEH no están configuradas en el servidor."

            });

        }


        console.log(
            "Client ID configurado:",
            clientId
        );

        console.log(
            "Conectando con ASEH..."
        );


        try {

            // --------------------------------------------------
            // PETICIÓN A ASEH
            // --------------------------------------------------

            const respuesta = await axios.post(

                ASEH_TOKEN_URL,

                {
                    clientId: clientId,
                    clientSecret: clientSecret
                },

                {
                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"

                    },

                    timeout: 30000

                }

            );


            console.log(
                "ASEH respondió correctamente."
            );


            const data =
                respuesta.data || {};


            console.log(
                "Respuesta recibida desde ASEH."
            );


            // --------------------------------------------------
            // EXTRAER TOKEN
            // --------------------------------------------------

            const token =
                data.access_token ||
                data.accessToken ||
                data.token;


            if (!token) {

                console.error(
                    "ASEH no devolvió token:",
                    data
                );


                return res.status(502).json({

                    ok: false,

                    message:
                        "La API ASEH respondió, pero no devolvió el token."

                });

            }


            // --------------------------------------------------
            // EXPIRACIÓN
            // --------------------------------------------------

            const expiresIn =
                Number(
                    data.expires_in ||
                    data.expiresIn ||
                    28800
                );


            // --------------------------------------------------
            // GUARDAR TOKEN EN SESIÓN
            // --------------------------------------------------

            req.session.aseh = {

                token: token,

                expiresAt:
                    Date.now() +
                    expiresIn * 1000,

                clientId: clientId

            };


            // --------------------------------------------------
            // GUARDAR SESIÓN
            // --------------------------------------------------

            req.session.save(
                (error) => {

                    if (error) {

                        console.error(
                            "ERROR GUARDANDO SESIÓN:",
                            error
                        );

                        return res.status(500).json({

                            ok: false,

                            message:
                                "El token se obtuvo, pero no fue posible guardar la sesión."

                        });

                    }


                    console.log(
                        "TOKEN ASEH OBTENIDO CORRECTAMENTE."
                    );


                    console.log(
                        "Sesión guardada correctamente."
                    );


                    // ------------------------------------------------
                    // RESPUESTA AL FRONTEND
                    // ------------------------------------------------

                    return res.json({

                        ok: true,

                        token: token,

                        message:
                            "Conexión con ASEH establecida correctamente.",

                        expiresIn:
                            expiresIn

                    });

                }
            );


        } catch (error) {

            console.error("");
            console.error(
                "=========================================="
            );
            console.error(
                "ERROR CONECTANDO CON ASEH"
            );
            console.error(
                "=========================================="
            );


            console.error(
                "Status:",
                error.response?.status
            );


            console.error(
                "Respuesta ASEH:",
                error.response?.data ||
                error.message
            );


            // --------------------------------------------------
            // ERROR DE ASEH
            // --------------------------------------------------

            if (error.response) {

                const status =
                    error.response.status;


                return res.status(
                    status >= 400
                        ? status
                        : 502
                ).json({

                    ok: false,

                    message:
                        error.response.data?.message ||
                        "La API ASEH rechazó la solicitud.",

                    detalle:
                        error.response.data ||
                        null

                });

            }


            // --------------------------------------------------
            // ERROR DE CONEXIÓN
            // --------------------------------------------------

            return res.status(502).json({

                ok: false,

                message:
                    "No fue posible comunicarse con la API ASEH.",

                detalle:
                    error.message

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

        const auth =
            req.session.aseh;


        if (!auth || !auth.token) {

            return res.json({

                authenticated: false

            });

        }


        if (
            auth.expiresAt &&
            Date.now() >= auth.expiresAt
        ) {

            req.session.destroy(
                () => {}
            );


            return res.json({

                authenticated: false

            });

        }


        return res.json({

            authenticated: true,

            clientId:
                auth.clientId

        });

    }
);


// ============================================================
// CERRAR SESIÓN
// ============================================================

app.post(
    "/api/auth/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    console.error(
                        "Error cerrando sesión:",
                        error
                    );

                    return res.status(500).json({

                        ok: false,

                        message:
                            "No fue posible cerrar la sesión."

                    });

                }


                res.clearCookie(
                    "aseh.sid"
                );


                return res.json({

                    ok: true,

                    message:
                        "Sesión cerrada."

                });

            }
        );

    }
);


// ============================================================
// CONSULTA DE NÓMINA
// ============================================================

app.post(
    "/api/nomina/consulta",
    async (req, res) => {

        const auth =
            req.session.aseh;


        // ------------------------------------------------------
        // COMPROBAR SESIÓN
        // ------------------------------------------------------

        if (!auth || !auth.token) {

            return res.status(401).json({

                ok: false,

                message:
                    "No hay una sesión autenticada."

            });

        }


        // ------------------------------------------------------
        // COMPROBAR EXPIRACIÓN
        // ------------------------------------------------------

        if (
            auth.expiresAt &&
            Date.now() >= auth.expiresAt
        ) {

            req.session.destroy(
                () => {}
            );


            return res.status(401).json({

                ok: false,

                message:
                    "La sesión con la API ASEH ha expirado."

            });

        }


        // ------------------------------------------------------
        // RECIBIR PARÁMETROS
        // ------------------------------------------------------

        const {
            ejercicio,
            trimestre,
            rfc
        } = req.body || {};


        // ------------------------------------------------------
        // PREPARAR BODY EXACTO PARA ASEH
        // ------------------------------------------------------

        const body = {

            ejercicio:
                Number(ejercicio),

            trimestre:
                String(trimestre),

            rfc:
                String(rfc || "")
                    .trim()
                    .toUpperCase()

        };


        console.log("");
        console.log(
            "=========================================="
        );
        console.log(
            "CONSULTA DE NÓMINA"
        );
        console.log(
            "=========================================="
        );


        console.log(
            "Body enviado a ASEH:",
            body
        );


        try {

            // --------------------------------------------------
            // CONSULTAR ASEH
            // --------------------------------------------------

            const respuesta =
                await axios.post(

                    ASEH_NOMINA_URL,

                    body,

                    {

                        headers: {

                            Authorization:
                                `Bearer ${auth.token}`,

                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"

                        },

                        timeout: 120000

                    }

                );


            console.log(
                "ASEH respondió correctamente a la consulta."
            );


            return res.json(
                respuesta.data
            );


        } catch (error) {

            console.error(
                "ERROR EN CONSULTA ASEH:"
            );


            console.error(
                "Status:",
                error.response?.status
            );


            console.error(
                "Respuesta:",
                error.response?.data ||
                error.message
            );


            // --------------------------------------------------
            // TOKEN INVÁLIDO
            // --------------------------------------------------

            if (
                error.response?.status === 401 ||
                error.response?.status === 403
            ) {

                req.session.destroy(
                    () => {}
                );


                return res.status(401).json({

                    ok: false,

                    message:
                        "El token ASEH ya no es válido. Obtenga un nuevo token."

                });

            }


            // --------------------------------------------------
            // PETICIÓN INVÁLIDA
            // --------------------------------------------------

            if (
                error.response?.status === 400
            ) {

                return res.status(400).json({

                    ok: false,

                    message:
                        "Los parámetros enviados no son válidos."

                });

            }


            // --------------------------------------------------
            // OTRO ERROR DE ASEH
            // --------------------------------------------------

            if (error.response) {

                return res.status(502).json({

                    ok: false,

                    message:
                        "La API ASEH respondió con un error.",

                    upstreamStatus:
                        error.response.status

                });

            }


            // --------------------------------------------------
            // ERROR DE CONEXIÓN
            // --------------------------------------------------

            return res.status(502).json({

                ok: false,

                message:
                    "No fue posible comunicarse con la API ASEH."

            });

        }

    }
);


// ============================================================
// MANEJADOR DE ERRORES
// ============================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "ERROR NO CONTROLADO:",
            error
        );


        return res.status(500).json({

            ok: false,

            message:
                "Error interno del servidor."

        });

    }
);


// ============================================================
// INICIAR SERVIDOR
// ============================================================

app.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "=============================================="
        );
        console.log(
            "  BACKEND SISTEMA DE NÓMINA ASEH"
        );
        console.log(
            "=============================================="
        );

        console.log(
            `  Puerto: ${PORT}`
        );

        console.log(
            `  Frontend permitido: ${FRONTEND_ORIGIN}`
        );

        console.log(
            `  Token ASEH: ${ASEH_TOKEN_URL}`
        );

        console.log(
            `  Nómina ASEH: ${ASEH_NOMINA_URL}`
        );

        console.log(
            "=============================================="
        );

        console.log("");

    }
);*/