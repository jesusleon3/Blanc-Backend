# HANDOFF - Blanc Project

> Documento de transferencia de contexto. Generado a partir de un análisis directo del sistema de archivos, el historial de git y la documentación existente del repositorio — no de suposiciones. Donde algo no pudo verificarse, se marca explícitamente como **"No identificado"**.

## 1. Información general del proyecto

- **Nombre del proyecto:** Blanc
- **Propósito del sistema:** plataforma de agendamiento y atención al cliente asistida por inteligencia artificial, vía WhatsApp, para un salón de manicura con varias sucursales (3 activas, una cuarta prevista).
- **Problema de negocio que resuelve:** operación dependiente de mensajes de WhatsApp respondidos manualmente, cálculos de tiempo/precio hechos de memoria por el personal, citas mal calculadas o encimadas, y falta de visibilidad centralizada del negocio para quien lo dirige. (Fuente: `docs/presentacion-cliente.md`, `docs/architecture/01-domain-discovery.md` §7-§8.)
- **Usuarios objetivo:** clientas del salón (vía WhatsApp) y personal interno del negocio a través de un panel administrativo (7 roles: Super Administrador, Administrador, Gerente, Recepcionista, Manicurista, Analista, Solo lectura).
- **Estado general actual del proyecto:** **fase de diseño de dominio y arquitectura, cerrada y congelada, más documentación funcional en curso. No existe código de implementación real (backend/frontend de producción) en ningún punto del repositorio.** El único artefacto de código existente es un mockup visual estático (HTML/CSS/JavaScript sin backend ni persistencia real). El repositorio Git está inicializado pero **no tiene ningún commit todavía** (`git log` reporta *"your current branch 'main' does not have any commits yet"*).
- **Fecha de creación del HANDOFF:** 2026-07-13.

---

## 2. Objetivo final del proyecto

### Visión completa del producto
Un sistema donde una clienta puede resolver todo su ciclo de atención (cotizar, agendar, reprogramar, reportar un problema) conversando de forma natural por WhatsApp, mientras el negocio mantiene control total y auditable sobre cada regla que involucra dinero, disponibilidad o políticas internas. La inteligencia artificial interpreta el lenguaje; nunca decide sola sobre una regla de negocio.

### Funcionalidades esperadas (alcance objetivo completo)
Documentadas en detalle en `docs/functional-scope.md`:
1. Agenda Inteligente (agendamiento, cálculo de tiempo/precio por combinación de servicios, preferencia/exclusividad de manicurista, lista de espera, cambio a un horario mejor antes de una cita ya confirmada).
2. Atención mediante WhatsApp e Inteligencia Artificial.
3. Escalamiento a Personal Humano.
4. Gestión de Clientas (CRM), incluyendo etiquetas personalizables.
5. Anticipos.
6. Garantías.
7. Notificaciones Automáticas.
8. Administración y Configuración (multi-sucursal, catálogo, usuarios, modo mantenimiento).
9. Reportes e Indicadores.

### Arquitectura objetivo
Documentada en `docs/architecture/03-technical-architecture.md` y `docs/architecture/04-data-model.md`. **Decisiones ya firmes (no implementadas todavía):**
- Modular Monolith con separación estricta por módulo (ADR-001), organizado con Hexagonal + Clean Architecture + Vertical Slices (ADR-002).
- Backend: NestJS. Frontend: Next.js (predominantemente client-side).
- Motor de base de datos: PostgreSQL, con esquema separado por Bounded Context, sin llaves foráneas entre esquemas de distinto contexto (ADR-005).
- Cache: Redis (o Valkey).
- Comunicación entre módulos: eventos de dominio en proceso + patrón Outbox para efectos externos críticos (ADR-004).
- CQRS-lite limitado a dos casos: Analítica y disponibilidad de Agenda (ADR-003) — el resto del sistema usa un modelo único de lectura/escritura.
- Proveedor de IA: OpenAI, vía Responses API, exclusivamente para interpretación conversacional (ADR-007).
- WhatsApp: API oficial de WhatsApp Business Platform (ADR-008; rechaza explícitamente Evolution API como integración principal).
- Google Calendar: librería oficial `googleapis`, como proyección de solo lectura (ADR-006).
- CI/CD: GitHub Actions.

**Decisiones todavía pendientes (`Decision Pending`, sin cerrar):** proveedor específico de base de datos (Supabase/Neon/otro), ORM (Prisma vs. Drizzle), proveedor de autenticación, proveedor de storage de archivos, Business Solution Provider de WhatsApp, proveedor de hosting, backend de observabilidad, mecanismo exacto de reclamo de filas del Outbox. Ninguna de estas bloquea seguir documentando, pero sí bloquean iniciar la implementación real del backend.

### Experiencia esperada del usuario
- **Clienta:** escribe por WhatsApp con lenguaje natural, recibe cotización y horarios en segundos, confirma su cita, recibe recordatorios automáticos, y puede reportar un problema con un servicio dentro de los 7 días posteriores.
- **Personal interno:** ve una agenda visual centralizada, recibe alertas inmediatas cuando una conversación necesita atención humana, y tiene visibilidad de indicadores de negocio por sucursal.

### Flujo principal del sistema
Detallado en `docs/presentacion-cliente.md` §5 y `docs/functional-scope.md` §3.1-3.2: mensaje de WhatsApp → interpretación de intención → cotización automática → verificación de disponibilidad → confirmación (con anticipo si aplica) → recordatorio automático → cita completada → registro en historial. Si algo requiere criterio humano en cualquier punto, la conversación se detiene y escala a una persona.

---

## 3. Estado actual del proyecto

### Código actual

- **Stack tecnológico utilizado (en producción):** No aplica — no existe código de implementación de producción. El stack listado en la Sección 2 es un **objetivo de arquitectura documentado, no código instalado ni ejecutándose.**
- **Frameworks y librerías principales:** No aplica, por el mismo motivo. El mockup no usa ningún framework — es HTML/CSS/JavaScript vanilla sin paso de compilación ni `package.json` (confirmado: no existe ningún `package.json`, `requirements.txt`, `Dockerfile` ni archivo de configuración de build en todo el repositorio).
- **Arquitectura actual:** no hay arquitectura de código implementada. Existe una arquitectura **diseñada y documentada** (Modular Monolith + Hexagonal/Clean/Vertical Slices), sin una sola línea de código de backend que la materialice.
- **Estructura de carpetas real del repositorio (raíz):**
  ```
  /
  ├── CLAUDE.md              # Guía de instrucciones para agentes de IA sobre el repositorio
  ├── .claude/                # Configuración local de Claude Code (no es código del proyecto)
  ├── docs/
  │   ├── architecture/       # Domain Discovery, Architecture Principles, Technical Architecture,
  │   │                        # Data Model, ADR_INDEX, ARCHITECTURE_REVIEW, DOMAIN_MODEL_REVIEW,
  │   │                        # y los 22 ADRs (adr/ADR-001 a ADR-022)
  │   ├── domain-discovery/    # Sesiones de descubrimiento posteriores (02-domain-discovery-session-02.md)
  │   ├── requirements/        # blanc-requisitos-negocio.md (documento original del cliente)
  │   ├── presentacion-cliente.md   # Documento comercial
  │   └── functional-scope.md       # Referencia funcional oficial
  └── mockup/                 # Prototipo visual estático (HTML/CSS/JS, sin backend)
  ```
  **No existe** ninguna carpeta `src/`, `backend/`, `frontend/`, `api/`, `server/` ni equivalente de código de aplicación real.
- **Módulos existentes (a nivel de dominio, no de código):** 11 Bounded Contexts documentados en `01-domain-discovery.md` §4 — Agenda, Catálogo y Cotización, Conversación, Escalamiento, Clientas/CRM, Anticipos, Sucursales y Personal, Notificaciones, Sincronización de Calendario, Identidad y Accesos, Analítica. Ninguno tiene código de implementación.
- **Funcionalidades implementadas:** únicamente en el mockup visual (ver tabla de Estado funcional). Ninguna tiene lógica de negocio real ni persistencia entre sesiones más allá de `localStorage` (tema visual, sucursal activa, rol de sesión simulado).
- **Funcionalidades incompletas:** ver tabla — varias partes de la Sesión 02 quedaron explícitamente diferidas (KPIs nuevos de dashboard, pantallas de administración de etiquetas/garantías/recordatorios/tabla de tiempos).
- **Funcionalidades pendientes:** toda la implementación real de backend, base de datos, autenticación, e integraciones (WhatsApp, IA, Google Calendar).

### Estado funcional

> **Nota de lectura de esta tabla, obligatoria para no malinterpretarla:** "Completo" significa *diseñado y demostrado visualmente en el mockup*, **no** "implementado en producción" — no existe producción todavía para nada de este proyecto.

| Funcionalidad | Estado | Descripción |
|---|---|---|
| Agendamiento básico (cotización + confirmación) | Completo (mockup) | Wizard de 4 pasos en `mockup/screens/cita-nueva.html`, con cálculo de cotización funcional en JavaScript. |
| Motor de duración por combinación (retiro + aplicación) | Completo (mockup) | Lógica real en `mockup/js/data.js` (`buscarDuracionRetiro`, `buscarDuracionAplicacion`) y en `cita-nueva.html`. |
| Preferencia / exclusividad de manicurista | Completo (mockup) | Selector en el paso 3 del wizard. |
| Sugerencia automática de horario/manicurista alterna | Completo (mockup) | Simulada de forma determinista sobre dos horarios fijos marcados "alta demanda". |
| Conflicto de confirmación tardía | Completo (mockup) | Simulado de forma determinista sobre un horario fijo (09:30). |
| Cambio a horario anterior para cita ya confirmada | **Pendiente** | Aprobado conceptualmente en un análisis de diseño de dominio extenso; **no consolidado todavía en `01-domain-discovery.md`** (falta crear `03-domain-discovery-session-03.md` primero); sin ninguna implementación en el mockup ni en código real. |
| Lista de espera | Completo (mockup) | `mockup/screens/lista-espera.html`. |
| Atención conversacional por WhatsApp con IA | Parcial | Diseño completo (ADR-007), simulada visualmente con datos ficticios en `chat.html`/`conversaciones.html`; sin integración real con ningún proveedor de IA ni con WhatsApp. |
| Clarificación ante respuesta ambigua | Completo (mockup) | Ejemplo simulado (`conv-9`) en `mockup/js/data.js` y `mockup/screens/chat.html`. |
| Escalamiento a personal humano | Completo (mockup) | `escalamientos.html`, `panel-empleado.html`, toggle de handoff en `chat.html`. |
| Gestión de Clientas (CRM) | Completo (mockup) | `crm.html`, `clienta-perfil.html`. |
| Etiquetas de cliente | Completo (mockup) | Chip removible en `clienta-perfil.html`, columna en `crm.html`. |
| Anticipos | Completo (mockup) | `anticipos.html`, flujo de solicitud en el wizard de cita. |
| Garantías | Completo (mockup) | Tab dedicado en `clienta-perfil.html`, sin aprobación automática (siempre a revisión humana). |
| Notificaciones (recordatorio/confirmación) | Completo (mockup) | `notificaciones.html`. |
| Contenido de cortesía en recordatorio | Parcial | Aprobado como regla de negocio; sin pantalla de administración construida para editarlo. |
| Chats sin contestar | Completo (mockup) | Tarjeta dedicada en `panel-empleado.html`. |
| Administración (sucursales, catálogo, usuarios, modo mantenimiento, prompts) | Completo (mockup) | `configuracion.html`. |
| Gestión de etiquetas (pantalla de administración) | **Pendiente** | Explícitamente diferida en revisión UX previa. |
| Reglas de garantía (pantalla de administración) | **Pendiente** | Explícitamente diferida. |
| Tabla de tiempos/combinaciones (referencia de solo lectura) | **Pendiente** | Explícitamente diferida; los datos ya existen en `data.js`. |
| Recordatorios editables (pantalla de administración) | **Pendiente** | Explícitamente diferida. |
| Reportes e indicadores (Dashboard/Analytics) | Completo (mockup) | `dashboard.html`, `analytics.html`, con cálculo dinámico sobre datos ficticios. |
| Nuevos KPIs (garantías, citas reprogramadas, conflictos evitados) | **Pendiente** | Identificados, explícitamente diferidos. |
| Autenticación y control de acceso por rol | Parcial | Simulada (selección de rol en login sin validar credenciales); diseño de seguridad completo en ADR-010, sin implementar. |
| Backend, base de datos y persistencia real | **Pendiente** | No existe ningún backend, base de datos ni API implementada. |
| Integración real con WhatsApp Business API | **Pendiente** | Decisión arquitectónica tomada; proveedor específico (BSP) todavía sin decidir; sin código de integración. |
| Integración real con proveedor de IA | **Pendiente** | Decisión tomada (OpenAI); sin código de integración. |
| Integración real con Google Calendar | **Pendiente** | Decisión tomada; sin código de integración. |

---

## 4. Estado del desarrollo

- **Qué está funcionando actualmente:** el mockup completo, servido como sitio estático (`python3 -m http.server` desde `mockup/`, según `mockup/README.md`), navegable en navegador de escritorio y móvil (incluye soporte PWA/offline vía `service-worker.js`), con datos 100% ficticios en memoria.
- **Qué no está funcionando:** no aplica en el sentido de errores de producción — no hay sistema en producción. Dentro del mockup, no se identificó ningún defecto abierto al momento de este HANDOFF.
- **Errores conocidos:** No identificado. No existe una suite de pruebas automatizada en el repositorio, ni un registro de errores de producción (no hay producción).
- **Limitaciones actuales (verificadas directamente en el código del mockup):**
  - El wizard de nueva cita (`cita-nueva.html`) usa una lista fija de horarios (`HORA_SLOTS`) que **no** se calcula a partir de `DB.horarioSemanal`, `DB.diasFestivos` ni de las citas reales ya existentes de la manicurista seleccionada — la disponibilidad mostrada es enteramente simulada, no calculada.
  - La función `confirmarCita()` de `cita-nueva.html` **no** agrega la nueva cita al arreglo `DB.citas` — solo muestra una confirmación visual (`toast`) y redirige a `agenda.html`. Ninguna cita nueva creada en el wizard persiste ni siquiera en memoria durante la sesión.
  - No existe ningún mecanismo real que impida el doble-booking en el mockup — el invariante está documentado (`04-data-model.md` §5.1) pero no implementado en ningún código existente.
- **Deuda técnica existente:** no aplica en términos de código de producción (no existe). A nivel documental existe una deuda de consolidación real: la Sesión 02 (`02-domain-discovery-session-02.md`) y el análisis de diseño sobre "cambio de horario" están aprobados pero **no fusionados formalmente** en `01-domain-discovery.md`; `04-data-model.md` no refleja todavía las tablas correspondientes a etiquetas, garantías, motor de duración por combinación, ni al aggregate de cambio de horario.
- **Decisiones técnicas tomadas hasta ahora:** ver Sección 2 (decisiones firmes de `03-technical-architecture.md`) y las decisiones de modelo de dominio ya cerradas (Modular Monolith, Hexagonal + Clean + Vertical Slices, CQRS-lite acotado a Analítica y disponibilidad, Outbox para efectos externos críticos, y la incorporación de un aggregate independiente `SolicitudDeCambioDeHorario` dentro del Bounded Context Agenda, sin separarlo en dos aggregates y sin introducir patrones adicionales como Saga o Process Manager).

---

## 5. Archivos modificados actualmente

### Archivos activos de desarrollo (código del mockup)

**`mockup/js/data.js`**
- Propósito: dataset simulado completo del mockup (todas las entidades de dominio con datos ficticios).
- Cambios recientes: se agregó catálogo de servicios de retiro/aplicación con campo `tipo`, tablas de duración por combinación (`tablaDuracionRetiro`, `tablaDuracionAplicacion`) y sus funciones de búsqueda (`buscarDuracionRetiro`, `buscarDuracionAplicacion`), campo `etiquetas` por clienta, dataset `garantias`, una cita adicional (`cit-1017`) para demostrar una garantía vencida, una conversación adicional (`conv-9`) para demostrar la aclaración conversacional, y el campo `citasReprogramadasSemana` en `kpis`.
- Por qué se modificó: implementar las funcionalidades aprobadas en la Sesión 02 de descubrimiento de negocio.
- Estado actual: completo para lo aprobado como prioridad alta de esa sesión.

**`mockup/js/components.js`**
- Propósito: funciones de renderizado de componentes reutilizables de la interfaz.
- Cambios recientes: se agregaron `badgeGarantiaEstado()` y `etiquetaChip()`.
- Por qué: dar soporte visual a Garantías y Etiquetas reutilizando el patrón de badges ya existente, sin crear componentes nuevos innecesarios.
- Estado actual: completo.

**`mockup/screens/cita-nueva.html`**
- Propósito: wizard de creación de cita (4 pasos).
- Cambios recientes: reestructuración del paso 2 (agrupación Retiro/Aplicación, motor de duración por combinación con nota de "calculado automáticamente" cuando aplica una regla), paso 3 (selector Preferencia/Exclusiva de manicurista, sugerencia automática de horario/manicurista alterna, escenario determinista de "sin horarios disponibles"), paso 4 (badge de exclusividad, manejo explícito del conflicto de confirmación tardía sobre el horario "09:30").
- Por qué: Sesión 02, reglas Q1-Q3 y A1-A3.
- Estado actual: completo para lo aprobado; **la función de confirmación no persiste la cita creada** (ver Sección 4).

**`mockup/screens/clienta-perfil.html`**
- Propósito: perfil completo de una clienta.
- Cambios recientes: sección de etiquetas removibles junto al badge de estado; nuevo tab "Garantías" con búsqueda de cita, validación de vigencia/servicio y acción de "enviar a revisión" (sin aprobación automática).
- Por qué: Sesión 02, reglas F2 y F3/N1.
- Estado actual: completo.

**`mockup/screens/crm.html`**
- Propósito: listado y filtrado de clientas.
- Cambios recientes: columna de etiquetas en la tabla.
- Por qué: Sesión 02, regla F2.
- Estado actual: completo.

**`mockup/screens/panel-empleado.html`**
- Propósito: vista operativa diaria del empleado (citas del día, tickets pendientes, accesos rápidos).
- Cambios recientes: nueva tarjeta "Chats sin contestar", reutilizando el patrón de lista ya existente para "Requieren atención".
- Por qué: Sesión 02, regla F1/O3.
- Estado actual: completo.

**`mockup/screens/chat.html`**
- Propósito: vista de una conversación individual con una clienta.
- Cambios recientes: etiqueta visual "Detectó respuesta ambigua" en mensajes del bot que representan una aclaración conversacional.
- Por qué: Sesión 02, regla C1.
- Estado actual: completo.

### Archivos de documentación activos en esta fase

`docs/architecture/03-technical-architecture.md`, `docs/architecture/04-data-model.md`, `docs/domain-discovery/02-domain-discovery-session-02.md`, `docs/presentacion-cliente.md`, `docs/functional-scope.md` — todos formalmente cerrados o completos en su versión actual, pero **pendientes de una ronda de actualización** para incorporar la Sesión 02 y el análisis de "cambio de horario" (ver Sección 10, Alta prioridad).

---

## 6. Historial de cambios recientes

> **Nota de trazabilidad:** el repositorio Git no tiene commits (verificado con `git log`), por lo que este historial se reconstruye a partir del registro de trabajo de este proyecto, no de metadatos de control de versiones. No hay fechas exactas de commit disponibles.

Orden cronológico aproximado de hitos completados:
1. Domain Discovery (`01-domain-discovery.md`) — creado y posteriormente cerrado por instrucción explícita del cliente.
2. `02-architecture-principles.md` — principios arquitectónicos transversales.
3. Los 22 ADRs (`docs/architecture/adr/`) y `ADR_INDEX.md`.
4. `ARCHITECTURE_REVIEW.md` y `DOMAIN_MODEL_REVIEW.md` — revisiones adversariales, con hallazgos incorporados al Domain Discovery.
5. Construcción del mockup visual completo y una auditoría QA adversarial sobre él; congelado como entregable comercial.
6. `03-technical-architecture.md` — selección de stack y arquitectura de componentes, con revisión adversarial y correcciones aplicadas.
7. `04-data-model.md` — modelo de datos lógico/físico, con revisión adversarial y correcciones aplicadas.
8. `02-domain-discovery-session-02.md` — consolidación de una sesión de descubrimiento adicional con la dueña del negocio.
9. Implementación en el mockup de las funcionalidades de esa sesión clasificadas como prioridad alta (ver archivos listados en Sección 5).
10. Análisis de diseño de dominio extenso (varias rondas de evaluación DDD, YAGNI y revisión de arquitectura) sobre una funcionalidad nueva de cambio de horario para citas ya confirmadas — **aprobado conceptualmente, pero todavía no consolidado en ningún documento de dominio formal.**
11. `docs/presentacion-cliente.md` — documento comercial de presentación del producto.
12. `docs/functional-scope.md` — referencia funcional oficial del producto.
13. Este documento, `HANDOFF.md`.

No se eliminó ninguna funcionalidad previamente aprobada durante este historial.

---

## 7. Intentos realizados y soluciones fallidas

Esta sección documenta explícitamente lo que se intentó y se descartó, para no repetir el trabajo.

### Intento 1 — Nombre "SolicitudDeHorarioAnterior" para el nuevo aggregate de cambio de horario
- **Qué se intentó:** nombrar el concepto de dominio para "avisar a una clienta si se libera un horario antes de su cita ya confirmada" como `SolicitudDeHorarioAnterior`.
- **Fecha aproximada:** durante el análisis de diseño de dominio de esta funcionalidad (hito 10 de la Sección 6).
- **Archivos afectados:** ninguno todavía (el análisis fue conceptual, no llegó a escribirse en ningún documento de dominio).
- **Resultado obtenido:** descartado.
- **Por qué falló:** la palabra "anterior" fija una dirección (solo horarios más tempranos) que se vuelve semánticamente falsa si el negocio algún día acepta ofrecer un horario más tarde, u otra condición distinta. Se determinó que el nombre no representa fielmente el lenguaje de negocio y compromete la legibilidad futura del modelo.
- **Alternativa adoptada:** `SolicitudDeCambioDeHorario` — nombre directionally neutral, consistente con el patrón de nomenclatura ya usado por `SolicitudAnticipo`.

### Intento 2 — Separar el concepto en dos aggregates: "Interés" (de larga duración) y "Oferta" (de corta duración, repetible)
- **Qué se intentó:** modelar la funcionalidad de cambio de horario como dos conceptos independientes — un "interés" permanente de la clienta en cambiar de horario, capaz de generar múltiples "ofertas" sucesivas a lo largo del tiempo si la primera no se acepta.
- **Fecha aproximada:** misma fase de análisis que el Intento 1, en una ronda posterior de revisión DDD.
- **Archivos afectados:** ninguno (análisis puramente conceptual).
- **Resultado obtenido:** descartado, tras una revisión posterior explícitamente enfocada en YAGNI/Occam.
- **Por qué falló:** no existía ninguna evidencia real del negocio de que se necesitaran múltiples intentos de oferta por cita — la única evidencia disponible (la frase original de la dueña del salón) describe un solo ciclo de oferta-respuesta. Se determinó que la separación era complejidad especulativa no justificada ("sobreingeniería"), no una necesidad demostrada.
- **Alternativa adoptada:** un único aggregate (`SolicitudDeCambioDeHorario`), sin separar en dos conceptos, sin Value Object de criterios de aceptación adicionales (manicurista/sucursal/día), y sin introducir patrones adicionales (Saga, Process Manager, Specification formal) mientras no exista un requerimiento explícito del negocio que los justifique.
- **Si existe una alternativa futura:** si el negocio confirma explícitamente que una clienta debe poder recibir más de una oferta a lo largo del tiempo para la misma cita protegida, reconsiderar la separación en ese momento — no antes.

**Nota general:** no existen todavía intentos fallidos de implementación de código (bugs, integraciones rotas, librerías descartadas), porque no existe código de producción en el que puedan haber ocurrido.

---

## 8. Estado de integraciones

| Integración | Estado actual | Qué funciona | Qué falta | Problemas conocidos |
|---|---|---|---|---|
| **WhatsApp** | No implementado | Simulación visual completa en el mockup (`chat.html`, `conversaciones.html`) con datos ficticios | Todo: cuenta oficial de WhatsApp Business Platform, proveedor de acceso (BSP, todavía `Decision Pending`), webhook real, envío/recepción real de mensajes | Ninguno (no hay integración que pueda fallar todavía) |
| **Proveedor de IA (OpenAI)** | No implementado | Ninguna llamada real; la interpretación conversacional en el mockup es texto fijo, no generado por un modelo | Toda la integración: llamadas reales, validación de esquema de salida, control de costo | Ninguno |
| **Base de datos** | No implementada | Ninguna | Todo: proveedor específico (`Decision Pending`), esquema físico, migraciones | Ninguno |
| **APIs propias del sistema** | No implementadas | Ninguna | El diseño de contratos de API (`05-api-design.md`) ni siquiera se ha redactado todavía | Ninguno |
| **Google Calendar** | No implementada | Ninguna | Toda la integración; decisión de librería ya tomada (`googleapis`) pero sin código | Ninguno |
| **Servicios cloud (hosting, observabilidad)** | No implementados | Ninguno | Proveedor de hosting y de observabilidad, ambos `Decision Pending` en `03-technical-architecture.md` | No identificado |
| **Variables de entorno** | No existen | No aplica | No aplica todavía (no hay ningún archivo `.env` ni configuración de entorno en el repositorio) | No identificado |
| **Automatizaciones (recordatorios, expiración de anticipos, etc.)** | Solo simuladas visualmente | El mockup muestra el resultado esperado con datos ficticios | Todo mecanismo real de ejecución (cola de trabajos, programador de tareas) | Ninguno |

---

## 9. Modelo de negocio implementado

Distinción importante: lo que sigue describe qué lógica de negocio **existe realmente como código funcional dentro del mockup** (JavaScript ejecutándose en el navegador), no un backend de producción.

- **Servicios y duraciones:** catálogo real en `mockup/js/data.js` (`servicios`, con campo `tipo`: `"retiro"` o `"aplicacion"`, `precioBase`, `duracionBase`).
- **Cálculo de tiempos:** función real `calcularCotizacion()` en `mockup/screens/cita-nueva.html`. Implementa: (a) combinación retiro + aplicación mediante búsqueda en `tablaDuracionRetiro`; (b) combinación de aplicaciones puras mediante búsqueda en `tablaDuracionAplicacion`; (c) si no hay una combinación exacta definida, cae a un cálculo aditivo de respaldo (suma de duraciones individuales) y lo señala visualmente como estimado.
- **Disponibilidad:** **simulada, no calculada realmente.** El wizard usa una lista fija de horarios (`HORA_SLOTS`) sin cruzarla contra el horario real de la sucursal, los días festivos, ni las citas ya existentes de la manicurista seleccionada. No representa un motor de disponibilidad funcional.
- **Sucursales:** modeladas como datos (`sucursales`, `horarioSemanal`, `diasFestivos`) pero no consumidas dinámicamente por el wizard de agendamiento.
- **Manicuristas:** modeladas como datos (`manicuristas`), con estado activa/inactiva y sucursal asignada; referenciadas en la interfaz, sin verificación real de disponibilidad cruzada.
- **Clientes:** operaciones reales sobre el arreglo en memoria `DB.clientas` — búsqueda, visualización de perfil, agregar/quitar etiquetas. No persiste entre recargas de página más allá de lo que ya existía al cargar `data.js`.
- **Reservaciones:** **el wizard de nueva cita no persiste ninguna cita nueva** (ver Sección 4) — es una limitación real verificada en el código, no una suposición.
- **Reglas de negocio:** documentadas exhaustivamente, con referencia cruzada a su origen, en `docs/functional-scope.md` §3 (una subsección "Reglas de negocio" por cada uno de los 9 módulos funcionales) — es la referencia más completa y actualizada de reglas de negocio del proyecto.

---

## 10. Próximos pasos recomendados

### Alta prioridad

1. **Crear `03-domain-discovery-session-03.md` y consolidar tanto esa sesión como `02-domain-discovery-session-02.md` en `01-domain-discovery.md`.**
   - Razón: es el paso de proceso ya aprobado y pendiente de ejecutar; sin él, la documentación de dominio sigue desactualizada respecto a lo ya implementado en el mockup y a lo ya aprobado conceptualmente (cambio de horario).
   - Archivos probablemente involucrados: `docs/domain-discovery/03-domain-discovery-session-03.md` (nuevo), `docs/architecture/01-domain-discovery.md`.
   - Dependencias: ninguna técnica: es un paso documental, ya autorizado.

2. **Actualizar `04-data-model.md`** con las tablas derivadas de la Sesión 02 (etiquetas, garantías, reglas de duración por combinación) y del aggregate `SolicitudDeCambioDeHorario`.
   - Razón: el modelo de datos formal está desalineado del mockup real y de las decisiones de dominio ya aprobadas.
   - Archivos: `docs/architecture/04-data-model.md`.
   - Dependencias: requiere que el paso 1 esté completo.

3. **Cerrar las decisiones `Decision Pending` de mayor impacto en `03-technical-architecture.md`** (proveedor de base de datos, ORM, proveedor de autenticación, Business Solution Provider de WhatsApp, proveedor de hosting) antes de iniciar cualquier código de backend real.
   - Razón: sin esto, no es posible empezar la implementación real sin arriesgar retrabajo.
   - Archivos: `docs/architecture/03-technical-architecture.md`.
   - Dependencias: cotizaciones/decisiones de negocio externas al repositorio.

4. **Redactar `05-api-design.md`** (contratos de API), documento todavía inexistente.
   - Razón: paso natural previo a escribir cualquier endpoint real.
   - Dependencias: requiere que el paso 2 esté completo.

### Media prioridad

1. Completar en el mockup las funcionalidades de la Sesión 02 explícitamente diferidas (KPIs nuevos de dashboard, pantallas de administración de etiquetas/reglas de garantía/tabla de tiempos/recordatorios editables).
2. Corregir la limitación verificada de que el wizard de nueva cita no persiste la cita creada en `DB.citas` — mejora de fidelidad del mockup, no bloquea nada más.
3. Redactar `06-development-plan.md` (backlog/plan de sprints) una vez `04` y `05` estén completos.

### Baja prioridad

1. Resolver, al momento de documentar formalmente `SolicitudDeCambioDeHorario`, si aceptar una oferta se modela como reprogramación de la misma cita o como cancelación más una cita nueva — ya identificado como una precisión pendiente, no bloqueante para seguir documentando otras partes.
2. Definir el disparador de cierre adicional para "cambio de horario" cuando la fecha de la cita original llega sin que nunca hubiera una oferta.
3. Ajustes visuales/UX adicionales del mockup, sujetos a retroalimentación futura del negocio.

---

## 11. Riesgos actuales

- **Riesgos técnicos:** acumulación de patrones arquitectónicos (Modular Monolith + Hexagonal + Clean + Vertical Slices + CQRS-lite + Outbox) sin una secuencia de implementación todavía definida — riesgo ya identificado formalmente como *Critical* en `ARCHITECTURE_REVIEW.md` (hallazgo F-01), heredado sin resolver hasta `06-development-plan.md`.
- **Riesgos de arquitectura:** varias decisiones de stack siguen sin cerrarse (proveedor de base de datos, ORM, autenticación, hosting, proveedor de WhatsApp) — iniciar implementación sin cerrarlas puede generar retrabajo real.
- **Riesgos de escalabilidad:** no aplican todavía de forma operativa (no hay sistema en ejecución); riesgo latente ya documentado: posible contención de recursos entre los módulos de Conversación y Agenda al compartir un único motor de base de datos (`03-technical-architecture.md` §9, hallazgo F-26).
- **Riesgos de negocio:** dependencia de un único número de WhatsApp por sucursal como canal de agendamiento (`01-domain-discovery.md` §8); varias preguntas de negocio siguen sin respuesta formal (ventana exacta de anticipo, criterio exacto de asignación a lista roja, marco regulatorio de datos personales aplicable, prioridad entre clientas candidatas a un mismo horario liberado).
- **Riesgos de seguridad:** no existe ningún mecanismo real de autenticación ni autorización implementado — el login del mockup simula la selección de un rol sin validar ninguna credencial real. No debe interpretarse, bajo ninguna circunstancia, como un sistema con seguridad real todavía.

---

## 12. Contexto para futuros desarrolladores o agentes IA

**Si alguien continúa este proyecto, debe saber:**

- Este proyecto está en fase de diseño y documentación. **No existe código de producción.** No asumir que hay una aplicación funcionando en ningún ambiente.
- El mockup (`mockup/`) es una demostración visual congelada como entregable comercial. No debe modificarse sin autorización explícita del negocio, salvo para implementar una funcionalidad ya formalmente aprobada (como ya ocurrió con la Sesión 02).
- `docs/architecture/01-domain-discovery.md` es la fuente de verdad del modelo de negocio. Cualquier cambio de comportamiento del sistema debe reflejarse ahí primero, antes que en cualquier otro documento derivado.
- **Decisiones ya cerradas que no deben reabrirse** sin una contradicción objetiva y demostrable contra un documento ya aprobado: Modular Monolith, Hexagonal + Clean Architecture + Vertical Slices, CQRS-lite acotado a Analítica y disponibilidad de Agenda, Outbox para efectos externos críticos, y la incorporación de `SolicitudDeCambioDeHorario` como aggregate independiente dentro del Bounded Context Agenda (sin separarlo en dos conceptos, sin Value Object de criterios adicionales, sin Saga ni Process Manager).
- Tres máquinas de estado (`Cita`, `Conversación`, `TicketEscalamiento`) tienen su diseño formal de transiciones **deliberadamente fuera de alcance** por decisión explícita ya tomada — no diseñarlas por cuenta propia.
- Pendiente de ejecutar, en este orden: crear `03-domain-discovery-session-03.md` → consolidar esa sesión y la Sesión 02 en `01-domain-discovery.md` → actualizar `02-architecture-principles.md` (aclaración menor de un principio conversacional) → actualizar `04-data-model.md`.
- No confundir `docs/presentacion-cliente.md` (documento comercial) con `docs/functional-scope.md` (referencia funcional oficial) — cumplen propósitos distintos, para audiencias distintas, y deben mantenerse consistentes entre sí sin mezclar su contenido ni su tono.
- El mockup contiene dos limitaciones reales verificadas en el código, no simplemente supuestas: el wizard de nueva cita no persiste la cita creada, y la disponibilidad de horarios mostrada es simulada, no calculada contra datos reales de la sucursal/manicurista.

---

## Información que no pudo ser encontrada ("No identificado")

- Errores conocidos de ejecución del mockup (no existe una suite de pruebas ni un registro de QA reciente en el repositorio).
- Variables de entorno, credenciales o configuración de servicios cloud (no existen en el repositorio).
- Fechas exactas de cada cambio (no hay historial de commits de git).
- Alcance exacto de RBAC por sucursal para los roles Analista y Solo lectura (pregunta de negocio explícitamente pendiente en `01-domain-discovery.md`).
- Ventana exacta de expiración de anticipos, criterio exacto de asignación a lista roja, y marco regulatorio de datos personales aplicable (preguntas de negocio explícitamente pendientes).
