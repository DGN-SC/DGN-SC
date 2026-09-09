const API_CONFIG = {
    BASE_URL: "http://127.0.0.1:3000",

    LOGIN_URL: "http://127.0.0.1:3000/api/auth/login",

    STATUS_URL: "http://127.0.0.1:3000/api/auth/status",

    NOMINA_URL: "http://127.0.0.1:3000/api/nomina/consulta",

    LOGOUT_URL: "http://127.0.0.1:3000/api/auth/logout"
};


/**
 * OBTENER TOKEN
 *
 * El usuario NO manda clientId ni clientSecret.
 * El backend los obtiene desde .env
 */
async function obtenerToken() {

    console.log("API.JS: iniciando solicitud para obtener token");

    try {

        const respuesta = await axios.post(
            API_CONFIG.LOGIN_URL,
            {},
            {
                withCredentials: true,

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                timeout: 40000
            }
        );

        console.log(
            "API.JS: respuesta del backend:",
            respuesta.data
        );


        if (!respuesta.data?.ok) {

            throw new Error(
                respuesta.data?.message ||
                "El backend no pudo obtener el token."
            );
        }


        return respuesta.data;

    } catch (error) {

        console.error(
            "API.JS: ERROR OBTENIENDO TOKEN",
            error
        );


        if (error.response) {

            console.error(
                "Status:",
                error.response.status
            );

            console.error(
                "Respuesta:",
                error.response.data
            );


            throw new Error(
                error.response.data?.message ||
                "El servidor rechazó la solicitud."
            );
        }


        if (error.request) {

            throw new Error(
                "No se recibió respuesta del backend Node.js. Verifique que esté ejecutándose en el puerto 3000."
            );
        }


        throw new Error(
            error.message ||
            "No fue posible obtener el token."
        );
    }
}



/**
 * VERIFICAR SESIÓN
 */
async function verificarToken() {

    try {

        const respuesta = await axios.get(
            API_CONFIG.STATUS_URL,
            {
                withCredentials: true,

                timeout: 10000
            }
        );


        return respuesta.data?.authenticated === true;

    } catch (error) {

        console.error(
            "API.JS: error verificando sesión:",
            error
        );

        return false;
    }
}



/**
 * CONSULTAR NÓMINA
 */
async function consultarNomina(parametros) {

    console.log(
        "API.JS: enviando consulta:",
        parametros
    );


    try {

        const cuerpo = {

            ejercicio: Number(
                parametros.ejercicio
            ),

            trimestre: String(
                parametros.trimestre
            ),

            rfc: String(
                parametros.rfc || ""
            )
                .trim()
                .toUpperCase()
        };


        console.log(
            "API.JS: cuerpo enviado:",
            cuerpo
        );


        const respuesta = await axios.post(

            API_CONFIG.NOMINA_URL,

            cuerpo,

            {
                withCredentials: true,

                headers: {

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"
                },

                timeout: 120000
            }
        );


        console.log(
            "API.JS: respuesta consulta:",
            respuesta.data
        );


        return respuesta.data;


    } catch (error) {

        console.error(
            "API.JS: ERROR EN CONSULTA:",
            error
        );


        if (error.response) {

            console.error(
                "Status:",
                error.response.status
            );

            console.error(
                "Respuesta:",
                error.response.data
            );


            throw new Error(

                error.response.data?.message ||

                "La API ASEH rechazó la consulta."

            );
        }


        if (error.request) {

            throw new Error(
                "No se recibió respuesta del backend Node.js."
            );
        }


        throw new Error(
            error.message ||
            "No fue posible realizar la consulta."
        );
    }
}



/**
 * CERRAR SESIÓN
 */
async function limpiarSesion() {

    try {

        await axios.post(

            API_CONFIG.LOGOUT_URL,

            {},

            {
                withCredentials: true
            }
        );


        console.log(
            "API.JS: sesión cerrada correctamente"
        );


    } catch (error) {

        console.error(
            "API.JS: error cerrando sesión:",
            error
        );
    }
}



/**
 * EXPONER FUNCIONES
 */
window.API = {

    obtenerToken,

    verificarToken,

    consultarNomina,

    limpiarSesion

};