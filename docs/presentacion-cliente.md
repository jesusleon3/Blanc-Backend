# Sistema Inteligente para Gestión de Salones de Belleza

> Documento de presentación comercial. Lenguaje de negocio, sin contenido técnico — orientado a clientes potenciales.

---

## 1. Resumen Ejecutivo

Un salón de belleza multi-sucursal enfrenta hoy un reto muy concreto: la mayor parte de su operación depende de mensajes de WhatsApp respondidos manualmente, cálculos de precio y tiempo hechos de memoria por el personal, y agendas que se coordinan por buena voluntad más que por un sistema confiable. El resultado son mensajes de clientas que se quedan sin respuesta, citas mal calculadas o encimadas, y una dueña o gerente sin visibilidad real de lo que está pasando en cada sucursal.

Este sistema resuelve ese problema combinando dos cosas: una inteligencia artificial que conversa de forma natural con las clientas por WhatsApp — entendiendo pedidos tan específicos como "gelish en las manos y dos uñas con diseño francés" — y un motor de reglas de negocio que garantiza que el precio, el tiempo y la disponibilidad se calculen siempre de forma correcta y consistente, sin depender de que una persona lo recuerde todo de memoria.

La propuesta de valor es simple: **la inteligencia artificial conversa y entiende; el negocio decide.** Todo lo que involucra dinero, disponibilidad o políticas del salón (anticipos, lista de espera, garantías, bloqueo de horarios) sigue reglas exactas definidas por el negocio, nunca una interpretación libre de la inteligencia artificial. Cuando algo se sale de lo que el sistema puede resolver con confianza, se detiene y avisa de inmediato a una persona del equipo.

---

## 2. Objetivos del sistema

- **Eliminar mensajes sin respuesta.** Ninguna clienta debería quedarse esperando una contestación por horas.
- **Eliminar errores de agendamiento.** Nunca dos citas encimadas para la misma manicurista, y ningún cálculo manual erróneo de tiempo o precio en servicios complejos.
- **Dar un trato personalizado y consistente** a cada clienta, sin importar qué empleado la atienda o en qué sucursal.
- **Dar visibilidad real del negocio** a quien lo dirige: ventas, ocupación, cancelaciones, satisfacción, y desempeño por sucursal, en un solo lugar.
- **Mantener el control humano sobre decisiones sensibles.** La inteligencia artificial ayuda a conversar, pero nunca decide sola sobre precios, políticas o excepciones — siempre hay una persona con la última palabra cuando es necesario.
- **Preparar el negocio para crecer** de 3 a 4 sucursales (y más adelante) sin que la operación se vuelva más caótica a medida que crece.

---

## 3. Alcance del proyecto

Esta primera versión está diseñada específicamente para las necesidades de un salón de manicura con varias sucursales (hoy 3, con una cuarta ya prevista). Incluye:

- Atención conversacional por WhatsApp, con un número de atención propio por sucursal.
- Un panel administrativo web para el equipo (agenda, clientas, reportes, configuración).
- Todo el ciclo de una cita: desde que la clienta pregunta disponibilidad, hasta que el servicio se completa y queda registrado en su historial.

Esta versión **no** es todavía una plataforma pensada para múltiples salones o marcas distintas — está construida a la medida de este negocio, aunque de una forma que permite crecer en número de sucursales sin rediseñar nada.

---

## 4. Funcionalidades

### Agenda Inteligente
- Agendamiento por conversación natural — la clienta no necesita usar menús ni términos técnicos, describe lo que quiere con sus propias palabras.
- Cálculo automático y exacto del tiempo y el precio de cada servicio, incluyendo combinaciones específicas (por ejemplo, retirar un servicio anterior y aplicar uno nuevo, o agregar diseño solo en algunas uñas) — sin depender de que el personal recuerde manualmente cada combinación posible.
- Prevención automática de citas encimadas para la misma manicurista.
- Preferencia de manicurista: la clienta puede pedir una manicurista en particular de forma flexible, o exigirla de forma exclusiva si así lo prefiere.
- Sugerencia automática de horarios u opciones alternativas cuando no hay espacio disponible en el momento exacto solicitado.
- Manejo claro de conflictos de horario, evitando mensajes de error confusos cuando dos clientas intentan tomar el mismo espacio casi al mismo tiempo.
- Lista de espera automática para clientas que quieren que se les avise si se libera un cupo.
- Sincronización automática con Google Calendar, para que el equipo siga viendo su agenda de la forma en que ya está acostumbrado.

### Atención mediante WhatsApp e Inteligencia Artificial
- Conversación natural y cercana, sin sonar a un menú automatizado.
- Interpretación de solicitudes detalladas, incluyendo composiciones de servicio complejas por uña.
- Si la respuesta de la clienta es ambigua, el sistema pide una aclaración antes de asumir algo incorrecto, en vez de adivinar.
- Reconocimiento de clientas frecuentes, con sugerencias relevantes de servicios que suelen pedir juntos.
- Posibilidad de recibir una foto de referencia de la clienta como apoyo para definir el servicio deseado.
- Cada decisión tomada por la inteligencia artificial queda registrada — la IA interpreta el lenguaje de la clienta, pero las reglas de negocio (precios, disponibilidad, políticas) siempre las aplica el sistema de forma determinista, no la IA por su cuenta.

### Escalamiento a Personal Humano
- Cuando el sistema detecta algo que no puede resolver por sí solo (una queja, una imagen que requiere criterio humano, una nota de voz, o lenguaje inapropiado), detiene la respuesta automática de inmediato y notifica al personal.
- El personal puede tomar el control de la conversación desde el panel y devolverlo al asistente automático cuando termine.
- El sistema está diseñado para garantizar que esa alerta llegue al personal, incluso si el primer intento de aviso falla.
- Vista de conversaciones pendientes de respuesta, para que ningún mensaje se pierda sin contestar.

### Gestión de Clientas (CRM)
- Perfil completo por clienta: nombre, teléfono, sucursal y manicurista favorita, historial de visitas, servicios más solicitados y ticket promedio.
- Sistema de etiquetas personalizables (por ejemplo VIP, clienta frecuente, alergia a algún producto, pendiente de pago) para dar un trato más personalizado, sin limitarse a categorías fijas predefinidas.
- Clasificación automática de comportamiento: clienta normal, VIP, en observación por cancelaciones frecuentes, o bloqueada.
- Historial completo de conversaciones y citas por clienta, disponible para todo el equipo autorizado.

### Anticipos
- Solicitud automática de un anticipo por WhatsApp para clientas con historial de cancelaciones frecuentes, como condición para confirmar la cita en firme.
- Retención temporal del horario mientras se espera el pago, con liberación automática si no se completa a tiempo.

### Garantías
- Las clientas pueden reportar un problema con el producto aplicado dentro de los días posteriores al servicio.
- El sistema valida automáticamente que el reclamo corresponde a un servicio real, realizado a esa clienta, dentro del plazo vigente.
- Toda solicitud de garantía se envía a revisión del personal — el sistema apoya la decisión con información validada, pero nunca aprueba una garantía de forma automática sin que una persona la confirme.

### Notificaciones Automáticas
- Recordatorio automático antes de cada cita.
- Confirmación automática al momento de agendar.
- Contenido personalizable en los mensajes (por ejemplo, para incluir una cortesía o promoción vigente).

### Administración y Configuración
- Configuración de horarios, días festivos y personal por cada sucursal.
- Catálogo de servicios y precios, con posibilidad de ajustes específicos por sucursal.
- Control de accesos por rol: cada persona del equipo ve y hace únicamente lo que le corresponde según su función.
- Verificación adicional de identidad para los roles con permisos administrativos más sensibles.
- Registro histórico de cambios de configuración, acciones financieras y decisiones relevantes — incluidas las de la inteligencia artificial — para consulta y auditoría.
- Modo de mantenimiento, para pausar temporalmente la atención automática de una o todas las sucursales cuando sea necesario.

### Reportes e Indicadores
- Panel con los indicadores clave del negocio: ventas, ocupación por sucursal, citas completadas y canceladas, clientas nuevas y recurrentes, satisfacción, y costo de operación de la inteligencia artificial.
- Comparativo de desempeño entre sucursales.
- Vista del recorrido completo de una clienta, desde que inicia una conversación hasta que confirma una cita, para identificar en qué punto se pierden oportunidades.

---

## 5. Flujo completo de atención

1. **La clienta escribe por WhatsApp** al número de su sucursal — sin necesidad de ninguna aplicación adicional.
2. **El asistente conversa con ella de forma natural**, entendiendo su solicitud aunque la describa con sus propias palabras (incluyendo composiciones de servicio detalladas, como diseño solo en ciertas uñas).
3. **El sistema calcula automáticamente el tiempo y el precio exactos** de lo que pidió, y le propone opciones de horario disponibles, considerando su sucursal y, si lo pide, una manicurista en particular.
4. **Si no hay espacio en el horario exacto que pidió**, el sistema le sugiere alternativas razonables o la anota en lista de espera si así lo prefiere.
5. **La clienta confirma**, y la cita queda agendada. Si su historial lo amerita (por ejemplo, cancelaciones frecuentes), el sistema le solicita un anticipo antes de confirmar en firme.
6. **El sistema envía un recordatorio automático** antes de la cita.
7. **El día de la cita**, el equipo ve toda la información relevante en la agenda: servicio, tiempo estimado, manicurista asignada y cualquier nota relevante de la clienta.
8. **Al finalizar el servicio**, la visita queda registrada en el historial de la clienta, alimentando sus estadísticas (servicios favoritos, frecuencia, ticket promedio).
9. **Si algo sale de lo normal en cualquier punto** — una queja, una duda que el asistente no puede resolver con confianza, o una situación sensible — la conversación se detiene automáticamente y se notifica al personal para que tome el control.

---

## 6. Beneficios para el negocio

- Menos clientas perdidas por mensajes sin respuesta.
- Menos errores humanos en el cálculo de tiempo y precio de servicios complejos.
- Cero citas duplicadas o mal agendadas por la misma manicurista.
- Atención disponible fuera del horario de oficina, con la certeza de que cualquier caso delicado escala a una persona real.
- Visibilidad centralizada del desempeño de todas las sucursales, en un solo panel.
- Trato más personalizado y consistente para cada clienta, sin importar quién la atienda.
- Menos carga operativa manual y repetitiva para el equipo.
- Una base sólida para crecer a más sucursales sin perder control ni consistencia.

---

## 7. Roles del sistema

| Rol | Qué puede hacer |
|---|---|
| **Super Administrador** | Control total del sistema, incluyendo configuración crítica y activación del modo de mantenimiento. |
| **Administrador** | Gestiona configuración de sucursales, catálogo de servicios, personal y usuarios. |
| **Gerente** | Supervisa la operación de su sucursal: agenda, clientas, escalamientos y reportes. |
| **Recepcionista** | Gestiona citas, clientas y conversaciones del día a día. |
| **Manicurista** | Consulta su propia agenda y la información de sus citas asignadas. |
| **Analista** | Accede a reportes e indicadores del negocio, sin permisos de configuración. |
| **Solo lectura** | Consulta información sin posibilidad de modificar nada. |

Cada rol ve únicamente la información y las funciones que le corresponden.

---

## 8. Casos de uso principales

- Una clienta escribe por WhatsApp para agendar y el sistema identifica su intención automáticamente.
- Una clienta describe un servicio compuesto en lenguaje libre y el sistema calcula el precio y tiempo exactos, por uña.
- El sistema propone horarios disponibles según sucursal, manicurista y duración total del servicio.
- Una clienta con historial de cancelaciones recibe una solicitud de anticipo antes de que su cita quede confirmada en firme.
- Una clienta queda en lista de espera y es notificada automáticamente cuando se libera un cupo.
- El sistema envía recordatorios y confirmaciones automáticas antes de cada cita.
- El sistema reconoce a una clienta frecuente y le sugiere un servicio adicional relevante.
- El sistema detecta una imagen, una queja, una nota de voz o lenguaje inapropiado, detiene la conversación automática, crea un aviso y notifica al empleado correspondiente.
- Un empleado toma el control de una conversación escalada y responde manualmente, devolviendo el control al asistente al terminar.
- Un administrador configura horarios, servicios, precios y personal por sucursal.
- Una clienta reporta un problema con un servicio dentro del periodo de garantía, y el sistema valida automáticamente si corresponde antes de enviarlo a revisión del personal.
- Un gerente o analista consulta el panel de indicadores del negocio.

---

## 9. Lo que NO incluye

Para evitar expectativas incorrectas, esta primera versión **no** incluye:

- Procesamiento de notas de voz — el sistema detecta que se recibió un audio y lo escala directamente a una persona, no lo interpreta automáticamente.
- Integración pública con sistemas externos de punto de venta o inventario.
- Soporte para múltiples negocios o marcas distintas dentro de la misma plataforma — esta versión está construida específicamente para este salón.
- Aprobación automática de garantías sin revisión humana.
- Procesamiento de pagos en línea más allá de la gestión de anticipos por WhatsApp.
- Cambios automáticos a una cita ya confirmada sin que la clienta lo autorice explícitamente.
- Reemplazo del juicio humano en decisiones de negocio sensibles — la inteligencia artificial siempre puede escalar a una persona cuando corresponde.

---

## 10. Roadmap

**Incluido en esta versión:**
- Todo lo descrito en la sección 4 (Funcionalidades): Agenda Inteligente, Atención por WhatsApp con IA, Escalamiento a Personal, CRM, Anticipos, Garantías, Notificaciones Automáticas, Administración y Configuración, y Reportes e Indicadores.

**Identificado para versiones futuras (sujeto a definición y priorización posterior):**
- Expansión a sucursales adicionales más allá de las 4 ya previstas.
- Posible evolución hacia una plataforma que dé servicio a otros salones, si el negocio decide comercializarla.
- Integración pública con sistemas externos de punto de venta o inventario.
- Un mecanismo de respaldo para la inteligencia artificial ante una eventual caída prolongada del proveedor principal.
- Un mecanismo para notificar a una clienta si se libera un horario más conveniente antes de su cita ya confirmada, permitiéndole decidir si prefiere cambiarse — actualmente en evaluación, no incluido todavía.

---

*Documento preparado para presentación comercial. No sustituye la documentación técnica interna del proyecto.*
