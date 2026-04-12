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

// Verificar que el usuario sea admin al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Verificar que el usuario sea admin
  try {
    const verifyRes = await authenticatedFetch('/api/auth/verify-admin');
    if (!verifyRes || !verifyRes.ok) {
      const data = await verifyRes.json();
      alert(data.message || 'Acceso denegado. Solo los administradores pueden acceder a esta sección.');
      window.location.href = '/dashboard-subdireccion';
      return;
    }
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    window.location.href = '/login.html';
    return;
  }

  // Cargar usuarios
  cargarUsuarios();
  cargarEventos();

  // Event listeners
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('login');
    window.location.href = '/login.html';
  });

  document.getElementById('btnCrearUsuario').addEventListener('click', () => {
    abrirModalCrear();
  });

  document.getElementById('usuarioForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarUsuario();
  });

  const btnAgregarEvento = document.getElementById('btnAgregarEvento');
  if (btnAgregarEvento) {
    btnAgregarEvento.addEventListener('click', () => abrirModalEvento(null));
  }
  const eventoForm = document.getElementById('eventoForm');
  if (eventoForm) {
    eventoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarEvento();
    });
  }
  const eventoImagen = document.getElementById('eventoImagen');
  if (eventoImagen) {
    eventoImagen.addEventListener('change', () => {
      const f = eventoImagen.files && eventoImagen.files[0];
      const wrap = document.getElementById('eventoPreviewWrap');
      const img = document.getElementById('eventoPreviewImg');
      if (f && wrap && img) {
        img.src = URL.createObjectURL(f);
        wrap.classList.remove('hidden');
      }
    });
  }
});

// Función para cargar usuarios
async function cargarUsuarios() {
  try {
    const res = await authenticatedFetch('/api/auth/users');
    if (!res) return;
    
    const usuarios = await res.json();
    const tbody = document.getElementById('usuariosTable');
    
    if (usuarios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center text-gray-500">No hay usuarios registrados</td></tr>';
      return;
    }

    tbody.innerHTML = usuarios.map(usuario => {
      const rolTexto = {
        'admin': 'Administrador',
        'subdireccion': 'Subdirección',
        'control_escolar': 'Control Escolar'
      }[usuario.role] || usuario.role;

      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const esUsuarioActual = currentUser.id === usuario._id;

      return `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-gray-900">${usuario.username}</div>
            ${esUsuarioActual ? '<span class="text-xs text-blue-600">(Tú)</span>' : ''}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 py-1 text-xs font-semibold rounded-full ${
              usuario.role === 'admin' ? 'bg-purple-100 text-purple-800' :
              usuario.role === 'subdireccion' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }">
              ${rolTexto}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <button 
              class="text-blue-600 hover:text-blue-900 mr-3 btnEditarUsuario" 
              data-id="${usuario._id}"
              data-username="${usuario.username}"
              data-role="${usuario.role}"
            >
              Editar
            </button>
            ${!esUsuarioActual ? `
              <button 
                class="text-red-600 hover:text-red-900 btnEliminarUsuario" 
                data-id="${usuario._id}"
                data-username="${usuario.username}"
              >
                Eliminar
              </button>
            ` : '<span class="text-gray-400">No disponible</span>'}
          </td>
        </tr>
      `;
    }).join('');

    // Agregar event listeners a los botones
    document.querySelectorAll('.btnEditarUsuario').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const username = btn.dataset.username;
        const role = btn.dataset.role;
        abrirModalEditar(id, username, role);
      });
    });

    document.querySelectorAll('.btnEliminarUsuario').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const username = btn.dataset.username;
        eliminarUsuario(id, username);
      });
    });

  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    alert('Error al cargar usuarios. Por favor, recarga la página.');
  }
}

// Función para abrir modal de crear
function abrirModalCrear() {
  document.getElementById('usuarioModalLabel').textContent = 'Crear Usuario';
  document.getElementById('usuarioForm').reset();
  document.getElementById('usuarioId').value = '';
  document.getElementById('usuarioPassword').required = true;
  document.getElementById('passwordRequired').style.display = 'inline';
  
  const modal = new bootstrap.Modal(document.getElementById('usuarioModal'));
  modal.show();
}

// Función para abrir modal de editar
function abrirModalEditar(id, username, role) {
  document.getElementById('usuarioModalLabel').textContent = 'Editar Usuario';
  document.getElementById('usuarioId').value = id;
  document.getElementById('usuarioUsername').value = username;
  document.getElementById('usuarioRole').value = role;
  document.getElementById('usuarioPassword').value = '';
  document.getElementById('usuarioPassword').required = false;
  document.getElementById('passwordRequired').style.display = 'none';
  
  const modal = new bootstrap.Modal(document.getElementById('usuarioModal'));
  modal.show();
}

// Función para guardar usuario
async function guardarUsuario() {
  const id = document.getElementById('usuarioId').value;
  const username = document.getElementById('usuarioUsername').value;
  const password = document.getElementById('usuarioPassword').value;
  const role = document.getElementById('usuarioRole').value;

  if (!username || !role) {
    alert('Por favor completa todos los campos requeridos');
    return;
  }

  // Si es edición y no hay contraseña, no incluirla
  const data = { username, role };
  if (password || !id) {
    if (!password && !id) {
      alert('La contraseña es requerida para crear un nuevo usuario');
      return;
    }
    if (password) {
      data.password = password;
    }
  }

  try {
    let res;
    if (id) {
      // Actualizar usuario existente
      res = await authenticatedFetch(`/api/auth/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      // Crear nuevo usuario
      res = await authenticatedFetch('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }

    if (!res) return;

    if (res.ok) {
      const result = await res.json();
      alert(result.message || (id ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente'));
      
      // Cerrar modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('usuarioModal'));
      modal.hide();
      
      // Recargar usuarios
      cargarUsuarios();
    } else {
      const error = await res.json();
      alert(error.message || 'Error al guardar usuario');
    }
  } catch (error) {
    console.error('Error al guardar usuario:', error);
    alert('Error al guardar usuario. Por favor, intenta nuevamente.');
  }
}

// Función para eliminar usuario
async function eliminarUsuario(id, username) {
  if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const res = await authenticatedFetch(`/api/auth/users/${id}`, {
      method: 'DELETE'
    });

    if (!res) return;

    if (res.ok) {
      const result = await res.json();
      alert(result.message || 'Usuario eliminado exitosamente');
      cargarUsuarios();
    } else {
      const error = await res.json();
      alert(error.message || 'Error al eliminar usuario');
    }
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    alert('Error al eliminar usuario. Por favor, intenta nuevamente.');
  }
}

// ——— Eventos (página Cultura y deporte) ———

function abrirModalEvento(id) {
  const label = document.getElementById('eventoModalLabel');
  const form = document.getElementById('eventoForm');
  const eventoId = document.getElementById('eventoId');
  const reqSpan = document.getElementById('eventoImagenRequired');
  const previewWrap = document.getElementById('eventoPreviewWrap');
  const previewImg = document.getElementById('eventoPreviewImg');
  const imagenInput = document.getElementById('eventoImagen');

  if (!form || !label) return;

  form.reset();
  if (eventoId) eventoId.value = '';
  if (imagenInput) imagenInput.required = true;
  if (reqSpan) reqSpan.style.display = 'inline';
  if (previewWrap) previewWrap.classList.add('hidden');
  if (previewImg) {
    previewImg.removeAttribute('src');
    previewImg.alt = '';
  }

  if (!id) {
    label.textContent = 'Agregar evento';
    const modal = new bootstrap.Modal(document.getElementById('eventoModal'));
    modal.show();
    return;
  }

  label.textContent = 'Editar evento';
  if (imagenInput) imagenInput.required = false;
  if (reqSpan) reqSpan.style.display = 'none';

  authenticatedFetch(`${BASE_URL}/api/dashboard/evento/${id}`)
    .then((res) => (res && res.ok ? res.json() : Promise.reject()))
    .then((ev) => {
      if (eventoId) eventoId.value = ev._id;
      document.getElementById('eventoTitulo').value = ev.titulo || '';
      document.getElementById('eventoDescripcion').value = ev.descripcion || '';
      document.getElementById('eventoOrden').value =
        ev.orden !== undefined && ev.orden !== null ? String(ev.orden) : '';
      if (ev.imagen && previewImg && previewWrap) {
        const src =
          ev.imagen.indexOf('http') === 0
            ? ev.imagen
            : BASE_URL + (ev.imagen.charAt(0) === '/' ? ev.imagen : '/' + ev.imagen);
        previewImg.src = src;
        previewImg.alt = ev.titulo || 'Vista previa';
        previewWrap.classList.remove('hidden');
      }
      const modal = new bootstrap.Modal(document.getElementById('eventoModal'));
      modal.show();
    })
    .catch(() => {
      alert('No se pudo cargar el evento.');
    });
}

async function cargarEventos() {
  const tbody = document.getElementById('eventosTable');
  if (!tbody) return;

  try {
    const res = await authenticatedFetch(`${BASE_URL}/api/dashboard/eventos`);
    if (!res) return;
    const eventos = await res.json();

    if (!eventos.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No hay eventos. Agrega uno con el botón superior.</td></tr>';
      return;
    }

    tbody.innerHTML = eventos
      .map((ev) => {
        const thumb =
          ev.imagen && ev.imagen.indexOf('http') === 0
            ? ev.imagen
            : BASE_URL + (ev.imagen && ev.imagen.charAt(0) === '/' ? ev.imagen : '/' + (ev.imagen || ''));
        const tituloEsc = String(ev.titulo || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/"/g, '&quot;');
        return `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 text-sm text-gray-700">${ev.orden ?? ''}</td>
          <td class="px-4 py-3">
            <img src="${thumb}" alt="" class="h-14 w-20 object-cover rounded border border-gray-200 bg-gray-100" />
          </td>
          <td class="px-4 py-3 text-sm font-medium text-gray-900">${tituloEsc}</td>
          <td class="px-4 py-3 text-sm">
            <button type="button" class="text-blue-600 hover:text-blue-900 mr-3 btnEditarEvento" data-id="${ev._id}">Editar</button>
            <button type="button" class="text-red-600 hover:text-red-900 btnEliminarEvento" data-id="${ev._id}">Eliminar</button>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.btnEditarEvento').forEach((btn) => {
      btn.addEventListener('click', () => abrirModalEvento(btn.dataset.id));
    });
    tbody.querySelectorAll('.btnEliminarEvento').forEach((btn) => {
      btn.addEventListener('click', () => eliminarEvento(btn.dataset.id));
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML =
      '<tr><td colspan="4" class="px-6 py-4 text-center text-red-600">Error al cargar eventos.</td></tr>';
  }
}

async function guardarEvento() {
  const id = document.getElementById('eventoId').value;
  const titulo = document.getElementById('eventoTitulo').value.trim();
  const descripcion = document.getElementById('eventoDescripcion').value.trim();
  const ordenRaw = document.getElementById('eventoOrden').value.trim();
  const imagenInput = document.getElementById('eventoImagen');
  const file = imagenInput && imagenInput.files && imagenInput.files[0];

  if (!titulo || !descripcion) {
    alert('Título y descripción son obligatorios.');
    return;
  }
  if (!id && !file) {
    alert('Debes seleccionar una imagen para el nuevo evento.');
    return;
  }

  const fd = new FormData();
  fd.append('titulo', titulo);
  fd.append('descripcion', descripcion);
  if (ordenRaw !== '') fd.append('orden', ordenRaw);
  if (file) fd.append('imagen', file);

  try {
    const url = id
      ? `${BASE_URL}/api/dashboard/evento/${id}`
      : `${BASE_URL}/api/dashboard/evento`;
    const res = await authenticatedFetch(url, {
      method: id ? 'PUT' : 'POST',
      body: fd,
    });
    if (!res) return;
    if (res.ok) {
      const modal = bootstrap.Modal.getInstance(document.getElementById('eventoModal'));
      if (modal) modal.hide();
      cargarEventos();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Error al guardar el evento.');
    }
  } catch (e) {
    console.error(e);
    alert('Error al guardar el evento.');
  }
}

async function eliminarEvento(id) {
  if (
    !confirm(
      '¿Eliminar este evento? Se borrará también la imagen del servidor.'
    )
  ) {
    return;
  }
  try {
    const res = await authenticatedFetch(`${BASE_URL}/api/dashboard/evento/${id}`, {
      method: 'DELETE',
    });
    if (!res) return;
    if (res.ok) {
      cargarEventos();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Error al eliminar.');
    }
  } catch (e) {
    console.error(e);
    alert('Error al eliminar el evento.');
  }
}

