# Seguridad y privacidad

No publiques claves, contraseñas, cookies, credenciales del alojamiento, bases de datos ni registros de visitantes. `.gitignore` excluye los formatos más habituales; no sustituye una revisión antes de cada publicación.

El sitio no necesita secretos en el navegador. El identificador de visita no autentica usuarios ni concede permisos. Solo se muestra el total agregado; la API no expone una lista de visitantes.

## Medidas incluidas

- Consultas SQL parametrizadas y clave primaria para evitar visitas duplicadas.
- Validación de UUID y normalización de mayúsculas.
- Preferencia de la cookie del servidor frente a un identificador modificado en almacenamiento local.
- Cookies con `Secure`, `SameSite=Lax`; la cookie del servidor también es `HttpOnly`.
- Comprobación de origen, tipo de contenido y métodos; rechazo de cuerpos declarados mayores de 1 KiB.
- Respuestas del contador sin caché, sin detalles internos de errores y con protección de interpretación de tipo de contenido.
- Sin dependencias de JavaScript de terceros ni inserción de datos remotos mediante `innerHTML`.
- Recursos y enlaces externos explícitos; enlaces de nueva pestaña con `noopener noreferrer`.

## Límites conocidos

Los votos se deduplican por una HMAC de la IP normalizada recibida del proveedor, con clave privada en D1. Los conteos y el voto de la conexión actual son los únicos datos devueltos; no se ofrece una lista de IP ni de huellas. La unicidad es una restricción del servidor y de la base, no un bloqueo exclusivamente visual. No se acepta votar cuando falta una IP confiable.

El proveedor debe suministrar la IP original en `CF-Connecting-IP`. Un proxy mal configurado que reemplace todas las IP por la suya agruparía visitantes distintos. Las VPN, la rotación de IP y las redes compartidas limitan cualquier regla de un voto por IP.

El contador no es una barrera antifraude: un cliente puede borrar todas sus marcas o generar identificadores nuevos. Bloquear eso de forma absoluta requeriría controles adicionales, por ejemplo cuentas verificadas o protección de abuso en el proveedor. No identificamos hardware, no prometemos una persona por dispositivo y no almacenamos IP para ese fin.

El filtrado de bots por agente de usuario es orientativo, no una garantía. Las cookies y el almacenamiento local pueden ser bloqueados por el usuario. Los navegadores distintos del mismo dispositivo pueden aparecer como visitantes diferentes.

Si encuentras un problema, contacta de forma privada con el propietario del repositorio. No abras un issue público que contenga secretos o datos personales. Nunca se puede garantizar riesgo cero: revisa también la configuración y permisos del proveedor de alojamiento.
