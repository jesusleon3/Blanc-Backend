# Blanc — Requisitos de Negocio (Fuente Oficial)

> **Estado:** Fuente oficial de requisitos funcionales y no funcionales, según instrucción explícita del cliente (2026-07-07).
> Este documento es la transcripción organizada del descubrimiento de negocio. No debe reinterpretarse ni "mejorarse" libremente — cualquier cambio de interpretación debe registrarse en `docs/architecture/` con su justificación, y las ambigüedades detectadas se listan en `01-domain-discovery.md`.

## Contexto general

- Cliente: **Blanc**, salón de manicura/uñas.
- **3 sucursales activas**, cada una con su **propio número de WhatsApp**. Se planea una 4ª sucursal en el corto plazo; una 5ª es incierta.
- Sistema **de un solo cliente** (no multiempresa / no SaaS multi-tenant).
- Canal exclusivo de agendamiento: **WhatsApp**. Instagram y TikTok son solo de marketing/atracción, no agendan citas.

## Negocio

1. Cada sucursal tiene su propio número de WhatsApp (3 actualmente).
2. Sistema exclusivo para este cliente, no multiempresa.
3. Crecimiento previsto: de 3 a 4 sucursales en el corto plazo; una 5ª es incierta.
4. Las citas llegan únicamente por WhatsApp.
5. Se cobran anticipos **solo** a clientas marcadas en **"lista roja"** (cancelan con frecuencia).
6. Los clientes pueden cancelar/reprogramar solos, **excepto** los de lista roja, que requieren confirmación de un empleado.
7. Debe existir lista de espera.

## Agenda

8. **Google Calendar** se mantiene como la vista visual del negocio (organizado por colores). La plataforma **sincroniza con** Google Calendar. *(Nota: el consultor recomienda que la plataforma sea la fuente de verdad por escalabilidad; el cliente no confirmó explícitamente cuál sistema gana en caso de conflicto — ver Preguntas Abiertas en el Domain Discovery).*
9. No hay calendario por manicurista; se maneja por calendario/color específico por sucursal.
10. Una manicurista atiende **un solo servicio a la vez**.
11. Puede haber citas **sin manicurista asignada** (clientas sin preferencia).
12. Se pueden bloquear horarios.
13. Existen días festivos: no se agenda en esos días.
14. Horario único para todas las sucursales:
    - Sábado: 9:00–15:00
    - Domingo: cerrado
    - Lunes a viernes: 9:00–13:00 y 15:00–19:00
15. Descansos: lunes a viernes de 13:00 a 15:00. Sábado es horario corrido (sin descanso).

## Servicios

Ejemplos de servicios: Gelish, Retiro, Diseño, Pedicure, Acrílico, Reparación, Nail Art.
Cada servicio tiene: duración, precio, categoría.

16. El sistema debe interpretar lenguaje natural como *"Quiero gelish en las manos y dos uñas con diseño francés y una con piedras"* y calcular automáticamente tiempo y precio. **Sí.**
17. Cada diseño agrega minutos de forma diferenciada (ej. diseño sencillo +10 min, diseño complejo +30 min). **Sí.**
18. No hay servicios incompatibles.
19. No hay promociones.

## IA

20. GPT se usa **únicamente** para entender intención y sostener conversación. **Toda la lógica de negocio vive en código**, no en el LLM.
21. Debe recordar conversaciones anteriores. **Sí.**
22. Debe reconocer clientes frecuentes. **Sí.**
23. Debe sugerir venta adicional (ej. "veo que siempre pide pedicure, ¿desea agregarlo?"). **Sí.**
24. Debe detectar clientes molestos. **Sí.**
25. Debe detectar intención de cancelar. **Sí.**
26. No debe responder audios (por ahora).
27. Debe leer imágenes (ej. foto de referencia de uñas). **Sí.**
28. No debe generar cotizaciones desde imágenes (por ahora).

## Conversación (tono)

29. Respuestas **cortas**.
30. **Sin emojis.**
31. Debe escribir como una recepcionista.
32. **No** debe cometer errores humanos simulados (nada de "Claro 😊", "...", "Déjame revisar" como relleno artificial).

## Escalamiento humano

Disparadores de escalamiento: imagen, audio complicado, queja, palabra prohibida.
Al escalar, el bot debe: detener IA, crear ticket, notificar empleado, permitir continuar manualmente.

33. Notificación al empleado: **vía WhatsApp**.
34. El humano debe poder tomar control y seguir escribiendo **desde la plataforma**.
35. El control puede devolverse al bot mediante **acción explícita** del humano.

## CRM

Campos por contacto: etiquetas, última visita, servicios favoritos, ticket promedio, cumpleaños, sucursal favorita, manicurista favorita, notas internas, bloqueado, VIP.

36. No se quieren campañas por WhatsApp.
37. Sí, recordatorios automáticos.
38. Sí, confirmación automática.
39. No, mensajes de cumpleaños (el dato se guarda pero no dispara mensajes automáticos).

## Usuarios y roles

Roles propuestos: Super Admin, Administrador, Gerente, Recepcionista, Manicurista, Analista, Solo lectura.

40. Las manicuristas pueden ver las citas de todas (no solo las propias), porque hoy las consultan vía Google Calendar.

## Dashboard (estilo Stripe)

KPIs deseados: conversaciones, tiempo de respuesta, IA vs. Humano, ventas, servicios más vendidos, horas ocupadas, cancelaciones, clientes nuevos, clientes recurrentes, tiempo promedio, conversaciones activas, embudo, satisfacción, costo IA, tokens consumidos.

## Seguridad (inversión alta declarada)

RBAC, JWT, Refresh Tokens, MFA, auditoría, historial, versionado, rate limit, logs, encriptación, backups, monitoreo, alertas, secrets manager.

## Funcionalidades adicionales propuestas por el cliente

- Historial completo de conversaciones.
- Reagendado inteligente.
- Confirmación automática 24 horas antes.
- Lista de espera automática.
- Recomendación de horarios libres.
- Predicción de cancelaciones.
- Sugerencias de venta cruzada.
- Detección de clientes VIP.
- Análisis de sentimientos.
- Grabación de todas las decisiones de la IA (trazabilidad/auditoría de IA).
- Modo mantenimiento para detener uno o todos los bots.
- Entorno sandbox para probar cambios antes de publicar.
- Configuración editable por sucursal (horarios, servicios, precios, personal).
- Panel para entrenar al bot con respuestas frecuentes sin programar.
- Versionado de prompts con posibilidad de revertir.
- API pública para integración futura con sistemas POS/inventario.

## Referencia: stack técnico propuesto por el cliente

> **Sin validar arquitectónicamente todavía.** Se registra aquí solo como insumo de referencia para la fase de arquitectura técnica (posterior al Domain Discovery). No debe asumirse como decisión final.

- Frontend: Next.js 15, TypeScript, Tailwind, shadcn/ui
- Backend: NestJS, TypeScript
- Base de datos: PostgreSQL (Supabase)
- ORM: Prisma
- Cache: Redis
- Cola: BullMQ
- Realtime: Supabase Realtime
- Storage: Supabase Storage
- Autenticación: Supabase Auth
- IA: OpenAI Responses API
- WhatsApp: Evolution API
- Calendario: Google Calendar API
- Hosting: Railway
- Observabilidad: OpenTelemetry, Grafana, Loki
- CI/CD: GitHub Actions

## Enfoque de trabajo acordado

El cliente solicitó explícitamente: no pedir a Claude Code que "construya la plataforma" directamente. Primero generar un documento completo de arquitectura (PRD + arquitectura técnica + modelo de datos + backlog + diseño de APIs + estrategia de IA + plan de desarrollo), aprobarlo, y luego implementar por sprints bien definidos.
