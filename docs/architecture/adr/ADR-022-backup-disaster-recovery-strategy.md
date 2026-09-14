# ADR-022

## Title
Estrategia de Backup, Disaster Recovery y Retención de Datos (ADR agregado — no estaba en la lista original)

## Status
Proposed — **provisional, pendiente de confirmación de negocio de RPO/RTO y del marco regulatorio de datos personales**

## Context
El cliente pidió explícitamente backups como parte de su inversión en seguridad, pero el Domain Discovery no obtuvo una respuesta formal de negocio sobre el nivel de tolerancia a pérdida de datos (RPO) ni de tiempo de recuperación aceptable (RTO) ante un incidente. Blanc es, para cada sucursal, el único canal de agendamiento — una pérdida de datos o una indisponibilidad prolongada tiene impacto de negocio directo e inmediato.

## Problem Statement
¿Con qué frecuencia se respaldan los datos, cuánto tiempo de inactividad es aceptable ante un desastre, y por cuánto tiempo se retienen distintos tipos de datos (financieros/auditoría vs. conversacionales/multimedia) — en ausencia de una definición de negocio formal?

## Constraints
- El sistema es el único canal de agendamiento por sucursal — no hay proceso manual de respaldo declarado.
- Existen datos con distinto perfil de sensibilidad y de necesidad de retención: registros financieros/auditoría (con valor probatorio ante disputas) vs. imágenes/conversaciones (sujetas a minimización de datos personales, ADR-017).
- No existe una definición de negocio confirmada de RPO/RTO — este ADR debe proponer un valor por defecto razonable, no dejarlo indefinido.
- Un backup que nunca se prueba a restaurar no es una estrategia de recuperación real, es una suposición.

## Options Considered

| Opción | Descripción |
|---|---|
| A. Backups periódicos sin objetivo de RPO/RTO explícito ni prueba de restauración | Se hacen copias de seguridad, pero sin un objetivo medible ni verificación de que funcionan. |
| B. RPO/RTO conservador por defecto (a confirmar con negocio), con prueba de restauración periódica obligatoria y retención diferenciada por clase de dato | Objetivos explícitos y verificables, con manejo diferenciado entre datos financieros/auditoría y datos conversacionales/multimedia. |
| C. Replicación en tiempo real multi-región con RPO cercano a cero | Infraestructura de alta disponibilidad geográfica. |

## Decision
Se adopta la **Opción B**, con los siguientes valores **por defecto, provisionales, sujetos a confirmación explícita del cliente**:
- **RPO objetivo: ≤ 15 minutos** (backups/registro continuo de cambios frecuente, no solo una copia diaria).
- **RTO objetivo: ≤ 4 horas** durante horario comercial.
- **Restauración probada periódicamente** de forma real (no solo verificar que el archivo de backup existe) — consistente con el principio de seguridad ya establecido.
- **Retención diferenciada por clase de dato**: registros financieros y de auditoría (ADR-010) con retención más larga dado su valor probatorio ante una disputa; imágenes y contenido conversacional con retención más acotada por defecto, alineado con el principio de minimización de datos personales (ADR-017), ajustable cuando se confirme el marco regulatorio (Domain Discovery, pregunta abierta #12).

## Consequences
Se establece un objetivo medible y verificable de recuperación ante desastre en ausencia de una definición de negocio formal, a cambio de que estos valores deban tratarse explícitamente como provisionales hasta que el cliente los confirme o ajuste.

### Positive Consequences
- Da un objetivo concreto y verificable (no solo "hacemos backups") sobre el cual diseñar la infraestructura técnica en la fase siguiente.
- La prueba de restauración periódica obligatoria evita el escenario, común en la industria, de backups que existen pero nunca se ha comprobado que funcionan.
- La retención diferenciada por clase de dato alinea la estrategia de backup con el principio de minimización de datos personales ya adoptado, en vez de tratarlo como una decisión aislada.

### Negative Consequences
- Los valores de RPO/RTO propuestos son un supuesto de arquitecto, no una cifra confirmada por el negocio — implementar contra un objetivo equivocado (muy conservador o insuficiente) tiene costo real en cualquier dirección.
- Backups más frecuentes (RPO de 15 minutos) tienen mayor costo de infraestructura y de almacenamiento que backups diarios.
- La retención diferenciada por clase de dato añade complejidad operativa de gestión de ciclo de vida de datos, en vez de una política única simple.

## Risks
- **Este ADR resuelve una ausencia de definición de negocio con un supuesto de arquitecto, no con una confirmación real**: es, junto con ADR-006, uno de los ADR de este documento con mayor riesgo de estar calibrado incorrectamente si el negocio tiene una tolerancia distinta (mayor o menor) a la pérdida de datos o al tiempo de inactividad. Debe confirmarse explícitamente, no asumirse como aprobado por defecto.
- **Retención diferenciada mal calibrada** si el marco regulatorio de datos personales (pendiente) exige plazos distintos a los asumidos aquí: mitigado por marcar explícitamente esta política como ajustable, no fija.
- **Prueba de restauración costosa de mantener disciplinada** en un equipo pequeño: mitigado incorporándola como parte del calendario operativo recurrente, no como una tarea "cuando haya tiempo".

## Alternatives Rejected
- **Backups sin objetivo ni prueba de restauración**: rechazada. No cumple con el nivel de inversión en seguridad que el cliente pidió explícitamente, y dejaría la capacidad real de recuperación como una suposición no verificada — inaceptable para un sistema que es el único canal de agendamiento del negocio.
- **Replicación multi-región en tiempo real (RPO casi cero)**: rechazada por ahora. Es una inversión de infraestructura desproporcionada frente a la escala real del proyecto (un cliente, 3–4 sucursales) — viola el principio de simplicidad proporcional. El RPO de 15 minutos propuesto ya es conservador para el perfil de riesgo real sin requerir infraestructura multi-región.

## Future Revisit Criteria
- **Confirmación explícita del cliente de los objetivos de RPO/RTO** — este es el ADR de mayor prioridad de validación de negocio de todo el conjunto, junto con ADR-006 y ADR-008.
- Se confirma el marco regulatorio de protección de datos aplicable (Domain Discovery, pregunta abierta #12), lo cual puede modificar los plazos de retención asumidos aquí.
- Un incidente real de pérdida de datos o indisponibilidad revela que los objetivos definidos aquí no eran adecuados para el impacto de negocio real observado.
