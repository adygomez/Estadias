// Usar window.location.origin en producción para que funcione con cualquier dominio
const BASE_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:3001'
  : window.location.origin;

// Función para obtener el token JWT
const getToken = () => {
  return localStorage.getItem('token');
};

// Función para hacer peticiones autenticadas
const authenticatedFetch = async (url, options = {}) => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Si es FormData, no agregar Content-Type (el navegador lo hará automáticamente)
  const isFormData = options.body instanceof FormData;
  const headers = {
    'Authorization': `Bearer ${token}`,
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Si el token es inválido o expiró, redirigir al login
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('login');
    alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    window.location.href = '/login.html';
    return;
  }

  return response;
};

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Obtener la URL actual y el rol del usuario
  const currentPath = window.location.pathname;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = user.role;

  // Redirigir si está en dashboard-admin (ya no existe, redirigir a dashboard-subdireccion)
  if (currentPath === '/dashboard-admin') {
    window.location.href = '/dashboard-subdireccion';
    return;
  }

    // Verificar que el usuario tenga acceso a dashboard-subdireccion (admin o subdireccion)
  try {
    const token = getToken();
    console.log('Usuario actual:', user);
    
    const verifyRes = await fetch('/api/auth/verify-dashboard-admin', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!verifyRes.ok) {
      // Si es 401, la sesión expiró
      if (verifyRes.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('login');
        alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        window.location.href = '/login.html';
        return;
      }
      
      // Si es 403, el usuario no tiene el rol correcto
      if (verifyRes.status === 403) {
        const data = await verifyRes.json().catch(() => ({}));
        console.error('Acceso denegado. Rol del usuario:', userRole);
        alert(data.message || 'Acceso denegado. Solo usuarios con rol de administrador o subdirección pueden acceder a esta sección.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('login');
        window.location.href = '/login.html';
        return;
      }
    }
    
    // Si llegamos aquí, el usuario tiene acceso
    console.log('Acceso autorizado para dashboard');
    
    // Verificar rol del usuario y mostrar opciones según el rol (solo en dashboard-subdireccion para admin)
    if (currentPath === '/dashboard-subdireccion' && userRole === 'admin') {
      // Mostrar enlace al panel administrativo si es admin
      const navLinks = document.querySelector('.hidden.md\\:flex.items-center.space-x-6');
      if (navLinks) {
        // Verificar que el enlace no exista ya
        if (!navLinks.querySelector('a[href="/admin-panel"]')) {
          const adminPanelLink = document.createElement('a');
          adminPanelLink.href = '/admin-panel';
          adminPanelLink.className = 'text-white hover:text-gray-200 transition-colors duration-200 font-medium';
          adminPanelLink.textContent = 'Panel Admin';
          navLinks.insertBefore(adminPanelLink, navLinks.firstChild);
        }
      }
    }
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    window.location.href = '/login.html';
    return;
  }

  // Configurar logout para dashboard-subdireccion
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    // Remover listeners anteriores si existen clonando el botón
    const newLogoutBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
    
    newLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('login');
      window.location.href = '/login.html';
    });
  }

  // ========== SISTEMA DE PESTAÑAS ==========
  const tabFolio = document.getElementById('tabFolio');
  const tabMatricula = document.getElementById('tabMatricula');
  const seccionFolio = document.getElementById('seccionFolio');
  const seccionMatricula = document.getElementById('seccionMatricula');

  // Variables globales para almacenar datos
  let alumnoFolioActual = null;
  let alumnoMatriculaActual = null;

  // Cambiar entre pestañas
  if (tabFolio && tabMatricula) {
    tabFolio.addEventListener('click', () => {
      tabFolio.classList.add('active', 'border-[#4C0000]', 'text-[#4C0000]');
      tabFolio.classList.remove('border-transparent', 'text-gray-500');
      tabMatricula.classList.remove('active', 'border-[#4C0000]', 'text-[#4C0000]');
      tabMatricula.classList.add('border-transparent', 'text-gray-500');
      seccionFolio.classList.remove('hidden');
      seccionMatricula.classList.add('hidden');
    });

    tabMatricula.addEventListener('click', () => {
      tabMatricula.classList.add('active', 'border-[#4C0000]', 'text-[#4C0000]');
      tabMatricula.classList.remove('border-transparent', 'text-gray-500');
      tabFolio.classList.remove('active', 'border-[#4C0000]', 'text-[#4C0000]');
      tabFolio.classList.add('border-transparent', 'text-gray-500');
      seccionMatricula.classList.remove('hidden');
      seccionFolio.classList.add('hidden');
    });
  }

  // ========== BÚSQUEDA POR FOLIO ==========
  const searchFolio = document.getElementById('searchFolio');
  const btnBuscarFolio = document.getElementById('btnBuscarFolio');
  const resultadoFolio = document.getElementById('resultadoFolio');
  const infoFolio = document.getElementById('infoFolio');
  const btnEditarFolio = document.getElementById('btnEditarFolio');

  if (btnBuscarFolio) {
    btnBuscarFolio.addEventListener('click', async () => {
      const folio = searchFolio?.value.trim();
      if (!folio) {
        alert('⚠️ Por favor ingresa un folio');
        return;
      }

      try {
        const res = await authenticatedFetch(`/api/dashboard/alumno-por-folio/${folio}`);
        if (!res) return;

        if (!res.ok) {
          const data = await res.json();
          alert(data.message || '❌ No se encontró inscripción con ese folio');
          resultadoFolio.classList.add('hidden');
          return;
        }

        const alumno = await res.json();
        alumnoFolioActual = alumno;

        // Mostrar información
        const da = alumno.datos_alumno || {};
        infoFolio.innerHTML = `
          <div><strong>Folio:</strong> ${alumno.folio || 'N/A'}</div>
          <div><strong>Matrícula:</strong> ${alumno.matricula || 'N/A'}</div>
          <div><strong>Nombre:</strong> ${da.primer_apellido || ''} ${da.segundo_apellido || ''} ${da.nombres || ''}</div>
          <div><strong>CURP:</strong> ${da.curp || 'N/A'}</div>
          <div><strong>Semestre:</strong> ${da.semestre || 'N/A'}</div>
          <div><strong>Grupo:</strong> ${da.grupo || 'N/A'}</div>
          <div><strong>Carrera:</strong> ${da.carrera || 'N/A'}</div>
          <div><strong>Turno:</strong> ${da.turno || 'N/A'}</div>
        `;

        resultadoFolio.classList.remove('hidden');
      } catch (err) {
        console.error('Error buscando por folio:', err);
        alert('❌ Error al buscar. Intenta nuevamente.');
      }
    });

    // Permitir buscar con Enter
    if (searchFolio) {
      searchFolio.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnBuscarFolio.click();
      });
    }
  }

  // Editar inscripción por folio
  if (btnEditarFolio) {
    btnEditarFolio.addEventListener('click', () => {
      if (!alumnoFolioActual) {
        alert('⚠️ Primero busca un alumno por folio');
        return;
      }
      abrirModalEdicionConDatos(alumnoFolioActual);
    });
  }

  // ========== BÚSQUEDA POR MATRÍCULA ==========
  const searchMatricula = document.getElementById('searchMatricula');
  const btnBuscarMatricula = document.getElementById('btnBuscarMatricula');
  const resultadoMatricula = document.getElementById('resultadoMatricula');
  const infoMatricula = document.getElementById('infoMatricula');
  const selectorSemestre = document.getElementById('selectorSemestre');
  const infoSemestre = document.getElementById('infoSemestre');
  const detallesSemestre = document.getElementById('detallesSemestre');
  const btnEditarMatricula = document.getElementById('btnEditarMatricula');

  if (btnBuscarMatricula) {
    btnBuscarMatricula.addEventListener('click', async () => {
      const matricula = searchMatricula?.value.trim();
      if (!matricula) {
        alert('⚠️ Por favor ingresa una matrícula');
        return;
      }

      try {
        const res = await authenticatedFetch(`/api/dashboard/alumno-por-matricula/${matricula}`);
        if (!res) return;

        if (!res.ok) {
          const data = await res.json();
          alert(data.message || '❌ No se encontró inscripción con esa matrícula');
          resultadoMatricula.classList.add('hidden');
          return;
        }

        const data = await res.json();
        alumnoMatriculaActual = data;

        // Mostrar información básica
        const da = data.inscripcion.datos_alumno || {};
        infoMatricula.innerHTML = `
          <div><strong>Folio:</strong> ${data.inscripcion.folio || 'N/A'}</div>
          <div><strong>Matrícula:</strong> ${data.matricula || 'N/A'}</div>
          <div><strong>Nombre:</strong> ${da.primer_apellido || ''} ${da.segundo_apellido || ''} ${da.nombres || ''}</div>
          <div><strong>CURP:</strong> ${da.curp || 'N/A'}</div>
        `;

        // Llenar selector de semestres
        selectorSemestre.innerHTML = '<option value="">-- Selecciona un semestre --</option>';
        selectorSemestre.innerHTML += '<option value="1">1º Semestre (Inscripción)</option>';
        
        data.semestresDisponibles.forEach(sem => {
          selectorSemestre.innerHTML += `<option value="${sem.semestre}">${sem.semestre}º Semestre</option>`;
        });

        resultadoMatricula.classList.remove('hidden');
        infoSemestre.classList.add('hidden');
      } catch (err) {
        console.error('Error buscando por matrícula:', err);
        alert('❌ Error al buscar. Intenta nuevamente.');
      }
    });

    // Permitir buscar con Enter
    if (searchMatricula) {
      searchMatricula.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnBuscarMatricula.click();
      });
    }
  }

  // Cargar datos del semestre seleccionado
  if (selectorSemestre) {
    selectorSemestre.addEventListener('change', async () => {
      const semestre = selectorSemestre.value;
      if (!semestre || !alumnoMatriculaActual) return;

      try {
        let registro = null;
        
        if (semestre === '1') {
          // Mostrar inscripción original
          registro = alumnoMatriculaActual.inscripcion;
        } else {
          // Buscar reinscripción del semestre
          const res = await authenticatedFetch(`/api/dashboard/reinscripcion/${alumnoMatriculaActual.matricula}/${semestre}`);
          if (!res) return;
          
          if (!res.ok) {
            alert('❌ No se encontró reinscripción para ese semestre');
            return;
          }
          
          registro = await res.json();
        }

        if (!registro) return;

        // Mostrar detalles del semestre
        const da = registro.datos_alumno || {};
        detallesSemestre.innerHTML = `
          <div><strong>Semestre:</strong> ${da.semestre || semestre}</div>
          <div><strong>Grupo:</strong> ${da.grupo || 'N/A'}</div>
          <div><strong>Turno:</strong> ${da.turno || 'N/A'}</div>
          <div><strong>Carrera:</strong> ${da.carrera || 'N/A'}</div>
          <div><strong>Periodo:</strong> ${da.periodo_semestral || 'N/A'}</div>
          <div><strong>Registro completado:</strong> ${registro.registro_completado ? 'Sí' : 'No'}</div>
        `;

        // Guardar registro actual para edición
        alumnoMatriculaActual.registroActual = registro;
        infoSemestre.classList.remove('hidden');
      } catch (err) {
        console.error('Error cargando semestre:', err);
        alert('❌ Error al cargar datos del semestre');
      }
    });
  }

  // Editar reinscripción por matrícula
  if (btnEditarMatricula) {
    btnEditarMatricula.addEventListener('click', () => {
      if (!alumnoMatriculaActual || !alumnoMatriculaActual.registroActual) {
        alert('⚠️ Primero selecciona un semestre');
        return;
      }
      abrirModalEdicionConDatos(alumnoMatriculaActual.registroActual);
    });
  }

  // Función para abrir modal con datos (usada por ambos flujos)
  function abrirModalEdicionConDatos(alumno) {
    if (!alumno) return;
    
    document.getElementById('editId').value = alumno._id;
    
    // Manejar folio según tipo de registro
    const folioInput = document.getElementById('folio');
    const folioRequired = document.getElementById('folioRequired');
    const esReinscripcion = alumno.tipo_registro === 'reinscripcion';
    
    if (folioInput) {
      folioInput.value = alumno.folio || '';
      if (esReinscripcion) {
        folioInput.required = false;
        folioInput.disabled = true;
        folioInput.classList.add('bg-gray-100');
        if (folioRequired) folioRequired.style.display = 'none';
      } else {
        folioInput.required = true;
        folioInput.disabled = false;
        folioInput.classList.remove('bg-gray-100');
        if (folioRequired) folioRequired.style.display = 'inline';
      }
    }
        const da = alumno.datos_alumno || {};
        document.getElementById('primer_apellido').value = da.primer_apellido || '';
        document.getElementById('segundo_apellido').value = da.segundo_apellido || '';
        document.getElementById('nombres').value = da.nombres || '';
        document.getElementById('periodo_semestral').value = da.periodo_semestral || '';
        document.getElementById('semestre').value = da.semestre || '';
        document.getElementById('grupo').value = da.grupo || '';
        document.getElementById('turno').value = da.turno || '';
        document.getElementById('carrera').value = da.carrera || '';
        document.getElementById('curp').value = da.curp || '';
        document.getElementById('fecha_nacimiento').value = da.fecha_nacimiento || '';
        document.getElementById('edad').value = da.edad || '';
        document.getElementById('sexo').value = da.sexo || '';
        document.getElementById('estado_nacimiento').value = da.estado_nacimiento || '';
        document.getElementById('municipio_nacimiento').value = da.municipio_nacimiento || '';
        document.getElementById('ciudad_nacimiento').value = da.ciudad_nacimiento || '';
        // Estado civil: convertir número a string para el select
        const estadoCivil = da.estado_civil ? String(da.estado_civil) : '';
        document.getElementById('estado_civil').value = estadoCivil;
        document.getElementById('nacionalidad').value = da.nacionalidad || '';
        document.getElementById('pais_extranjero').value = da.pais_extranjero || '';

        const dg = alumno.datos_generales || {};
        document.getElementById('colonia').value = dg.colonia || '';
        document.getElementById('domicilio').value = dg.domicilio || '';
        document.getElementById('codigo_postal').value = dg.codigo_postal || '';
        document.getElementById('telefono_alumno').value = dg.telefono_alumno || '';
        document.getElementById('correo_alumno').value = dg.correo_alumno || '';
        document.getElementById('paraescolar').value = dg.paraescolar || '';
        document.getElementById('entrega_diagnostico').value = dg.entrega_diagnostico || '';
        document.getElementById('detalle_enfermedad').value = dg.detalle_enfermedad || '';
        document.getElementById('responsable_emergencia_nombre').value = dg.responsable_emergencia?.nombre || '';
        document.getElementById('responsable_emergencia_telefono').value = dg.responsable_emergencia?.telefono || '';
        document.getElementById('responsable_emergencia_parentesco').value = dg.responsable_emergencia?.parentesco || '';
        document.getElementById('carta_poder').value = dg.carta_poder || '';
        document.getElementById('tipo_sangre').value = dg.tipo_sangre || '';
        document.getElementById('contacto_emergencia_nombre').value = dg.contacto_emergencia_nombre || '';
        document.getElementById('contacto_emergencia_telefono').value = dg.contacto_emergencia_telefono || '';
        document.getElementById('habla_lengua_indigena_respuesta').value = dg.habla_lengua_indigena?.respuesta || '';
        document.getElementById('habla_lengua_indigena_cual').value = dg.habla_lengua_indigena?.cual || '';
        document.getElementById('primera_opcion').value = dg.primera_opcion || '';
        document.getElementById('segunda_opcion').value = dg.segunda_opcion || '';
        document.getElementById('tercera_opcion').value = dg.tercera_opcion || '';
        document.getElementById('cuarta_opcion').value = dg.cuarta_opcion || '';
        document.getElementById('estado_nacimiento_general').value = dg.estado_nacimiento_general || '';
        document.getElementById('municipio_nacimiento_general').value = dg.municipio_nacimiento_general || '';
        document.getElementById('ciudad_nacimiento_general').value = dg.ciudad_nacimiento_general || '';

        const dm = alumno.datos_medicos || {};
        document.getElementById('numero_seguro_social').value = dm.numero_seguro_social || '';
        document.getElementById('unidad_medica_familiar').value = dm.unidad_medica_familiar || '';
        document.getElementById('enfermedad_cronica_respuesta').value = dm.enfermedad_cronica_o_alergia?.respuesta || '';
        document.getElementById('enfermedad_cronica_detalle').value = dm.enfermedad_cronica_o_alergia?.detalle || '';
        document.getElementById('discapacidad').value = dm.discapacidad || '';

        const so = alumno.secundaria_origen || {};
        document.getElementById('nombre_secundaria').value = so.nombre_secundaria || '';
        document.getElementById('regimen').value = so.regimen || '';
        document.getElementById('promedio_general').value = so.promedio_general || '';
        document.getElementById('modalidad').value = so.modalidad || '';

        const tr = alumno.tutor_responsable || {};
        document.getElementById('nombre_padre').value = tr.nombre_padre || '';
        document.getElementById('telefono_padre').value = tr.telefono_padre || '';
        document.getElementById('nombre_madre').value = tr.nombre_madre || '';
        document.getElementById('telefono_madre').value = tr.telefono_madre || '';
        document.getElementById('vive_con').value = tr.vive_con || '';

        const pe = alumno.persona_emergencia || {};
        document.getElementById('persona_emergencia_nombre').value = pe.nombre || '';
        document.getElementById('persona_emergencia_parentesco').value = pe.parentesco || '';
        document.getElementById('persona_emergencia_telefono').value = pe.telefono || '';

        // Inicializar script de opciones de carrera (evitar repeticiones)
        if (typeof inicializarOpcionesCarrera === 'function') {
          inicializarOpcionesCarrera();
        }
        
        // Abrir modal
        new bootstrap.Modal(document.getElementById('editModal')).show();
  }

  // Función para manejar las opciones de carrera (evitar repeticiones)
  function inicializarOpcionesCarrera() {
    const opciones = ["A Y B", "PROGRAMACIÓN", "GESTIÓN E INNOVACIÓN TURÍSTICA", "VENTAS"];
    const selects = [
      document.getElementById('primera_opcion'),
      document.getElementById('segunda_opcion'),
      document.getElementById('tercera_opcion'),
      document.getElementById('cuarta_opcion')
    ];
    
    // Filtrar selects válidos
    const selectsValidos = selects.filter(s => s !== null);
    if (selectsValidos.length === 0) return;
    
    function actualizarOpciones() {
      const seleccionados = selectsValidos.map(select => select.value).filter(Boolean);
      selectsValidos.forEach(select => {
        const valorActual = select.value;
        select.innerHTML = '<option value="">Selecciona opción</option>';
        opciones.forEach(opcion => {
          if (!seleccionados.includes(opcion) || opcion === valorActual) {
            const option = document.createElement('option');
            option.value = opcion;
            option.textContent = opcion;
            if (opcion === valorActual) option.selected = true;
            select.appendChild(option);
          }
        });
      });
    }
    
    // Remover listeners anteriores y agregar nuevos
    selectsValidos.forEach(select => {
      // Clonar el select para remover todos los listeners
      const nuevoSelect = select.cloneNode(true);
      select.parentNode.replaceChild(nuevoSelect, select);
      nuevoSelect.addEventListener('change', actualizarOpciones);
    });
    
    // Actualizar opciones inicialmente
    actualizarOpciones();
  }

document.getElementById('btnGuardar').addEventListener('click', async () => {
  const id = document.getElementById('editId').value;
  const folio = document.getElementById('folio').value.trim();
  
  // Obtener el tipo de registro del alumno actual (si existe)
  let esReinscripcion = false;
  if (id) {
    try {
      const res = await authenticatedFetch(`/api/dashboard/alumno/${id}`);
      if (res && res.ok) {
        const alumno = await res.json();
        esReinscripcion = alumno.tipo_registro === 'reinscripcion';
      }
    } catch (err) {
      console.error('Error obteniendo tipo de registro:', err);
    }
  }

  // Validar folio solo para inscripciones
  if (!esReinscripcion && !folio) {
    alert('⚠️ El folio es obligatorio para inscripciones. Por favor ingresa un folio.');
    document.getElementById('folio').focus();
    return;
  }

  // Verificar si el folio ya existe (solo para inscripciones)
  if (!esReinscripcion && folio) {
    try {
      const checkRes = await authenticatedFetch(`/api/dashboard/alumnos?folio=${folio}`);
      if (checkRes && checkRes.ok) {
        const alumnos = await checkRes.json();
        // Si hay alumnos con ese folio y no es el mismo que estamos editando
        const folioDuplicado = alumnos.find(alumno => {
          // Si estamos editando (hay id), verificar que no sea el mismo alumno
          if (id) {
            return alumno._id !== id && alumno.folio === folio;
          }
          // Si estamos creando (no hay id), cualquier alumno con ese folio es duplicado
          return alumno.folio === folio;
        });

        if (folioDuplicado) {
          alert('❌ Este folio ya está en uso por otro alumno. Por favor ingresa un folio diferente.');
          document.getElementById('folio').focus();
          return;
        }
      }
    } catch (err) {
      console.error('Error verificando folio:', err);
      // Continuar con el guardado si hay error en la verificación
    }
  }

  // Construir datos según tipo de registro
  const datos = {
    datos_alumno: {
      primer_apellido: document.getElementById('primer_apellido').value,
      segundo_apellido: document.getElementById('segundo_apellido').value,
      nombres: document.getElementById('nombres').value,
      periodo_semestral: document.getElementById('periodo_semestral').value,
      semestre: document.getElementById('semestre').value,
      grupo: document.getElementById('grupo').value,
      turno: document.getElementById('turno').value,
      carrera: document.getElementById('carrera').value,
      curp: document.getElementById('curp').value,
      fecha_nacimiento: document.getElementById('fecha_nacimiento').value,
      edad: document.getElementById('edad').value,
      sexo: document.getElementById('sexo').value,
      estado_nacimiento: document.getElementById('estado_nacimiento').value,
      municipio_nacimiento: document.getElementById('municipio_nacimiento').value,
      ciudad_nacimiento: document.getElementById('ciudad_nacimiento').value,
      estado_civil: parseInt(document.getElementById('estado_civil').value) || 0,
      nacionalidad: document.getElementById('nacionalidad').value,
      pais_extranjero: document.getElementById('pais_extranjero').value
    },
    datos_generales: {
      colonia: document.getElementById('colonia').value,
      domicilio: document.getElementById('domicilio').value,
      codigo_postal: document.getElementById('codigo_postal').value,
      telefono_alumno: document.getElementById('telefono_alumno').value,
      correo_alumno: document.getElementById('correo_alumno').value,
      paraescolar: document.getElementById('paraescolar').value,
      entrega_diagnostico: document.getElementById('entrega_diagnostico').value,
      detalle_enfermedad: document.getElementById('detalle_enfermedad').value,
      responsable_emergencia: {
        nombre: document.getElementById('responsable_emergencia_nombre').value,
        telefono: document.getElementById('responsable_emergencia_telefono').value,
        parentesco: document.getElementById('responsable_emergencia_parentesco').value
      },
      carta_poder: document.getElementById('carta_poder').value,
      tipo_sangre: document.getElementById('tipo_sangre').value,
      contacto_emergencia_nombre: document.getElementById('contacto_emergencia_nombre').value,
      contacto_emergencia_telefono: document.getElementById('contacto_emergencia_telefono').value,
      habla_lengua_indigena: {
        respuesta: document.getElementById('habla_lengua_indigena_respuesta').value,
        cual: document.getElementById('habla_lengua_indigena_cual').value
      },
      primera_opcion: document.getElementById('primera_opcion').value,
      segunda_opcion: document.getElementById('segunda_opcion').value,
      tercera_opcion: document.getElementById('tercera_opcion').value,
      cuarta_opcion: document.getElementById('cuarta_opcion').value,
      estado_nacimiento_general: document.getElementById('estado_nacimiento_general').value,
      municipio_nacimiento_general: document.getElementById('municipio_nacimiento_general').value,
      ciudad_nacimiento_general: document.getElementById('ciudad_nacimiento_general').value
    },
    datos_medicos: {
      numero_seguro_social: document.getElementById('numero_seguro_social').value,
      unidad_medica_familiar: document.getElementById('unidad_medica_familiar').value,
      enfermedad_cronica_o_alergia: {
        respuesta: document.getElementById('enfermedad_cronica_respuesta').value,
        detalle: document.getElementById('enfermedad_cronica_detalle').value
      },
      discapacidad: document.getElementById('discapacidad').value
    },
    secundaria_origen: {
      nombre_secundaria: document.getElementById('nombre_secundaria').value,
      regimen: document.getElementById('regimen').value,
      promedio_general: document.getElementById('promedio_general').value,
      modalidad: document.getElementById('modalidad').value
    },
    tutor_responsable: {
      nombre_padre: document.getElementById('nombre_padre').value,
      telefono_padre: document.getElementById('telefono_padre').value,
      nombre_madre: document.getElementById('nombre_madre').value,
      telefono_madre: document.getElementById('telefono_madre').value,
      vive_con: document.getElementById('vive_con').value
    },
    persona_emergencia: {
      nombre: document.getElementById('persona_emergencia_nombre').value,
      parentesco: document.getElementById('persona_emergencia_parentesco').value,
      telefono: document.getElementById('persona_emergencia_telefono').value
    }
  };

  // Agregar campos según tipo de registro
  if (esReinscripcion && id) {
    // Para reinscripciones: obtener datos del alumno actual
    try {
      const res = await authenticatedFetch(`/api/dashboard/alumno/${id}`);
      if (res && res.ok) {
        const alumnoActual = await res.json();
        datos.tipo_registro = 'reinscripcion';
        datos.matricula = alumnoActual.matricula;
        datos.semestre_reinscripcion = alumnoActual.semestre_reinscripcion;
        datos.inscripcion_original_id = alumnoActual.inscripcion_original_id;
      }
    } catch (err) {
      console.error('Error obteniendo datos de reinscripción:', err);
      alert('❌ Error al obtener datos de la reinscripción');
      return;
    }
  } else if (!esReinscripcion) {
    // Para inscripciones: incluir folio
    datos.folio = folio;
    datos.tipo_registro = 'inscripcion';
  }

  const metodo = id ? 'PUT' : 'POST';
  const url = id ? `/api/dashboard/alumnos/${id}` : `/api/dashboard/alumnos`;

  authenticatedFetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  }).then(async (res) => {
    if (!res) return;
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: 'Error al guardar' }));
      // Verificar si es error de folio duplicado
      if (errorData.message && (errorData.message.includes('duplicate') || errorData.message.includes('ya existe') || errorData.message.includes('folio'))) {
        alert('❌ Este folio ya está en uso. Por favor ingresa un folio diferente.');
        document.getElementById('folio').focus();
        return;
      }
      alert('❌ Error: ' + (errorData.message || 'No se pudo guardar el alumno'));
      return;
    }
    
    alert('✅ Guardado correctamente');
    location.reload();
  }).catch((err) => {
    console.error('Error al guardar:', err);
    alert('❌ Error al guardar. Por favor intenta nuevamente.');
  });
});


  function eliminarAlumno(e) {
    const id = e.target.dataset.id;
    if (confirm('¿Eliminar este alumno?')) {
      authenticatedFetch(`/api/dashboard/alumnos/${id}`, { method: 'DELETE' })
        .then((res) => {
          if (!res) return;
          alert('Alumno eliminado');
          location.reload();
        });
    }
  }

  document.getElementById('excelForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const res = await authenticatedFetch(`${BASE_URL}/api/cargar-excel`, {
        method: 'POST',
        body: formData
      });
      if (!res) return;
      const result = await res.json();
      alert(result.message);
    } catch (err) {
      alert('Error al cargar archivo');
    }
  });

  document.getElementById('formGrupos').addEventListener('submit', async (e) => {
    e.preventDefault();
    const archivo = document.getElementById('archivoGrupos').files[0];
    if (!archivo) return alert('Selecciona un archivo');
    const formData = new FormData();
    formData.append('archivo', archivo);
    try {
      const res = await authenticatedFetch(`${BASE_URL}/api/cargar-grupos`, {
        method: 'POST',
        body: formData
      });
      if (!res) return;
      const result = await res.json();
      alert(result.message);
    } catch (err) {
      alert('Error al cargar archivo');
    }
  });

document.getElementById('btnAgregarNuevo').addEventListener('click', () => {
  document.getElementById('editId').value = '';
  const inputs = document.querySelectorAll('#editForm input, #editForm select, #editForm textarea');
  inputs.forEach(input => input.value = '');
  // Limpiar el campo folio también
  document.getElementById('folio').value = '';
  new bootstrap.Modal(document.getElementById('editModal')).show();
});

  
});
