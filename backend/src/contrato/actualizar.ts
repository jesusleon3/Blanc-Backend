import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { construirContrato, RUTA_DEL_CONTRATO } from './construir-contrato';

/**
 * `npm run contrato:actualizar` — regenera `contratos/api-v1.json` desde el código.
 *
 * **Se ejecuta a mano y a propósito.** Es el punto del diseño: un cambio de ruta, de rol o de
 * campo de respuesta **tiene que** pasar por este comando, y entonces aparece en el diff de un
 * commit donde alguien lo ve. Si la prueba lo regenerara sola, la deriva volvería a ser silenciosa
 * — que es exactamente la deuda que `ADR-027` registró y que `P8` cierra.
 */
const destino = join(__dirname, '..', '..', '..', RUTA_DEL_CONTRATO);
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, `${JSON.stringify(construirContrato(), null, 2)}\n`);

// eslint-disable-next-line no-console
console.log(`Contrato regenerado en ${RUTA_DEL_CONTRATO}. Revisa el diff: cada línea que cambie es un cambio de contrato.`);
