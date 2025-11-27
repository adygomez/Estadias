# 🚀 Guía Rápida de Pruebas

Esta es una guía rápida para probar que todo funciona. Sigue estos pasos en orden.

## ⚡ Prueba Rápida (5 minutos)

### Paso 1: Verificar Instalación

```bash
cd backend
npm list jsonwebtoken
```

Si no está instalado:
```bash
npm install jsonwebtoken
```

### Paso 2: Verificar Configuración

Verifica que tu `.env` tenga:
```env
JWT_SECRET=tu-secret-key-super-segura-cambiar-en-produccion
```

### Paso 3: Ejecutar Script de Prueba

```bash
node test-security.js
```

**Resultado esperado**: Todos los tests deben pasar ✅

### Paso 4: Iniciar el Servidor

```bash
npm start
# o
node server.js
```

### Paso 5: Probar Login (Interfaz Web)

1. Abre `http://localhost:3001/login.html`
2. Abre la consola del navegador (F12)
3. Ingresa credenciales de un usuario **admin**
4. Haz clic en "Iniciar Sesión"

**Verifica en la consola:**
```javascript
localStorage.getItem('token') // Debe tener un token
localStorage.getItem('user') // Debe tener datos del usuario
```

**Resultado esperado**: 
- ✅ Debe redirigir a `/dashboard`
- ✅ Debe haber token en localStorage

### Paso 6: Verificar Dashboard

Una vez en el dashboard:

1. Abre la consola (F12)
2. Ejecuta:
```javascript
// Verificar token
const token = localStorage.getItem('token');
console.log('Token:', token ? '✅ Presente' : '❌ Ausente');

// Verificar usuario
const user = JSON.parse(localStorage.getItem('user'));
console.log('Usuario:', user);
console.log('Rol:', user.role); // Debe ser 'admin'
```

**Resultado esperado**: 
- ✅ Token presente
- ✅ Rol es 'admin'

### Paso 7: Probar API Protegida

En la consola del dashboard, ejecuta:

```javascript
const token = localStorage.getItem('token');
fetch('/api/dashboard/alumnos', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(res => res.json())
  .then(data => {
    console.log('Status:', res.status);
    console.log('Respuesta:', data);
  });
```

**Resultado esperado**: 
- ✅ Status: 200
- ✅ Retorna datos (o array vacío)

### Paso 8: Probar Sin Token (Debe Fallar)

1. Abre una ventana de incógnito
2. Ve directamente a `http://localhost:3001/dashboard`

**Resultado esperado**: 
- ✅ Debe redirigir automáticamente a `/login.html`

### Paso 9: Probar API Sin Token (Debe Fallar)

En una ventana de incógnito, abre la consola y ejecuta:

```javascript
fetch('/api/dashboard/alumnos')
  .then(res => res.json())
  .then(data => console.log('Respuesta:', data));
```

**Resultado esperado**: 
- ✅ Status: 401
- ✅ Mensaje: "Token de acceso requerido"

---

## ✅ Checklist de Verificación

Marca cada item cuando lo hayas probado:

- [ ] `jsonwebtoken` está instalado
- [ ] `JWT_SECRET` está en `.env`
- [ ] Script `test-security.js` pasa todos los tests
- [ ] Servidor inicia sin errores
- [ ] Login de admin funciona y genera token
- [ ] Dashboard carga con token válido
- [ ] API protegida funciona con token
- [ ] Acceso directo a dashboard sin token redirige a login
- [ ] API sin token retorna 401
- [ ] Logout limpia localStorage

---

## 🐛 Si Algo Falla

### Error: "jsonwebtoken is not defined"
```bash
npm install jsonwebtoken
```

### Error: "JWT_SECRET is not defined"
Agrega a `.env`:
```env
JWT_SECRET=tu-secret-key-super-segura-cambiar-en-produccion
```

### El dashboard no redirige sin token
Verifica que `dashboard.js` tenga la verificación al inicio del `DOMContentLoaded`

### Las APIs retornan 401 incluso con token
1. Verifica que el token se esté enviando: `Authorization: Bearer <token>`
2. Verifica que `JWT_SECRET` sea el mismo en el servidor
3. Verifica que el token no haya expirado

### Usuario no puede acceder aunque sea admin
1. Verifica en MongoDB que el usuario tenga `role: 'admin'`
2. Actualiza si es necesario:
```javascript
db.users.updateOne(
  { username: "tu_usuario" },
  { $set: { role: "admin" } }
)
```

---

## 📚 Documentación Completa

Para pruebas más detalladas, consulta:
- `TESTING_GUIDE.md` - Guía completa de pruebas
- `TEST_SCRIPTS.md` - Scripts para pruebas avanzadas
- `SECURITY_IMPLEMENTATION.md` - Documentación de la implementación

---

## 🎯 Prueba Rápida con Scripts

Copia y pega este script en la consola del navegador después de iniciar sesión:

```javascript
// Script completo de verificación
(async () => {
  console.log('🧪 Iniciando verificación de seguridad...\n');
  
  // 1. Verificar token
  const token = localStorage.getItem('token');
  console.log('1. Token:', token ? '✅ Presente' : '❌ Ausente');
  
  // 2. Verificar usuario
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  console.log('2. Usuario:', user.username || '❌ No encontrado');
  console.log('3. Rol:', user.role || '❌ No encontrado');
  
  // 3. Verificar endpoint
  if (token) {
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('4. Verificación:', res.ok ? '✅ Válido' : '❌ Inválido');
      console.log('5. Datos:', data);
    } catch (error) {
      console.log('4. Verificación: ❌ Error', error);
    }
  }
  
  // 4. Probar API protegida
  if (token) {
    try {
      const res = await fetch('/api/dashboard/alumnos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('6. API protegida:', res.ok ? '✅ Acceso permitido' : '❌ Acceso denegado');
    } catch (error) {
      console.log('6. API protegida: ❌ Error', error);
    }
  }
  
  console.log('\n✅ Verificación completada');
})();
```

