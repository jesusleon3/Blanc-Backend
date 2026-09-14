# Categoría: Reportes / Analítica (`RN-REP`)

> Gobierna la fidelidad y transparencia de los indicadores mostrados en el dashboard. Categoría de menor prioridad relativa dentro del repositorio, sin invariantes financieros o de integridad directos.

---

### RN-REP-01 — Indicadores reflejan operación real

| Campo | Valor |
|---|---|
| Rule ID | RN-REP-01 |
| Nombre | Los indicadores reflejan operación real, nunca cifras estimadas manualmente |
| Objetivo | Mantener la confianza del negocio en el dashboard como fuente de verdad de su propio desempeño. |
| Descripción | Los indicadores del panel reflejan información real derivada de la operación (citas, conversaciones, clientas) de cada sucursal, no cifras fijas o estimadas manualmente. |
| Categoría | Reportes / Analítica |
| Alcance | Global |
| Disparador | Consulta del dashboard por cualquier rol con acceso. |
| Precondiciones | Existen eventos de dominio ya producidos por los demás Bounded Contexts. |
| Entradas requeridas | Eventos de dominio de Agenda, Conversación, CRM y demás contextos. |
| Lógica de negocio | Todo indicador se calcula a partir de datos reales de operación, nunca de un valor fijo hardcodeado. |
| Resultado esperado | El dashboard refleja fielmente el estado real del negocio, con el rezago aceptado por CQRS-lite. |
| Ejemplos | La función `metrics(sucursalId)` del mockup recalcula KPIs a partir de citas, conversaciones y clientas reales filtradas por sucursal, en vez de usar un objeto fijo. |
| Excepciones | Los indicadores pueden reflejar un ligero retraso respecto al momento exacto en que ocurrió un evento (rezago de hasta 15 minutos, ADR-003/`03-technical-architecture.md` §6.3). |
| Prioridad | Low |
| Consumidores | Dashboard, Gerente, Analista |
| Dependencias | Depende de: RN-AGE-01, RN-CRM-02, RN-CONV-04 |
| Fuente | `01-domain-discovery.md` §5.9 |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |

---

### RN-REP-02 — Costo de IA con el mismo detalle que indicadores de negocio

| Campo | Valor |
|---|---|
| Rule ID | RN-REP-02 |
| Nombre | Transparencia unificada del costo de IA |
| Objetivo | Evitar que el costo de operar la inteligencia artificial quede oculto o separado del resto de la operación del negocio. |
| Descripción | El costo de operación de la inteligencia artificial se reporta con el mismo nivel de detalle que los indicadores de negocio, no de forma separada. |
| Categoría | Reportes / Analítica |
| Alcance | Global |
| Disparador | Consulta del dashboard. |
| Precondiciones | Existen registros de costo/tokens de IA (`RN-CONV-04`). |
| Entradas requeridas | Costo y tokens consumidos por conversación. |
| Lógica de negocio | El costo de IA se agrega y se muestra junto a los demás indicadores de negocio, con el mismo nivel de detalle y frecuencia. |
| Resultado esperado | La dueña o gerente puede ver el costo de IA junto al resto de indicadores, sin reportes separados. |
| Ejemplos | `kpis.costoIAMes`, `kpis.tokensConsumidosMes` en el mockup, mostrados junto a ventas y ocupación. |
| Excepciones | Ninguna conocida. |
| Prioridad | Low |
| Consumidores | Dashboard, Gerente, Analista |
| Dependencias | Depende de: RN-CONV-04 |
| Fuente | `01-domain-discovery.md` (principio de observabilidad de negocio y técnica unificada) |
| Estado | Aprobada |
| Versión | 1 |
| Fecha de aprobación | No registrada |
| Notas | — |
