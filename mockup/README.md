# Blanc — Mockup comercial (solo visual)

> **Esto no es la aplicación.** Es un prototipo navegable en HTML/CSS/JS vanilla, sin backend, sin base de datos y sin autenticación real, cuyo único propósito es **demostrar visualmente el producto a un cliente potencial**.

## Qué es y qué no es

- **Es:** una demo de alta fidelidad, con datos 100% ficticios, pensada para enseñarse en una reunión comercial o una llamada de ventas.
- **No es:** el sistema real. No implementa lógica de negocio, no persiste datos entre sesiones (recargar la página reinicia el estado), no tiene backend, API ni base de datos, y no debe usarse como referencia de cómo se va a construir el producto.
- **Se puede borrar por completo** (`rm -rf mockup/`) sin afectar ningún otro archivo del proyecto. No hay ninguna dependencia cruzada entre este mockup y `docs/`.

## De dónde sale el contenido

Cada pantalla, entidad y estado que aparece aquí se derivó **exclusivamente** de:

- `docs/architecture/01-domain-discovery.md` — entidades, aggregates, estados y Bounded Contexts.
- Los 22 ADRs en `docs/architecture/adr/` — decisiones ya congeladas (ej. ADR-016 Human Handoff, ADR-015 estrategia de prompts, ADR-020 feature flags/modo mantenimiento).

No se inventaron módulos ni funcionalidades fuera de lo ya documentado. Donde un flujo aparece en el Domain Discovery como **Pregunta Abierta sin resolver** (ej. si la confirmación es push o interactiva, Pregunta #17), este mockup usa un dato o comportamiento simulado únicamente con fines visuales — esa ambigüedad sigue sin resolverse en el modelo real y deberá decidirse en la fase de arquitectura técnica, no aquí.

## Mapa de pantallas → dominio

| Pantalla | Bounded Context / origen |
|---|---|
| `index.html` (login) | Identidad y Accesos (5.8) |
| `dashboard.html`, `analytics.html` | Analítica (5.9) + KPIs del documento de requisitos |
| `agenda.html`, `cita-nueva.html`, `cita-detalle.html` | Agenda (5.1) |
| `lista-espera.html` | Agenda — `ListaDeEsperaEntrada` (5.1) |
| `conversaciones.html`, `chat.html` | Conversación (5.3) |
| `escalamientos.html`, panel de handoff en `chat.html` | Escalamiento (5.4) + ADR-016 |
| `crm.html`, `clienta-perfil.html`, `lista-roja.html` | Clientas / CRM (5.5) |
| `anticipos.html` | Anticipos (5.6) |
| `notificaciones.html` | Notificaciones (5.12) |
| `historial.html` | Auditoría / decisiones de IA (principio "IA interpreta, no decide") |
| `configuracion.html` | Sucursales y Personal (5.7), Catálogo (5.2), Identidad (5.8), ADR-015, ADR-020 |
| `panel-empleado.html` | Vista operativa diaria (casos de uso de escalamiento y agenda) |

## Cómo verlo

El mockup ahora es también una **PWA instalable y 100% funcional offline**
(ver `MOBILE.md` para el detalle completo, incluyendo Android e iPhone).
Eso trae un requisito importante:

**Siempre sirve la carpeta con un servidor estático local — nunca abras los
archivos con doble clic (`file://`).** El Service Worker que habilita el
modo offline no puede registrarse bajo `file://` (es una restricción de
seguridad de todos los navegadores), así que abrirlo así pierde el soporte
offline y puede comportarse de forma inconsistente en móvil.

```
cd mockup
python3 -m http.server 8080
```

y abrir `http://localhost:8080`. Para instalarlo en un teléfono (Android o
iPhone) desde la misma red Wi-Fi, ver `MOBILE.md`.

## Estructura

```
mockup/
├── index.html            # Login (punto de entrada)
├── README.md             # Este archivo
├── MOBILE.md             # Cómo abrir/instalar el mockup en escritorio, Android e iPhone
├── manifest.json         # Manifest de la PWA (íconos, nombre, tema, modo standalone)
├── service-worker.js     # Cache offline (precache de todo el mockup, sin backend)
├── css/                  # tokens.css (design tokens, light/dark), base.css, components.css, screens.css
├── js/                   # data.js (dataset falso), utils.js, icons.js, components.js, app.js, pwa.js (registro del SW + feedback táctil)
├── screens/              # Las 17 pantallas internas
├── components/           # Recursos de componentes estáticos (iconografía)
├── assets/               # logo.svg y assets/icons/ (íconos PNG de la PWA para Android/iOS)
├── images/               # Vacío — los avatares y gráficos se generan por CSS/JS, sin binarios externos
```

## Siguientes pasos del proyecto

Este mockup **no** es la base de la implementación. El proyecto técnico continúa desde donde ya estaba antes de este mockup:

- `docs/architecture/01-domain-discovery.md` (modelo de dominio, ya auditado y cerrado)
- `docs/architecture/02-architecture-principles.md`
- `docs/architecture/ADR_INDEX.md` y los 22 ADRs
- `docs/architecture/ARCHITECTURE_REVIEW.md` y `DOMAIN_MODEL_REVIEW.md`

El siguiente documento a producir sigue siendo `03-technical-architecture.md`, tal como ya se había planeado — este mockup no cambia ni adelanta ninguna decisión de arquitectura técnica.
