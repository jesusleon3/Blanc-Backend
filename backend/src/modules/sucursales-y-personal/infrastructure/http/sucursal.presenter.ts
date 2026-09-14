import { Sucursal } from '../../domain/entities/sucursal.entity';
import { DiaFestivo } from '../../domain/entities/dia-festivo.entity';
import { Manicurista } from '../../domain/entities/manicurista.entity';

/** Traduce entidades de dominio a la forma expuesta por la API — nunca al revés. */
export function sucursalAJson(sucursal: Sucursal) {
  return {
    id: sucursal.id,
    nombre: sucursal.nombre,
    numeroWhatsappAlias: sucursal.numeroWhatsappAlias,
    horarioSemanal: sucursal.horarioSemanal.toJSON(),
    descansos: sucursal.descansos,
    enMantenimiento: sucursal.enMantenimiento,
  };
}

export function diaFestivoAJson(diaFestivo: DiaFestivo) {
  return {
    id: diaFestivo.id,
    sucursalId: diaFestivo.sucursalId,
    fecha: diaFestivo.fecha,
    descripcion: diaFestivo.descripcion,
  };
}

export function manicuristaAJson(manicurista: Manicurista) {
  return {
    id: manicurista.id,
    nombre: manicurista.nombre,
    activa: manicurista.activa,
  };
}
