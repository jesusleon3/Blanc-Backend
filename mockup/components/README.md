# components/

Los componentes reutilizables de este mockup (sidebar, navbar, tablas, badges, modales, timeline, toasts, etc.) están implementados como funciones JavaScript que generan HTML, no como archivos HTML/SVG separados — ver `js/components.js`. Esto evita duplicar marcado entre las 17 pantallas.

Esta carpeta contiene únicamente recursos de apoyo que sí conviene mantener como archivo estático:

- `logo.svg` — referencia del isotipo de marca usado en `assets/`.

Si en el futuro se agregan componentes verdaderamente estáticos (ej. una hoja de sprites de iconos exportada), este es el lugar donde deberían vivir.
