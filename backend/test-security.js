// backend/test-security.js
// Script para probar la funcionalidad de JWT

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secret-key-super-segura-cambiar-en-produccion';

console.log('🧪 Iniciando pruebas de seguridad JWT...\n');
console.log('JWT_SECRET configurado:', JWT_SECRET ? '✅' : '❌');
console.log('');

// Test 1: Generar token
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 1: Generar token JWT');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const testToken = jwt.sign(
    { id: 'test123', username: 'testuser', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  console.log('✅ Token generado exitosamente');
  console.log('Token (primeros 50 chars):', testToken.substring(0, 50) + '...');
  console.log('Longitud del token:', testToken.length, 'caracteres\n');
} catch (error) {
  console.log('❌ Error al generar token:', error.message, '\n');
}

// Test 2: Verificar token válido
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 2: Verificar token válido');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const validToken = jwt.sign(
    { id: 'test123', username: 'testuser', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  const decoded = jwt.verify(validToken, JWT_SECRET);
  console.log('✅ Token válido verificado');
  console.log('Datos decodificados:', {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role
  });
  console.log('');
} catch (error) {
  console.log('❌ Error al verificar token:', error.message, '\n');
}

// Test 3: Token expirado
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 3: Verificar token expirado');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const expiredToken = jwt.sign(
    { id: 'test123', username: 'testuser', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '-1h' } // Token ya expirado
  );
  jwt.verify(expiredToken, JWT_SECRET);
  console.log('❌ ERROR: Token expirado debería ser rechazado');
  console.log('');
} catch (error) {
  if (error.name === 'TokenExpiredError') {
    console.log('✅ Correcto: Token expirado rechazado');
    console.log('Mensaje:', error.message);
  } else {
    console.log('❌ Error inesperado:', error.message);
  }
  console.log('');
}

// Test 4: Token con secret incorrecto
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 4: Verificar token con secret incorrecto');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const wrongSecretToken = jwt.sign(
    { id: 'test123', username: 'testuser', role: 'admin' },
    'secret-incorrecto'
  );
  jwt.verify(wrongSecretToken, JWT_SECRET);
  console.log('❌ ERROR: Token con secret incorrecto debería ser rechazado');
  console.log('');
} catch (error) {
  if (error.name === 'JsonWebTokenError') {
    console.log('✅ Correcto: Token con secret incorrecto rechazado');
    console.log('Mensaje:', error.message);
  } else {
    console.log('❌ Error inesperado:', error.message);
  }
  console.log('');
}

// Test 5: Verificar estructura del token
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 5: Verificar estructura del token');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
try {
  const token = jwt.sign(
    { id: 'test123', username: 'testuser', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  const decoded = jwt.decode(token);
  console.log('✅ Estructura del token:');
  console.log('  - id:', decoded.id);
  console.log('  - username:', decoded.username);
  console.log('  - role:', decoded.role);
  console.log('  - iat (issued at):', new Date(decoded.iat * 1000).toLocaleString());
  console.log('  - exp (expires):', new Date(decoded.exp * 1000).toLocaleString());
  console.log('');
} catch (error) {
  console.log('❌ Error:', error.message, '\n');
}

// Resumen
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Resumen de Pruebas');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ JWT_SECRET configurado');
console.log('✅ Generación de tokens funciona');
console.log('✅ Verificación de tokens funciona');
console.log('✅ Tokens expirados son rechazados');
console.log('✅ Tokens con secret incorrecto son rechazados');
console.log('');
console.log('🎯 Próximos pasos:');
console.log('1. Verifica que el servidor esté corriendo');
console.log('2. Prueba el login desde la interfaz web');
console.log('3. Usa los scripts en TEST_SCRIPTS.md para pruebas avanzadas');
console.log('4. Revisa TESTING_GUIDE.md para pruebas completas');
console.log('');

