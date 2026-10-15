export const PROVEEDOR_WHATSAPP_PORT = 'PROVEEDOR_WHATSAPP_PORT';

export interface EnvioDeTexto {
  phoneNumberId: string;
  telefonoDestino: string;
  texto: string;
}

export interface EnvioDePlantilla {
  phoneNumberId: string;
  telefonoDestino: string;
  /** Nombre de la plantilla **ya aprobada por Meta**. El inventario es `N-14`, aún sin cerrar. */
  plantilla: string;
  /** Idioma de la plantilla, p. ej. `es_MX`. */
  idioma: string;
  /** Variables, en el orden en que la plantilla las declara. */
  parametros: string[];
}

export interface ResultadoDeEnvio {
  /** Id que asigna Meta. Se guarda para poder correlacionar los estados de entrega. */
  wamid: string;
}

/**
 * Puerto de **salida** hacia la Cloud API de Meta (`DEC-043`, `ADR-008` Enmienda 1).
 *
 * ## POR QUÉ DOS MÉTODOS Y NO UNO CON UNA BANDERA
 *
 * Texto libre y plantilla **no son dos variantes de lo mismo**: tienen precondiciones distintas
 * (`N-14`: el texto libre exige ventana de 24 h abierta, la plantilla no), coste distinto (la
 * plantilla se cobra) y forma distinta (la plantilla lleva nombre, idioma y parámetros, no texto).
 * Un método con una bandera habría permitido llamar al caso prohibido sin que el tipo lo impidiera.
 *
 * ⚠️ **Lo invoca el dominio DESPUÉS de validar la ventana**, nunca antes. Descubrir que la ventana
 * estaba cerrada por el error de Meta significa haber gastado la petición y devolverle al operador
 * un fallo genérico de API en lugar de una instrucción accionable.
 *
 * **Se invoca FUERA de la transacción.** Es una llamada de red, y un mensaje enviado no se deshace
 * con un `ROLLBACK`: si la transacción fallara después, la clienta ya tendría el mensaje.
 */
export interface ProveedorWhatsAppPort {
  enviarTexto(envio: EnvioDeTexto): Promise<ResultadoDeEnvio>;
  enviarPlantilla(envio: EnvioDePlantilla): Promise<ResultadoDeEnvio>;
}
