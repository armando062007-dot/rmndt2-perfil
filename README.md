# RMNDT2 · Mi perfil

Mi página personal: [rmndt2.freeddns.org](https://rmndt2.freeddns.org/).

Incluye mi presentación, proyectos, gustos, música de fondo y un contador compartido de visitas. Está hecha con HTML, CSS y JavaScript, con un pequeño Worker y una base de datos D1 para el contador.

## Probar y construir

Se necesita Node.js 24 o posterior. No hay dependencias de aplicación que instalar.

```sh
node scripts/test-counter.mjs
node scripts/test-votes.mjs
node --check dist/profile.js
node scripts/build-counter.mjs
```

Para abrir una copia local con una base temporal aislada: `node scripts/preview.mjs`. El servidor escucha únicamente en `http://127.0.0.1:8847/`; los votos de prueba no modifican la página publicada.

El contenido editable está en `dist/index.html`, `dist/style.css` y `dist/profile.js`. El código del contador está en `worker/index.mjs`; su esquema está en `drizzle/0000_profile_visitors.sql`. El build conserva los recursos del perfil y genera `dist/client` y `dist/server`.

El contador necesita un alojamiento compatible con Workers y D1, con los enlaces `ASSETS` y `DB`. GitHub almacena el código; GitHub Pages por sí solo no ejecuta este backend. El ID de base de datos del archivo generado es un marcador de ejemplo, no una credencial real. Las credenciales del alojamiento deben configurarse fuera del repositorio.

## Cómo se cuentan las visitas

Cada navegador recibe el identificador aleatorio anónimo (Por seguridad) :v). Se conserva en almacenamiento local y cookies para evitar sumar visitas al recargar o volver otro día, basicamente evitar frmeos de visitas. El servidor da prioridad a su cookie cuando está disponible. La base guarda únicamente la huella SHA-256 de ese identificador, no nombres, correos ni IP (No se preocupen por todo eso.

Un identificador repetido se inserta una sola vez gracias a la clave primaria de la base de datos, incluso con solicitudes simultáneas. El total es compartido y persiste después de reiniciar o publicar cambios.

Esto no identifica personas ni dispositivos físicos con certeza. Borrar todo el almacenamiento, cambiar de navegador, usar incógnito o automatizar identificadores puede crear otra visita. No se usa fingerprinting invasivo ni se presenta este número como una métrica infalible. No debe utilizarse para premios, pagos o decisiones de seguridad.

## Privacidad y publicación

### Votos positivos y negativos

Los botones ↑ y ↓ usan `/api/votes`. Una IP puede emitir un único voto entre las dos opciones. La decisión se comprueba en el servidor y una clave primaria evita duplicados incluso con solicitudes simultáneas: cambiar las cookies o el identificador de visita no habilita otro voto.

La IP procede exclusivamente del encabezado `CF-Connecting-IP` suministrado por el proveedor Cloudflare. Si no está disponible, no se acepta el voto; no se confía en `X-Forwarded-For` enviado por el cliente. El alojamiento debe conservar la dirección original del visitante en ese encabezado.

La dirección se normaliza y se transforma mediante HMAC-SHA-256 con una clave aleatoria privada, persistida únicamente en D1. No se guarda la IP en texto ni se envía la clave al navegador o a GitHub. Los datos y la clave no deben incluirse en copias públicas. Una IP es una conexión, no una persona: usuarios de la misma red comparten el límite, y cambiar de IP o usar una VPN puede permitir otro voto. No es un sistema de votación de alta seguridad.

El repositorio de GitHub se prepara con archivos seleccionados y un historial nuevo. No incluye credenciales, archivos `.env`, sesiones, la base de visitantes, registros, identificadores internos del alojamiento ni el historial del entorno de trabajo. La información de presentación y contacto es la misma que ya se muestra voluntariamente en la web pública.

El audio automático depende de los permisos de cada navegador. Si lo bloquea, se intenta iniciar con una interacción real; la página no intenta saltarse las protecciones del navegador.

Los recursos multimedia se incluyen para conservar esta presentación; su presencia no concede derechos de reutilización sobre obras de terceros.
