# Contrataciones MundoMÓVIL — Formulario + Dashboard

Este repositorio contiene las dos piezas del flujo de contratación de MundoMÓVIL Network:

1. **Formulario de contratación** (`contratar/`) — cara al cliente/comercial, recoge los datos del alta.
2. **Dashboard de contratos** (`dashboard-contratos/`) — interno, para que el equipo gestione y tramite las contrataciones recibidas.

Ambas comparten la misma base de datos Supabase (proyecto `epetzysbwtqwjbktfkze`, tabla `contrataciones`): el formulario escribe, el dashboard lee y actualiza.

---

## 1. Formulario de contratación (`contratar/`)

Formulario multipaso donde el comercial o el cliente da de alta una contratación: elige tarifa, rellena datos personales y de líneas, direcciones, documentación y firma.

### Archivos

```
contratar/
├── index.html    Estructura del formulario (pasos, tarifas, campos)
├── script.js     Lógica completa (catálogo, validaciones, envío a Supabase)
└── styles.css    Estilos
```

### Pasos del formulario

1. **Tarifas** — catálogo de tarifas (móvil, fibra, packs, packs+TV). Cada tarjeta lleva su precio, tipo y nº de líneas incluidas.
2. **Datos** — datos personales del cliente, datos de la línea principal y de las líneas incluidas/adicionales, direcciones de envío y de fibra, extras (TV, alarma…), CUPS de luz, IBAN.
3. **Verificación de solvencia** — pantalla de scoring. **IMPORTANTE: actualmente es una simulación** (decide con `Math.random()`, no consulta ninguna API real). Pendiente de conectar un proveedor real.
4. **Identidad / documentación** — subida de DNI (frontal y trasero) y documento bancario, cada uno con doble botón Cámara + Archivo.

### Tarifas y líneas incluidas

Las tarifas que incluyen varias líneas (ej. "Fibra 600MB + 2 Líneas") están marcadas con `data-lineas="N"`. Al seleccionarlas, el formulario genera automáticamente los bloques de datos de las líneas extra (la 2ª, 3ª…), que el comercial rellena con todos los datos (portabilidad/alta, cambio de titular, prepago con número e ICCID). Estas líneas **no suman precio** (van incluidas en la tarifa) y se muestran en verde como "incluida en la tarifa". Las **líneas adicionales** de pago se añaden aparte y sí suman al total.

### Validación de documentos

- Tipos aceptados: PNG, JPG, PDF.
- **Tamaño mínimo 10 KB** — rechaza archivos vacíos o en negro (el problema de los PNG de 244/567 bytes).
- **Dimensiones mínimas 200×200 px** para imágenes — rechaza fotos vacías/ilegibles.
- El envío se bloquea si algún documento obligatorio no es válido.

### Direcciones

La dirección se captura completa: tipo de vía, nombre, número, **bloque, escalera, planta, piso/puerta**, CP, municipio y provincia. Se construye en un texto legible (ej. "Avenida Olímpica nº 12 · 8ºA · 28935 Móstoles · Madrid"). Misma estructura para envío y fibra.

### Destino de los datos

El formulario inserta directamente en Supabase:
- **Documentos** → bucket `contrataciones-docs` (ruta `DNI/tipo_timestamp.ext`).
- **Datos** → tabla `contrataciones` vía REST API.

> Nota: existe código preparado para un segundo envío a un webhook de Make y para un selfie por QR, pero **ambos están desactivados** actualmente. El flujo activo es solo el de Supabase.

### Anti-caché

`script.js` y `styles.css` se cargan con un parámetro `?v=AAAAMMDDHHMM` que se actualiza en cada despliegue, para forzar que el navegador descargue siempre la versión nueva y no una cacheada.

---

## 2. Dashboard de contratos (`dashboard-contratos/`)

Panel interno donde el equipo ve las contrataciones recibidas, las gestiona (asigna agente, cambia estado, añade notas) y consulta toda la información y los documentos de cada una.

### Archivos

```
dashboard-contratos/
├── index.html    Estructura (estadísticas, tabla, modal de detalle)
├── app.js        Lógica (carga, filtros, cálculo de precio, gestión)
└── app.css       Estilos
```

### Integración con el Portal

- **tool_id:** `contratos`
- **Autenticación:** centralizada vía `portalAuth(sb, 'contratos')`. Acceso para usuarios con permiso `contratos`, más `developer` y `owner`.
- **Botón "← Volver al panel":** regresa al portal sin cerrar sesión.

### Estados del proceso

Cada contratación tiene un estado gestionable desde el dashboard: **No iniciado**, **Iniciado**, **En proceso**, **Terminado**. Las estadísticas superiores muestran el recuento por estado y permiten filtrar al hacer clic.

### Funcionalidades

- Tabla con todas las contrataciones (fecha, cliente, contacto, tarifa, estado, agente, riesgo).
- Búsqueda por nombre, DNI, teléfono o email.
- Filtros por estado, por agente y por riesgo.
- Modal de detalle con toda la información de la contratación y los documentos (DNI y cuenta) mediante URLs firmadas temporales.
- Gestión del proceso: cambio de estado, asignación de agente responsable y notas internas (no visibles para el cliente).
- Historial de cambios por contratación (tabla `contrataciones_historial`).
- Tema claro/oscuro y aviso sonoro de nuevas contrataciones.

### Cálculo del precio total

El dashboard calcula el total mensual sumando: precio base + extras + líneas adicionales de pago. La función reconoce importes con formato `19,95€` y también `5/mes` (sin símbolo €). Las líneas incluidas en la tarifa **no suman**. No cuenta como precio los números de teléfono ni los ICCID.

### Información de líneas en el detalle

Se muestran por separado:
- **Línea 1 (principal)** — la línea principal de la contratación.
- **Líneas incluidas** — las que vienen en la tarifa, con todos sus datos.
- **Líneas adicionales** — las de pago, con su precio y datos.

---

## 3. Base de datos compartida (Supabase)

**Proyecto:** `epetzysbwtqwjbktfkze`

**Tabla `contrataciones`** — campos principales:

`id`, `created_at`, `tarifa`, `precio`, `extras`, `lineas` (adicionales), `lineas_incluidas`, `nombre`, `dni`, `fecha_nac`, `telefono`, `email`, `movil_info` (línea principal), `envio_dir`, `fibra_dir`, `cups_luz`, `alarma`, `iban`, `sin_doc`, `observaciones`, `distribuidor`, `cod_distribuidor`, `riesgo`, `dni_frontal_path`, `dni_trasero_path`, `cuenta_path`, `estado`, `agente`, `agente_id`, `notas_internas`.

**Tabla `contrataciones_historial`** — registro de cambios (estado, agente, notas) por contratación.

**Bucket `contrataciones-docs`** — almacena los documentos subidos (DNI frontal/trasero, documento bancario).

> Si se añade la columna `lineas_incluidas` por primera vez, ejecutar el SQL `anadir_lineas_incluidas.sql` en el SQL Editor de Supabase.

---

## 4. Despliegue

Ambas piezas van en el mismo repositorio y se despliegan en Netlify. El formulario es público (cara al cliente); el dashboard vive dentro del Portal MundoMÓVIL y requiere login.

### Tras cada cambio en el formulario

Actualizar el parámetro `?v=` de `script.js` y `styles.css` en `index.html`, y avisar a los comerciales de que recarguen la página para coger la versión nueva.

---

## 5. Pendientes conocidos

- **Scoring de solvencia**: la verificación del Paso 3 es una simulación (`Math.random()`). Pendiente de conectar una API real de scoring (Incofisa u otro proveedor), preferiblemente vía Netlify Function o Make para no exponer credenciales en el navegador.
- Webhook de Make y selfie por QR: código presente pero desactivado.
