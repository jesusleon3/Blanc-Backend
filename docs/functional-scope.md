# Alcance Funcional del Producto — Blanc

> **Estado:** Documento oficial de referencia funcional.
> **Fuentes:** `docs/architecture/01-domain-discovery.md`, `docs/domain-discovery/02-domain-discovery-session-02.md`, sesión de descubrimiento adicional sobre cambio de horario (pendiente de consolidación formal en el Domain Discovery), y el mockup funcional del proyecto.
> **Audiencia:** Cliente, Product Owner, Business Analyst, QA, desarrolladores y nuevos integrantes del proyecto.
> **Propósito:** describir **qué hace el sistema**, en lenguaje de negocio. Este documento no explica cómo está construido el sistema — esa información vive en otros documentos del proyecto (ver Sección 9, Trazabilidad).

---

## Índice

0. [Introducción y Propósito del Documento](#0-introducción-y-propósito-del-documento)
1. [Alcance Funcional General](#1-alcance-funcional-general)
2. [Actores y Roles](#2-actores-y-roles)
3. [Módulos Funcionales](#3-módulos-funcionales)
   - 3.1 [Agenda Inteligente](#31-agenda-inteligente)
   - 3.2 [Atención mediante WhatsApp e Inteligencia Artificial](#32-atención-mediante-whatsapp-e-inteligencia-artificial)
   - 3.3 [Escalamiento a Personal Humano](#33-escalamiento-a-personal-humano)
   - 3.4 [Gestión de Clientas (CRM)](#34-gestión-de-clientas-crm)
   - 3.5 [Anticipos](#35-anticipos)
   - 3.6 [Garantías](#36-garantías)
   - 3.7 [Notificaciones Automáticas](#37-notificaciones-automáticas)
   - 3.8 [Administración y Configuración](#38-administración-y-configuración)
   - 3.9 [Reportes e Indicadores](#39-reportes-e-indicadores)
4. [Estados Funcionales](#4-estados-funcionales)
5. [Supuestos y Restricciones Generales](#5-supuestos-y-restricciones-generales)
6. [Fuera de Alcance Funcional](#6-fuera-de-alcance-funcional)
7. [Glosario Funcional](#7-glosario-funcional)
8. [Trazabilidad con Domain Discovery y Otros Documentos](#8-trazabilidad-con-domain-discovery-y-otros-documentos)

---

## 0. Introducción y Propósito del Documento

Este documento describe, de forma completa y en lenguaje de negocio, el alcance funcional del sistema Blanc: qué hace, para quién, bajo qué reglas y con qué límites. Está diseñado para que cualquier persona —tenga o no formación técnica— pueda entender exactamente qué comportamiento tiene el sistema, sin necesidad de leer documentación de diseño o de arquitectura.

Este documento convive con otros dos, cada uno con un propósito distinto:

| Si buscas... | Consulta... |
|---|---|
| Una presentación comercial y de valor del producto | `docs/presentacion-cliente.md` |
| Cómo está modelado internamente el dominio del negocio (conceptos técnicos de diseño) | `docs/architecture/01-domain-discovery.md` |
| Cómo está construido técnicamente el sistema (tecnología, componentes, base de datos) | `docs/architecture/03-technical-architecture.md` y `docs/architecture/04-data-model.md` |
| **Qué hace el sistema, con el detalle necesario para validar alcance o derivar pruebas** | **Este documento** |

Este documento es la referencia **funcional** oficial: si una funcionalidad no aparece aquí, no debe considerarse parte del alcance actual, salvo que aparezca explícitamente en la Sección 6 (Fuera de Alcance) como algo identificado para el futuro.

---

## 1. Alcance Funcional General

Blanc es un sistema de agendamiento y atención al cliente para un salón de manicura con varias sucursales (hoy 3, con una cuarta ya prevista). El sistema cubre el ciclo completo de la relación con la clienta: desde que escribe por primera vez por WhatsApp, hasta que su cita se completa y queda registrada en su historial — incluyendo los casos en los que algo no sale como se esperaba (una queja, un problema con el servicio, una cancelación).

El alcance funcional actual incluye nueve áreas:

1. Agenda Inteligente
2. Atención mediante WhatsApp e Inteligencia Artificial
3. Escalamiento a Personal Humano
4. Gestión de Clientas (CRM)
5. Anticipos
6. Garantías
7. Notificaciones Automáticas
8. Administración y Configuración
9. Reportes e Indicadores

Cada una se describe en detalle en la Sección 3. El sistema está diseñado específicamente para las necesidades de este negocio — no es, en esta versión, una plataforma pensada para dar servicio a múltiples salones o marcas distintas (ver Sección 6).

---

## 2. Actores y Roles

El sistema tiene dos tipos de actor:

### Actor externo

- **Clienta:** interactúa exclusivamente por WhatsApp. No tiene acceso al panel administrativo. Puede: solicitar información, cotizar y agendar citas, consultar o modificar una cita existente, reportar un problema con un servicio (garantía), y recibir notificaciones automáticas.

### Actores internos (personal del negocio, con acceso al panel administrativo)

| Rol | Qué puede hacer |
|---|---|
| **Super Administrador** | Control total del sistema, incluyendo activación del modo de mantenimiento y configuración crítica de cualquier sucursal. |
| **Administrador** | Gestiona configuración de sucursales, catálogo de servicios, personal y usuarios. |
| **Gerente** | Supervisa la operación de su sucursal: agenda, clientas, escalamientos, garantías y reportes. |
| **Recepcionista** | Gestiona citas, clientas y conversaciones del día a día de su sucursal. |
| **Manicurista** | Consulta su propia agenda y la información de las citas que tiene asignadas. |
| **Analista** | Accede a reportes e indicadores del negocio, sin permisos de configuración ni de operación. |
| **Solo lectura** | Consulta información del sistema sin posibilidad de modificar nada. |

**Restricción funcional:** cada rol ve y hace únicamente lo que le corresponde según su función — un rol nunca tiene acceso a capacidades fuera de lo descrito en su fila. El alcance exacto de sucursales visibles para los roles de Analista y Solo lectura está pendiente de definición formal por parte del negocio (ver Sección 5).

---

## 3. Módulos Funcionales

### 3.1 Agenda Inteligente

**1. Objetivo**
Garantizar que toda cita se agende de forma correcta, sin conflictos, con el tiempo y precio exactos, y que el negocio mantenga siempre el control final sobre la disponibilidad real.

**2. Descripción**
Es el motor central de agendamiento del sistema. Gestiona la disponibilidad de cada sucursal y cada manicurista, calcula automáticamente la duración y el precio de servicios simples y compuestos, sincroniza el resultado con la agenda visual que el negocio ya usa (Google Calendar), y ofrece alternativas razonables cuando la solicitud original no puede cumplirse tal cual.

**3. Funcionalidades**
- Confirmación de citas a partir de una conversación en lenguaje natural (ver Módulo 3.2).
- Cálculo automático de tiempo y precio para composiciones de servicio simples y compuestas, incluyendo combinaciones específicas de retiro de un servicio anterior más aplicación de uno nuevo, y diseño personalizado por uña.
- Verificación automática de disponibilidad por sucursal, manicurista y duración total requerida.
- Preferencia de manicurista: la clienta puede indicar una manicurista de su preferencia (con posibilidad de reasignación si no está disponible) o exigirla de forma exclusiva (sin reasignación posible).
- Sugerencia automática de horarios u opciones alternativas cuando no hay disponibilidad exacta en el momento solicitado.
- Manejo explícito de conflictos de horario cuando dos solicitudes compiten por el mismo espacio casi al mismo tiempo.
- Lista de espera para clientas sin cita confirmada, notificada automáticamente cuando se libera un cupo compatible.
- Aviso de cambio a un horario más conveniente para una clienta que ya tiene una cita confirmada, si se libera un espacio anterior a esa cita.
- Sincronización automática con Google Calendar de toda cita confirmada, reprogramada o cancelada.
- Bloqueo manual de horarios y configuración de días festivos por sucursal.

**4. Reglas de negocio**
- Una manicurista no puede tener dos citas confirmadas que se superpongan en el tiempo. *(Domain Discovery §5.1)*
- El precio y la duración de una cita quedan fijos en el momento de la confirmación y no cambian aunque el catálogo de precios se actualice después. *(Domain Discovery §5.1/§5.2)*
- La duración de una combinación de servicios (por ejemplo, retiro de un servicio anterior más aplicación de uno nuevo) se determina según una tabla de combinaciones específicas, no como la suma de los tiempos individuales de cada servicio por separado. *(Sesión de descubrimiento adicional — reglas Q1/Q2/Q3)*
- Si la clienta solicita una manicurista de forma exclusiva, el sistema nunca ofrece otra manicurista como alternativa — solo puede ofrecer un horario distinto con la misma persona. *(Sesión de descubrimiento adicional — regla A2)*
- Si no hay disponibilidad exacta y la preferencia de manicurista no es exclusiva, el sistema puede sugerir una manicurista alterna o un horario alterno. *(Sesión de descubrimiento adicional — regla A1)*
- Si el horario mostrado durante la conversación deja de estar disponible antes de confirmarse, el sistema informa el conflicto de forma clara y ofrece continuar con otra opción — nunca con un error genérico. *(Sesión de descubrimiento adicional — regla A3)*
- Una clienta con una cita ya confirmada puede solicitar que se le avise si se libera un horario anterior a esa cita. Si acepta la nueva opción ofrecida, su cita se mueve automáticamente al nuevo horario y el horario original queda libre. Si rechaza la oferta o no responde en el tiempo definido por el negocio, conserva su cita original sin ningún cambio. *(Decisión aprobada en sesión de descubrimiento adicional sobre cambio de horario, pendiente de consolidación formal en el Domain Discovery)*
- La plataforma es la única fuente de verdad sobre la disponibilidad real de horarios; Google Calendar es una vista de consulta para el negocio, no el lugar donde se decide si hay espacio disponible. *(Domain Discovery, Pregunta Abierta #1 — supuesto de trabajo)*

**5. Restricciones**
- Cada sucursal cierra los domingos y opera con el horario semanal que ella misma configura.
- La confirmación de una cita siempre revalida la disponibilidad real en el momento exacto de confirmar, incluso si el horario se mostró como disponible momentos antes.
- La prioridad exacta entre varias clientas candidatas a un mismo horario recién liberado (para lista de espera o para el aviso de cambio de horario) es una definición de negocio todavía pendiente de confirmar. *(Domain Discovery, Pregunta Abierta #9; sesión de descubrimiento adicional, pregunta pendiente)*
- El tiempo máximo de espera antes de considerar que una clienta no respondió a un aviso de cambio de horario está pendiente de definición exacta por parte del negocio.

**6. Casos de uso principales**
- Una clienta solicita una cita y el sistema la confirma con el tiempo y precio correctos.
- Una clienta solicita un horario específico que no está disponible, y el sistema le ofrece alternativas razonables.
- Dos clientas intentan tomar el mismo horario casi al mismo tiempo, y el sistema resuelve el conflicto sin duplicar la reserva.
- Una clienta con cita confirmada en dos días pide que se le avise si se libera algo antes; se libera un horario compatible, se le ofrece, la clienta acepta y su cita se mueve automáticamente al nuevo horario.
- Una clienta sin disponibilidad inmediata queda en lista de espera y es notificada automáticamente cuando se libera un cupo.
- Un administrador bloquea un horario o configura un día festivo para una sucursal.

**7. Automatizaciones**
- Verificación automática de disponibilidad en cada solicitud de cita.
- Detección automática de huecos liberados y activación de ofertas a clientas en lista de espera o con una solicitud de cambio de horario activa.
- Sincronización automática con Google Calendar ante cualquier cambio de estado de una cita.

**8. Integraciones**
- **Google Calendar:** toda cita confirmada, reprogramada o cancelada se refleja automáticamente en el calendario visual de la sucursal correspondiente, sin que el personal tenga que hacerlo manualmente.

**9. Indicadores relacionados**
- Ocupación por sucursal.
- Citas completadas, canceladas y no asistidas.
- Citas reprogramadas.

---

### 3.2 Atención mediante WhatsApp e Inteligencia Artificial

**1. Objetivo**
Permitir que una clienta agende, consulte o resuelva dudas conversando de forma natural por WhatsApp, sin necesidad de menús ni comandos, manteniendo siempre el control humano sobre las decisiones de negocio.

**2. Descripción**
Este módulo es el punto de entrada principal de la relación con la clienta. Interpreta el lenguaje natural de la conversación, identifica la intención (agendar, cotizar, cancelar, preguntar, quejarse), y traduce esa intención en una acción concreta sobre la agenda, el catálogo o el perfil de la clienta — siempre validando esa acción contra las reglas de negocio del sistema, nunca decidiendo por cuenta propia fuera de esas reglas.

**3. Funcionalidades**
- Conversación en lenguaje natural, sin menús rígidos ni respuestas mecánicas.
- Interpretación de solicitudes de servicio compuestas, incluyendo composición por uña (por ejemplo, diseño solo en algunas uñas, o combinaciones de retiro y aplicación).
- Cálculo automático de cotización a partir de la descripción libre que da la clienta.
- Solicitud de aclaración cuando la respuesta de la clienta es ambigua frente a una pregunta compuesta, antes de asumir una interpretación incorrecta.
- Reconocimiento de clientas frecuentes, con sugerencias relevantes de servicios que suelen solicitar juntos.
- Recepción de imágenes de referencia enviadas por la clienta como apoyo para definir el servicio deseado.
- Registro y trazabilidad de cada interpretación realizada por la inteligencia artificial.

**4. Reglas de negocio**
- La inteligencia artificial interpreta el lenguaje de la clienta, pero nunca decide por sí sola sobre precios, disponibilidad, políticas de la clienta (lista roja, bloqueo) ni excepciones — toda acción de negocio pasa siempre por las reglas ya definidas del sistema. *(Domain Discovery, principio "la IA interpreta, no decide"; Architecture Principles, sección de Principios para IA)*
- Toda interpretación que determine un precio o una composición de servicio debe validarse contra un formato estructurado antes de tener efecto — nunca se actúa sobre una interpretación de texto libre sin validar. *(Architecture Principles, sección de Principios para IA)*
- Si la respuesta de la clienta es ambigua frente a una pregunta compuesta, el sistema pide una aclaración antes de continuar, en vez de asumir una respuesta. *(Sesión de descubrimiento adicional — regla C1)*
- Toda decisión tomada por la inteligencia artificial con efecto de negocio queda registrada para trazabilidad y auditoría posterior. *(Domain Discovery, principio de trazabilidad de decisiones de IA)*
- Si la inteligencia artificial no puede resolver la solicitud con confianza suficiente, o se presenta una situación sensible, la conversación se detiene y se escala a una persona (ver Módulo 3.3), en vez de continuar con una interpretación dudosa. *(Domain Discovery, principio de degradación a escalamiento humano)*

**5. Restricciones**
- El sistema no procesa notas de voz — las detecta y las escala directamente a una persona.
- La atención automática depende de la disponibilidad del proveedor de inteligencia artificial utilizado; ante una interrupción prolongada, las conversaciones se escalan a atención humana.
- El costo de operación de la inteligencia artificial se monitorea y debe mantenerse dentro de límites definidos por el negocio, para evitar consumo no controlado.

**6. Casos de uso principales**
- Una clienta escribe "quiero gelish en las manos y dos uñas con diseño francés y una con piedras" y el sistema calcula automáticamente el precio y tiempo exactos.
- El sistema pregunta dos cosas a la vez y la clienta responde de forma ambigua ("sí"); el sistema pide que aclare a cuál de las dos preguntas se refiere.
- Una clienta envía una fotografía de un diseño como referencia.
- El sistema reconoce que una clienta suele pedir un servicio adicional junto con el que está solicitando, y se lo sugiere.

**7. Automatizaciones**
- Interpretación y cotización automática de solicitudes de servicio.
- Registro automático de trazabilidad de cada decisión tomada por la inteligencia artificial.

**8. Integraciones**
- **WhatsApp:** canal exclusivo de atención conversacional, con un número propio de atención por cada sucursal.

**9. Indicadores relacionados**
- Tiempo promedio de respuesta.
- Costo de operación de la inteligencia artificial.
- Proporción de conversaciones resueltas completamente por el asistente automático frente a las que requirieron intervención humana.
- Embudo de conversión (de conversación iniciada a cita confirmada).

---

### 3.3 Escalamiento a Personal Humano

**1. Objetivo**
Garantizar que ninguna situación que la inteligencia artificial no pueda resolver quede sin atención humana oportuna.

**2. Descripción**
Este módulo detiene automáticamente la atención conversacional automática cuando ocurre una situación sensible o fuera del alcance de la inteligencia artificial, notifica de inmediato al personal correspondiente, y permite que una persona tome el control de la conversación y lo devuelva al asistente automático cuando corresponda.

**3. Funcionalidades**
- Detección automática de situaciones que requieren atención humana: envío de una imagen que requiere criterio humano, recepción de una nota de voz, una queja, o el uso de lenguaje o palabras que el negocio ha definido como sensibles.
- Notificación inmediata al personal correspondiente cuando ocurre una de estas situaciones.
- Toma de control manual de la conversación por parte de un empleado.
- Devolución explícita del control al asistente automático por parte del empleado.
- Vista de conversaciones pendientes de respuesta, para asegurar que ningún mensaje quede sin contestar.

**4. Reglas de negocio**
- Ante una imagen que requiere criterio humano, una nota de voz, una queja o el uso de una palabra sensible, la atención automática se detiene de inmediato y se crea un aviso para el personal. *(Domain Discovery §5.4)*
- El control de una conversación (automático o humano) se verifica justo antes de que el asistente automático genere cualquier respuesta, para evitar que el asistente responda justo después de que una persona ya tomó el control. *(Domain Discovery, principio de escalamiento humano)*
- El retorno del control al asistente automático es siempre una acción explícita del empleado — nunca ocurre de forma automática por el simple paso del tiempo. *(Domain Discovery §5.4)*
- Si el intento de notificar al personal falla, el sistema debe intentarlo de nuevo o notificar a una persona de respaldo — nunca debe quedar una situación sensible sin ningún aviso efectivo. *(Domain Discovery, principio de entrega garantizada de notificación de escalamiento)*

**5. Restricciones**
- La lista exacta de palabras consideradas sensibles es configurable por el negocio y no es fija.
- El criterio exacto para considerar que una clienta está "molesta" combina el tono detectado por la inteligencia artificial y palabras clave definidas por el negocio.

**6. Casos de uso principales**
- Una clienta envía una queja y el sistema detiene la conversación automática y notifica al personal.
- Un empleado toma el control de una conversación escalada, responde manualmente y devuelve el control al asistente al finalizar.
- Una clienta envía una nota de voz; el sistema detecta que no puede procesarla y escala directamente a una persona.

**7. Automatizaciones**
- Detección y escalamiento automático de situaciones sensibles.
- Reintento automático de notificación al personal si el primer intento falla.

**8. Integraciones**
- **WhatsApp:** mismo canal de conversación de la clienta, ahora atendido directamente por una persona.

**9. Indicadores relacionados**
- Conversaciones escaladas a personal.
- Tiempo de atención de casos escalados.
- Conversaciones pendientes de respuesta.

---

### 3.4 Gestión de Clientas (CRM)

**1. Objetivo**
Mantener un registro completo y personalizado de cada clienta, para dar un trato consistente y relevante sin importar quién la atienda.

**2. Descripción**
Este módulo concentra toda la información relevante de cada clienta: sus datos de contacto, preferencias, historial de servicios, comportamiento (frecuencia, cancelaciones) y cualquier etiqueta relevante para el trato personalizado del negocio.

**3. Funcionalidades**
- Perfil de clienta: nombre, teléfono, sucursal y manicurista favorita, cumpleaños, notas internas.
- Historial completo de citas y conversaciones por clienta.
- Estadísticas derivadas: última visita, ticket promedio, servicios más solicitados, número total de visitas.
- Clasificación de comportamiento: clienta normal, VIP, en observación por cancelaciones frecuentes ("lista roja"), o bloqueada.
- Sistema de etiquetas libres y personalizables (por ejemplo VIP, frecuente, alérgica a algún producto, pendiente de pago, cliente conflictiva), sin limitarse a un catálogo cerrado.

**4. Reglas de negocio**
- La identidad de una clienta es global por número de teléfono, no se duplica por sucursal — su historial y estadísticas cruzan todas las sucursales que visite. *(Domain Discovery, Pregunta Abierta #6 — supuesto de trabajo)*
- Una clienta marcada en "lista roja" requiere el pago de un anticipo antes de que su cita quede confirmada en firme, y cualquier cancelación de su parte requiere aprobación de un empleado. *(Domain Discovery §5.5/§5.6)*
- Las etiquetas de clienta son de texto libre, definidas por el personal según lo consideren útil, sin limitarse a una lista predefinida. *(Sesión de descubrimiento adicional — regla F2)*
- Una clienta bloqueada no puede agendar citas hasta que un empleado la desbloquee explícitamente. *(Domain Discovery §5.5)*

**5. Restricciones**
- El criterio exacto (número de cancelaciones, ventana de tiempo) para asignar automáticamente a una clienta en "lista roja" está pendiente de definición formal — hoy la asignación es manual, con sugerencia del sistema basada en historial. *(Domain Discovery, Pregunta Abierta #3)*
- La gobernanza exacta de las etiquetas (si tienen alcance por sucursal o global, si alguna requiere permisos especiales para asignarse) está pendiente de definición.

**6. Casos de uso principales**
- Un empleado consulta el perfil completo de una clienta antes de atenderla.
- Un empleado marca a una clienta como VIP o en lista roja.
- Un empleado agrega una etiqueta personalizada a una clienta (por ejemplo, "alérgica a acetona").
- Un gerente revisa el historial de conversaciones y citas de una clienta específica.

**7. Automatizaciones**
- Cálculo automático de estadísticas derivadas (última visita, ticket promedio, servicios favoritos) a partir del historial real de citas.

**8. Integraciones**
- No aplica (módulo interno, sin conexión con sistemas externos).

**9. Indicadores relacionados**
- Clientas nuevas y recurrentes.
- Distribución de clientas por clasificación (normal, VIP, lista roja, bloqueada).

---

### 3.5 Anticipos

**1. Objetivo**
Reducir el riesgo de cancelaciones de último momento en clientas con historial de comportamiento poco confiable, mediante un compromiso económico previo a la confirmación.

**2. Descripción**
Cuando una clienta marcada en "lista roja" agenda una cita, el sistema solicita automáticamente un anticipo antes de confirmar la cita en firme, reteniendo temporalmente el horario mientras espera el pago.

**3. Funcionalidades**
- Solicitud automática de anticipo por WhatsApp para clientas en lista roja.
- Retención temporal del horario solicitado mientras se espera el pago.
- Liberación automática del horario si el anticipo no se paga dentro del tiempo definido.
- Registro del estado del anticipo: pendiente, pagado, expirado o reembolsado.

**4. Reglas de negocio**
- Solo se solicita anticipo a clientas marcadas en lista roja; el resto de las clientas no pasa por este paso. *(Domain Discovery §5.6)*
- Si el anticipo no se paga dentro de la ventana de tiempo definida, el horario se libera automáticamente para otras clientas. *(Domain Discovery §5.6, Pregunta Abierta #4)*
- Una cita que requiere anticipo no se considera confirmada en firme hasta que el pago quede registrado. *(Domain Discovery §5.1/§5.6)*

**5. Restricciones**
- La ventana exacta de tiempo antes de que expire la retención del horario está pendiente de definición formal por parte del negocio. *(Domain Discovery, Pregunta Abierta #4)*

**6. Casos de uso principales**
- Una clienta en lista roja agenda una cita y recibe una solicitud de anticipo antes de la confirmación en firme.
- Una clienta no paga el anticipo a tiempo y el horario se libera automáticamente.
- Un empleado reembolsa un anticipo ya pagado ante una cancelación justificada.

**7. Automatizaciones**
- Solicitud automática de anticipo al momento de agendar.
- Liberación automática del horario ante expiración del plazo de pago.

**8. Integraciones**
- **WhatsApp:** canal de solicitud y confirmación de pago del anticipo.

**9. Indicadores relacionados**
- No se identifica un indicador dedicado a este módulo, más allá de los ya cubiertos en el Módulo 3.9 (cancelaciones, ocupación).

---

### 3.6 Garantías

**1. Objetivo**
Dar respuesta ordenada y verificable a una clienta que reporta un problema con un servicio ya realizado, sin comprometer el control humano sobre la decisión final.

**2. Descripción**
Este módulo permite registrar y validar solicitudes de garantía cuando una clienta reporta que el producto aplicado se dañó o se despegó dentro del periodo de vigencia, verificando automáticamente que la solicitud corresponde a un servicio real y a una fecha vigente, antes de enviarla a revisión del personal.

**3. Funcionalidades**
- Registro de una solicitud de garantía asociada a una cita específica.
- Validación automática de que la fecha del reclamo está dentro del periodo de vigencia de la garantía.
- Validación automática de que el servicio reportado coincide con el servicio realmente realizado en esa cita.
- Envío de la solicitud a revisión del personal, con el resultado de la validación automática ya disponible.

**4. Reglas de negocio**
- La garantía cubre el producto aplicado durante los 7 días posteriores al servicio. *(Sesión de descubrimiento adicional — regla N1)*
- La solicitud de garantía solo es válida si corresponde a un servicio efectivamente realizado y completado — no aplica sobre una cita cancelada o no realizada. *(Sesión de descubrimiento adicional — regla N1, precisión funcional)*
- Ninguna solicitud de garantía se aprueba de forma automática — toda solicitud, sea válida o no según la validación automática, se envía a revisión de una persona antes de tener efecto. *(Sesión de descubrimiento adicional — decisión explícita de mantener siempre revisión humana)*

**5. Restricciones**
- El beneficio exacto que recibe la clienta ante una garantía válida (reposición gratuita, descuento u otro) está pendiente de definición por parte del negocio.
- El tratamiento de una coincidencia parcial (por ejemplo, se reporta un problema con un servicio distinto al realmente realizado) está pendiente de definición.

**6. Casos de uso principales**
- Una clienta reporta, a los 3 días, que se le despegó una uña; el sistema valida que está dentro del plazo y que corresponde a un servicio real, y lo envía a revisión.
- Una clienta reporta un problema fuera del plazo de 7 días; el sistema indica que la garantía está vencida y de todas formas permite enviarla a revisión.
- Un empleado revisa una solicitud de garantía y decide el resultado final.

**7. Automatizaciones**
- Validación automática de vigencia y coincidencia de servicio al momento de registrar la solicitud.

**8. Integraciones**
- No aplica.

**9. Indicadores relacionados**
- Garantías registradas, según su estado.

---

### 3.7 Notificaciones Automáticas

**1. Objetivo**
Mantener informada a la clienta sobre su cita sin depender de que el personal lo haga manualmente.

**2. Descripción**
Este módulo envía automáticamente los mensajes asociados al ciclo de vida de una cita: confirmación al momento de agendar, y recordatorio antes de la cita, con posibilidad de incluir contenido adicional relevante para el negocio.

**3. Funcionalidades**
- Confirmación automática al momento de agendar una cita.
- Recordatorio automático antes de la fecha de la cita.
- Contenido adicional personalizable dentro del mensaje de recordatorio (por ejemplo, una cortesía o promoción vigente).

**4. Reglas de negocio**
- Toda cita confirmada recibe una notificación de confirmación automática. *(Domain Discovery §5.12)*
- Toda cita recibe un recordatorio automático antes de la fecha programada. *(Domain Discovery §5.12)*
- El contenido del recordatorio puede incluir información adicional definida por el negocio, no solo la fecha y hora de la cita. *(Sesión de descubrimiento adicional — regla N2)*

**5. Restricciones**
- Si el envío de una notificación falla, queda registrado como fallido para su revisión — no se reintenta de forma indefinida sin control.
- La vigencia exacta de las promociones o cortesías incluidas en el recordatorio depende de si el negocio las mantiene fijas o temporales; no está definida en este documento.

**6. Casos de uso principales**
- Una clienta agenda una cita y recibe la confirmación de inmediato.
- Una clienta recibe un recordatorio un día antes de su cita, incluyendo una cortesía vigente.

**7. Automatizaciones**
- Envío automático de confirmaciones y recordatorios según el ciclo de vida de la cita.

**8. Integraciones**
- **WhatsApp:** canal exclusivo de envío de notificaciones.

**9. Indicadores relacionados**
- Notificaciones enviadas, programadas y fallidas.

---

### 3.8 Administración y Configuración

**1. Objetivo**
Permitir que el negocio configure su operación (sucursales, personal, catálogo, accesos) sin depender de cambios manuales fuera del sistema.

**2. Descripción**
Este módulo agrupa toda la configuración operativa del negocio: horarios y días festivos por sucursal, catálogo de servicios y precios, gestión de personal, control de accesos por rol, y la capacidad de pausar temporalmente la atención automática.

**3. Funcionalidades**
- Configuración de horario semanal y días festivos por sucursal.
- Gestión de manicuristas activas por sucursal.
- Catálogo de servicios y modificadores de diseño, con posibilidad de ajuste de precio o duración por sucursal.
- Gestión de usuarios internos y asignación de roles.
- Verificación adicional de identidad obligatoria para los roles con permisos administrativos críticos.
- Registro histórico (auditoría) de cambios de configuración, acciones financieras, cambios de clasificación de clientas, y decisiones relevantes de la inteligencia artificial.
- Modo de mantenimiento para pausar temporalmente la atención automática de una o todas las sucursales.

**4. Reglas de negocio**
- Cada sucursal tiene su propio horario, festivos, personal y número de atención por WhatsApp. *(Domain Discovery §5.7)*
- Los roles con permisos administrativos críticos requieren verificación adicional de identidad, no solo usuario y contraseña. *(Domain Discovery, principio de seguridad)*
- Todo cambio de configuración, toda acción financiera, toda asignación o remoción de la clasificación "lista roja", y toda decisión relevante de la inteligencia artificial queda registrada de forma permanente y no editable. *(Domain Discovery, principio de auditoría)*
- El modo de mantenimiento detiene la atención automática de una sucursal o de todas, de forma reversible, sin afectar la información ya registrada. *(Domain Discovery, caso de uso de modo mantenimiento)*

**5. Restricciones**
- El alcance exacto de cada rol por sucursal (por ejemplo, si un Analista ve todas las sucursales o solo la suya) está pendiente de definición formal. *(Domain Discovery, Pregunta Abierta #11)*
- El comportamiento exacto hacia una clienta que escribe mientras el modo mantenimiento está activo (silencio, mensaje automático de aviso) está pendiente de definición.

**6. Casos de uso principales**
- Un administrador configura el horario de una sucursal o agrega un día festivo.
- Un administrador da de alta un nuevo usuario y le asigna un rol.
- Un administrador activa el modo mantenimiento para una sucursal durante un mantenimiento programado.
- Un analista consulta el historial de auditoría de una acción específica.

**7. Automatizaciones**
- Registro automático de auditoría ante cualquier cambio relevante.

**8. Integraciones**
- No aplica.

**9. Indicadores relacionados**
- No aplica directamente — este módulo alimenta la configuración que otros módulos usan para calcular sus propios indicadores.

---

### 3.9 Reportes e Indicadores

**1. Objetivo**
Dar visibilidad clara y centralizada del desempeño del negocio a quienes lo dirigen.

**2. Descripción**
Este módulo concentra los indicadores clave de operación y de negocio en un panel único, con posibilidad de comparar el desempeño entre sucursales.

**3. Funcionalidades**
- Indicadores de ventas, ocupación, citas completadas y canceladas.
- Indicadores de clientas nuevas y recurrentes.
- Indicador de satisfacción.
- Indicadores de operación de la inteligencia artificial: costo y volumen de conversaciones atendidas.
- Comparativo de desempeño entre sucursales.
- Vista del recorrido de una clienta desde que inicia una conversación hasta que confirma una cita (embudo de conversión).

**4. Reglas de negocio**
- Los indicadores del panel reflejan información real derivada de la operación (citas, conversaciones, clientas) de cada sucursal, no cifras fijas o estimadas manualmente. *(Domain Discovery §5.9)*
- El costo de operación de la inteligencia artificial se reporta con el mismo nivel de detalle que los indicadores de negocio, no de forma separada. *(Domain Discovery, principio de observabilidad de negocio y técnica unificada)*

**5. Restricciones**
- Los indicadores pueden reflejar un ligero retraso respecto al momento exacto en que ocurrió un evento, dado que se actualizan de forma consolidada y no en tiempo real estricto.

**6. Casos de uso principales**
- Un gerente consulta el desempeño de su sucursal en la semana.
- Un analista compara la ocupación entre las tres (próximamente cuatro) sucursales.
- La dueña revisa el costo mensual de la inteligencia artificial frente al volumen de conversaciones atendidas.

**7. Automatizaciones**
- Actualización automática de los indicadores a partir de la operación real del negocio.

**8. Integraciones**
- No aplica.

**9. Indicadores relacionados**
- Este módulo es, en sí mismo, el conjunto de indicadores del sistema — no aplica una subsección adicional.

---

## 4. Estados Funcionales

Esta sección enumera los estados observables de las entidades principales del sistema, sin definir todavía las reglas exactas de transición entre ellos en los tres casos donde esa definición formal sigue pendiente.

| Elemento | Estados observables |
|---|---|
| Cita | Existen varios estados posibles a lo largo de su ciclo de vida (por ejemplo: pendiente, confirmada, en espera de pago, cancelada, completada, no asistida). **Las reglas exactas de qué dispara cada transición siguen pendientes de definición formal.** |
| Conversación | Puede estar activa o cerrada, y ser atendida por el asistente automático o por una persona. **El disparador exacto de cierre y su posible reapertura siguen pendientes de definición formal.** |
| Ticket de escalamiento | Puede estar abierto, en atención, o resuelto. **Las reglas exactas de transición siguen pendientes de definición formal.** |
| Anticipo | Pendiente, pagado, expirado o reembolsado. |
| Solicitud de garantía | Puede ser válida, expirada, no encontrada, o enviada a revisión. |
| Entrada en lista de espera | En espera, notificada, expirada, o convertida en cita. |
| Solicitud de cambio de horario | Activa, con oferta enviada, aceptada, rechazada, o expirada. |

**Nota:** para los tres primeros elementos (Cita, Conversación, Ticket de escalamiento), el diseño formal de sus reglas de transición fue explícitamente dejado fuera de alcance durante la fase de diseño del proyecto, y sigue así — este documento no cierra esa definición, solo enumera los estados ya reconocidos como observables.

---

## 5. Supuestos y Restricciones Generales

- La identidad de una clienta es global (por número de teléfono), no se repite por sucursal. *(Domain Discovery, Pregunta Abierta #6 — supuesto de trabajo)*
- El precio y la duración de una cita confirmada se congelan en el momento de la confirmación. *(Domain Discovery, Pregunta Abierta #13 — supuesto de trabajo)*
- La plataforma es la fuente de verdad de la disponibilidad; Google Calendar es una vista de consulta. *(Domain Discovery, Pregunta Abierta #1 — supuesto de trabajo)*
- Cada sucursal corresponde a un número de WhatsApp propio y, previsiblemente, a un calendario de Google propio. *(Domain Discovery, Pregunta Abierta #14 — supuesto de trabajo)*
- No existe todavía una definición formal de si algún marco regulatorio de protección de datos personales aplica al manejo de fotos, teléfonos y hábitos de consumo de las clientas. *(Domain Discovery, Pregunta Abierta #12)*
- El sistema está diseñado para este negocio específico, no como una plataforma multi-negocio.

---

## 6. Fuera de Alcance Funcional

Para evitar expectativas incorrectas, el sistema **no** incluye en esta versión:

- Procesamiento automático de notas de voz — se detectan y se escalan directamente a una persona.
- Integración pública con sistemas externos de punto de venta o inventario.
- Soporte para múltiples negocios o marcas distintas dentro de la misma plataforma.
- Aprobación automática de solicitudes de garantía sin revisión humana.
- Procesamiento de pagos en línea más allá de la gestión de anticipos por WhatsApp.
- Un proveedor de respaldo activo de inteligencia artificial ante una caída prolongada del proveedor principal.
- Definición formal de las reglas exactas de transición de estado de una cita, una conversación o un ticket de escalamiento (ver Sección 4).
- Asignación automática (sin intervención humana) de una clienta a la clasificación "lista roja".

---

## 7. Glosario Funcional

| Término | Significado |
|---|---|
| **Cita** | Reserva de un servicio para una clienta, en una sucursal, fecha y hora determinadas. |
| **Anticipo** | Pago parcial solicitado antes de confirmar en firme una cita de una clienta en "lista roja". |
| **Lista roja** | Clasificación de una clienta con historial de cancelaciones frecuentes, sujeta a condiciones adicionales para agendar. |
| **Lista de espera** | Registro de una clienta interesada en un horario que hoy no está disponible, para ser notificada si se libera. |
| **Garantía** | Cobertura de 7 días sobre un servicio ya realizado, ante un problema con el producto aplicado. |
| **Escalamiento** | Proceso por el cual una conversación pasa de ser atendida por el asistente automático a ser atendida por una persona. |
| **Modo mantenimiento** | Estado temporal en el que se detiene la atención automática de una o todas las sucursales. |
| **Etiqueta** | Marca personalizada y de texto libre asignada a una clienta para fines de trato personalizado. |
| **Cambio de horario** | Mecanismo por el cual una clienta con cita confirmada puede ser notificada y cambiarse a un horario anterior si se libera uno compatible. |

---

## 8. Trazabilidad con Domain Discovery y Otros Documentos

| Módulo funcional | Origen técnico principal |
|---|---|
| 3.1 Agenda Inteligente | `01-domain-discovery.md` §5.1; sesión de descubrimiento adicional (motor de duración, A1/A2/A3, cambio de horario) |
| 3.2 Atención por WhatsApp/IA | `01-domain-discovery.md` §5.3; `02-architecture-principles.md` (Principios para IA); sesión de descubrimiento adicional (C1) |
| 3.3 Escalamiento a Personal | `01-domain-discovery.md` §5.4 |
| 3.4 Gestión de Clientas | `01-domain-discovery.md` §5.5; sesión de descubrimiento adicional (F2) |
| 3.5 Anticipos | `01-domain-discovery.md` §5.6 |
| 3.6 Garantías | Sesión de descubrimiento adicional (F3/N1) |
| 3.7 Notificaciones | `01-domain-discovery.md` §5.12; sesión de descubrimiento adicional (N2) |
| 3.8 Administración y Configuración | `01-domain-discovery.md` §5.7/§5.8 |
| 3.9 Reportes e Indicadores | `01-domain-discovery.md` §5.9 |

Para el detalle técnico de cómo se implementa cualquiera de estas capacidades (modelo de datos, componentes, tecnología), consultar `docs/architecture/03-technical-architecture.md` y `docs/architecture/04-data-model.md`.

---

*Documento de referencia funcional oficial. No sustituye el Domain Discovery ni la documentación técnica del proyecto.*
