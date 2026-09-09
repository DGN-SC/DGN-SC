

/* nuevo
===================
nuevo
============ */
// ============================================================
// SISTEMA DE CONSULTA DE NÓMINA ASEH
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("========================================");
    console.log("APP.JS: DOM cargado correctamente");
    console.log("========================================");

    inicializarAplicacion();

});


// ============================================================
// INICIALIZAR APLICACIÓN
// ============================================================

function inicializarAplicacion() {

    const paginaActual =
        window.location.pathname
            .split("/")
            .pop();

    console.log(
        "Página actual:",
        paginaActual
    );

    if (
        paginaActual === "consulta.html" ||
        paginaActual === ""
    ) {

        inicializarConsulta();

    }

}


// ============================================================
// INICIALIZAR CONSULTA
// ============================================================

function inicializarConsulta() {

    console.log(
        "APP.JS: inicializando consulta.html"
    );

    // --------------------------------------------------------
    // ELEMENTOS
    // --------------------------------------------------------

    const btnLogin =
        document.getElementById("btnLogin");

    const btnConsultar =
        document.getElementById("btnConsultar");

    const btnLimpiar =
        document.getElementById("btnLimpiar");

    const btnCerrarSesion =
        document.getElementById("btnCerrarSesion");

    const frmConsulta =
        document.getElementById("frmConsulta");

    // --------------------------------------------------------
    // VERIFICAR ELEMENTOS
    // --------------------------------------------------------

    console.log("APP.JS: btnLogin =", btnLogin);
    console.log("APP.JS: btnConsultar =", btnConsultar);
    console.log("APP.JS: btnLimpiar =", btnLimpiar);
    console.log("APP.JS: frmConsulta =", frmConsulta);

    // --------------------------------------------------------
    // BOTÓN OBTENER TOKEN
    // --------------------------------------------------------

    if (btnLogin) {
        btnLogin.addEventListener("click", ejecutarConexion);
    }

    // --------------------------------------------------------
    // FORMULARIO CONSULTA
    // --------------------------------------------------------

    if (frmConsulta) {
        frmConsulta.addEventListener("submit", ejecutarConsulta);
    }

    // --------------------------------------------------------
    // BOTÓN LIMPIAR
    // --------------------------------------------------------

    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", limpiarFormulario);
    }

    // --------------------------------------------------------
    // CERRAR SESIÓN
    // --------------------------------------------------------

    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", cerrarSesion);
    }

    console.log("APP.JS: inicialización terminada");

}


// ============================================================
// OBTENER TOKEN
// ============================================================

async function ejecutarConexion() {

    console.log("========================================");
    console.log("APP.JS: BOTÓN OBTENER TOKEN PRESIONADO");
    console.log("========================================");

    const btnLogin = document.getElementById("btnLogin");
    const estadoToken = document.getElementById("estadoToken");
    const mensajeLogin = document.getElementById("mensajeLogin");

    try {

        // ----------------------------------------------------
        // DESHABILITAR BOTÓN
        // ----------------------------------------------------

        if (btnLogin) {
            btnLogin.disabled = true;
            btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Conectando...';
        }

        // ----------------------------------------------------
        // MENSAJE
        // ----------------------------------------------------

        if (mensajeLogin) {
            mensajeLogin.className = "alert alert-warning";
            mensajeLogin.textContent = "Conectando con ASEH...";
        }

        // ----------------------------------------------------
        // SOLICITAR TOKEN
        // ----------------------------------------------------

        console.log("APP.JS: llamando API.obtenerToken()");

        const respuesta = await API.obtenerToken();

        console.log("APP.JS: token recibido:", respuesta);

        if (!respuesta?.ok) {
            throw new Error(
                respuesta?.message || "No fue posible obtener el token."
            );
        }

        // ----------------------------------------------------
        // MOSTRAR TOKEN
        // ----------------------------------------------------

        mostrarToken(respuesta.token);

        // ----------------------------------------------------
        // ESTADO
        // ----------------------------------------------------

        if (estadoToken) {
            estadoToken.textContent = "Conectado";
            estadoToken.className = "badge bg-success";
        }

        if (mensajeLogin) {
            mensajeLogin.className = "alert alert-success";
            mensajeLogin.innerHTML = "<strong>Conexión exitosa.</strong> Token obtenido correctamente.";
        }

        // ----------------------------------------------------
        // BOTÓN
        // ----------------------------------------------------

        if (btnLogin) {
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<i class="bi bi-check-circle me-2"></i>Token obtenido';
        }

    } catch (error) {

        console.error("APP.JS: ERROR OBTENIENDO TOKEN:", error);

        if (estadoToken) {
            estadoToken.textContent = "Sin conexión";
            estadoToken.className = "badge bg-danger";
        }

        if (mensajeLogin) {
            mensajeLogin.className = "alert alert-danger";
            mensajeLogin.textContent = error.message || "No fue posible conectarse con ASEH.";
        }

        if (btnLogin) {
            btnLogin.disabled = false;
            btnLogin.innerHTML = '<i class="bi bi-key me-2"></i>Obtener token';
        }

    }

}


// ============================================================
// MOSTRAR TOKEN
// ============================================================

function mostrarToken(token) {

    console.log("APP.JS: mostrando token");

    if (!token) {
        console.warn("APP.JS: el backend no devolvió token");
        return;
    }

    let tokenElemento = document.getElementById("resultadoToken");
    let tokenOculto = document.getElementById("tokenOculto");

    if (tokenElemento) {
        tokenElemento.textContent = token;
    }

    if (tokenOculto) {
        tokenOculto.value = token;
    }

    if (!tokenElemento && !tokenOculto) {

        const contenedor = document.getElementById("mensajeLogin");

        if (contenedor) {

            const tokenBox = document.createElement("div");
            tokenBox.className = "token-container mt-3";

            tokenBox.innerHTML = `
                <label class="form-label fw-bold">Token obtenido:</label>
                <div class="token-box">
                    <input
                        type="text"
                        id="tokenOculto"
                        class="form-control"
                        value="${escapeHtml(token)}"
                        readonly
                    >
                </div>
            `;

            contenedor.parentElement.appendChild(tokenBox);

        }

    }

}


// ============================================================
// CONSULTAR NÓMINA
// ============================================================

async function ejecutarConsulta(event) {

    event.preventDefault();

    console.log("========================================");
    console.log("APP.JS: INICIANDO CONSULTA");
    console.log("========================================");

    const ejercicio = document.getElementById("txtEjercicio")?.value;
    const trimestre = document.getElementById("txtTrimestre")?.value;
    const rfc = document.getElementById("txtRFC")?.value;

    // --------------------------------------------------------
    // VALIDACIONES
    // --------------------------------------------------------

    if (!ejercicio) {
        mostrarMensaje("Debe seleccionar el ejercicio fiscal.", "warning");
        return;
    }

    if (!trimestre) {
        mostrarMensaje("Debe seleccionar el trimestre.", "warning");
        return;
    }

    if (!rfc) {
        mostrarMensaje("Debe ingresar el RFC.", "warning");
        return;
    }

    // --------------------------------------------------------
    // PREPARAR DATOS
    // --------------------------------------------------------

    const parametros = {
        ejercicio: Number(ejercicio),
        trimestre: String(trimestre),
        rfc: String(rfc).trim().toUpperCase()
    };

    console.log("APP.JS: parámetros:", parametros);

    try {

        mostrarLoader(true);

        const respuesta = await API.consultarNomina(parametros);

        console.log("APP.JS: respuesta final:", respuesta);

        mostrarResultados(respuesta);

        mostrarMensaje("Consulta realizada correctamente.", "success");

    } catch (error) {

        console.error("APP.JS: ERROR CONSULTANDO:", error);

        mostrarMensaje(
            error.message || "No fue posible realizar la consulta.",
            "danger"
        );

        mostrarResultados(null);

    } finally {

        mostrarLoader(false);

    }

}


// ============================================================
// MOSTRAR RESULTADOS
// ============================================================

function mostrarResultados(data) {

    console.log("APP.JS: procesando resultados:", data);

    const contenedor = document.getElementById("resultadosNomina");

    if (!contenedor) {
        console.warn("No existe #resultadosNomina");
        return;
    }

    contenedor.innerHTML = "";

    if (!data) {
        return;
    }

    // --------------------------------------------------------
    // DETERMINAR REGISTROS
    // --------------------------------------------------------

    let registros = [];

    if (Array.isArray(data)) {
        registros = data;
    } 
    else if (Array.isArray(data.datos)) { // Permite leer la propiedad "datos" de la respuesta ASEH
        registros = data.datos;
    } 
    else if (Array.isArray(data.data)) {
        registros = data.data;
    } 
    else if (Array.isArray(data.resultados)) {
        registros = data.resultados;
    } 
    else {
        registros = [data];
    }

    if (registros.length === 0) {
        contenedor.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-info-circle me-2"></i>
                No se encontraron registros.
            </div>
        `;
        return;
    }

    // --------------------------------------------------------
    // CREAR TARJETAS
    // --------------------------------------------------------

    registros.forEach((registro, index) => {

        console.log(`Registro ${index + 1}:`, registro);

        const tarjeta = document.createElement("div");
        tarjeta.className = "card shadow-sm mb-4";

        // Mapeo flexible de propiedades
        const ejercicio = registro.ejercicio_fiscal ?? registro.ejercicioFiscal ?? registro.ejercicio ?? registro.EJERCICIO;
        const entidad = registro.entidad ?? registro.ENTIDAD;
        const trimestre = registro.trimestre ?? registro.TRIMESTRE;
        const periodoInicio = registro.periodo_inicio ?? registro.periodoInicio ?? registro.fecha_inicio;
        const periodoFin = registro.periodo_fin ?? registro.periodoFin ?? registro.fecha_fin;
        const curp = registro.curp ?? registro.CURP;
        const nombre = registro.nombre_completo ?? registro.nombreCompleto ?? registro.nombre ?? registro.NOMBRE;
        const unidad = registro.unidad_administrativa ?? registro.unidadAdministrativa ?? registro.unidad ?? registro.UNIDAD;
        const puesto = registro.puesto ?? registro.PUESTO;
        const fechaRegistro = registro.fecha_registro ?? registro.fechaRegistro ?? registro.created_at;

        tarjeta.innerHTML = `
            <div class="card-header bg-dark text-white fw-bold">
                Resultado ${index + 1} de ${registros.length}
            </div>

            <div class="card-body">
                <div class="row g-3">
                    ${crearCampoResultado("Ejercicio Fiscal", ejercicio)}
                    ${crearCampoResultado("Entidad", entidad)}
                    ${crearCampoResultado("Trimestre", trimestre)}
                    ${crearCampoResultado("Periodo de Inicio", formatearFecha(periodoInicio))}
                    ${crearCampoResultado("Periodo Fin", formatearFecha(periodoFin))}
                    ${crearCampoResultado("CURP", curp)}
                    ${crearCampoResultado("Nombre", nombre)}
                    ${crearCampoResultado("Unidad Administración", unidad)}
                    ${crearCampoResultado("Puesto", puesto)}
                    ${crearCampoResultado("Fecha de Registro", formatearFecha(fechaRegistro))}
                </div>
            </div>
        `;

        contenedor.appendChild(tarjeta);
    });

}


// ============================================================
// CREAR CAMPO DE RESULTADO
// ============================================================

function crearCampoResultado(etiqueta, valor) {

    return `
        <div class="col-12 col-md-6">
            <div class="card h-100">
                <div class="card-body">
                    <div class="fw-bold mb-1">
                        ${escapeHtml(etiqueta)}
                    </div>
                    <div>
                        ${
                            valor !== null &&
                            valor !== undefined &&
                            valor !== ""
                                ? escapeHtml(String(valor))
                                : "—"
                        }
                    </div>
                </div>
            </div>
        </div>
    `;

}


// ============================================================
// FORMATEAR FECHA
// ============================================================

function formatearFecha(fecha) {

    if (!fecha) {
        return "—";
    }

    try {

        const fechaObj = new Date(fecha);

        if (isNaN(fechaObj.getTime())) {
            return fecha;
        }

        return fechaObj.toLocaleString("es-MX");

    } catch {

        return fecha;

    }

}


// ============================================================
// LIMPIAR FORMULARIO
// ============================================================

function limpiarFormulario() {

    console.log("APP.JS: limpiando formulario");

    const formulario = document.getElementById("frmConsulta");

    if (formulario) {
        formulario.reset();
    }

    const resultados = document.getElementById("resultadosNomina");

    if (resultados) {
        resultados.innerHTML = "";
    }

    const mensaje = document.getElementById("mensajeLogin");

    if (mensaje) {
        mensaje.className = "alert alert-secondary";
        mensaje.textContent = "Esperando conexión...";
    }

}


// ============================================================
// CERRAR SESIÓN
// ============================================================

async function cerrarSesion() {

    console.log("APP.JS: cerrando sesión");

    try {

        await API.limpiarSesion();

        window.location.reload();

    } catch (error) {

        console.error("Error cerrando sesión:", error);

    }

}


// ============================================================
// LOADER
// ============================================================

function mostrarLoader(mostrar) {

    const loader = document.getElementById("loader");

    if (!loader) {
        return;
    }

    if (mostrar) {
        loader.style.display = "flex";
    } else {
        loader.style.display = "none";
    }

}


// ============================================================
// MENSAJES
// ============================================================

function mostrarMensaje(mensaje, tipo = "info") {

    const elemento = document.getElementById("mensajeLogin");

    if (!elemento) {
        return;
    }

    elemento.className = `alert alert-${tipo}`;
    elemento.textContent = mensaje;

}


// ============================================================
// ESCAPAR HTML
// ============================================================

function escapeHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

