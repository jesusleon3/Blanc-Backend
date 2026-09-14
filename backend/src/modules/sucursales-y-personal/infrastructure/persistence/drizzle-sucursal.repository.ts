import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Database } from '../../../../database/connection';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { diasFestivos, sucursales } from '../../../../database/schema';
import { Sucursal } from '../../domain/entities/sucursal.entity';
import { DiaFestivo } from '../../domain/entities/dia-festivo.entity';
import { SucursalRepository } from '../../domain/ports/sucursal.repository';
import { HorarioSemanal, HorarioSemanalData } from '../../domain/value-objects/horario-semanal.vo';
import { TransactionContext } from '../../../../shared/persistence/transaction-context';
import { esViolacionDeUnicidad } from '../../../../shared/errors/postgres-error';
import { ConflictoDeNegocioError } from '../../../../shared/errors/domain-error';

@Injectable()
export class DrizzleSucursalRepository implements SucursalRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly dbPorDefecto: Database) {}

  /** Si hay una transacción activa (`UnitOfWork.ejecutar`), usarla — si no, la conexión de siempre. */
  private get db(): Database {
    return TransactionContext.obtenerConexionActiva() ?? this.dbPorDefecto;
  }

  async guardar(sucursal: Sucursal): Promise<void> {
    try {
      await this.db
        .insert(sucursales)
        .values({
          id: sucursal.id,
          nombre: sucursal.nombre,
          numeroWhatsappAlias: sucursal.numeroWhatsappAlias,
          horarioSemanal: sucursal.horarioSemanal.toJSON(),
          descansos: sucursal.descansos,
          enMantenimiento: sucursal.enMantenimiento,
          actualizadoEn: new Date(),
        })
        .onConflictDoUpdate({
          target: sucursales.id,
          set: {
            nombre: sucursal.nombre,
            numeroWhatsappAlias: sucursal.numeroWhatsappAlias,
            horarioSemanal: sucursal.horarioSemanal.toJSON(),
            descansos: sucursal.descansos,
            enMantenimiento: sucursal.enMantenimiento,
            actualizadoEn: new Date(),
          },
        });
    } catch (error) {
      // `onConflictDoUpdate` solo cubre conflictos en `id` (upsert) — un choque en la restricción
      // UNIQUE de `nombre` (una entidad distinta con el mismo nombre) sigue llegando aquí crudo.
      // El caso de uso ya valida esto antes (`CrearSucursalUseCase.buscarPorNombre`); este catch
      // es el backstop de la base de datos contra la misma condición de carrera (TOCTOU).
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictoDeNegocioError('SUCURSAL_NOMBRE_DUPLICADO', `Ya existe una sucursal con el nombre "${sucursal.nombre}".`, {
          nombre: sucursal.nombre,
        });
      }
      throw error;
    }
  }

  async buscarPorId(id: string): Promise<Sucursal | null> {
    const filas = await this.db.select().from(sucursales).where(eq(sucursales.id, id)).limit(1);
    if (filas.length === 0) return null;
    return this.aEntidad(filas[0]);
  }

  async buscarPorNombre(nombre: string): Promise<Sucursal | null> {
    const filas = await this.db.select().from(sucursales).where(eq(sucursales.nombre, nombre)).limit(1);
    if (filas.length === 0) return null;
    return this.aEntidad(filas[0]);
  }

  async listar(): Promise<Sucursal[]> {
    const filas = await this.db.select().from(sucursales);
    return filas.map((fila) => this.aEntidad(fila));
  }

  async agregarDiaFestivo(diaFestivo: DiaFestivo): Promise<void> {
    await this.db.insert(diasFestivos).values({
      id: diaFestivo.id,
      sucursalId: diaFestivo.sucursalId,
      fecha: diaFestivo.fecha,
      descripcion: diaFestivo.descripcion,
    });
  }

  async listarDiasFestivos(sucursalId: string): Promise<DiaFestivo[]> {
    const filas = await this.db.select().from(diasFestivos).where(eq(diasFestivos.sucursalId, sucursalId));
    return filas.map((fila) =>
      DiaFestivo.reconstruir({ id: fila.id, sucursalId: fila.sucursalId, fecha: fila.fecha, descripcion: fila.descripcion }),
    );
  }

  async buscarDiaFestivoPorId(id: string): Promise<DiaFestivo | null> {
    const filas = await this.db.select().from(diasFestivos).where(eq(diasFestivos.id, id)).limit(1);
    if (filas.length === 0) return null;
    const fila = filas[0];
    return DiaFestivo.reconstruir({ id: fila.id, sucursalId: fila.sucursalId, fecha: fila.fecha, descripcion: fila.descripcion });
  }

  async eliminarDiaFestivo(id: string): Promise<void> {
    await this.db.delete(diasFestivos).where(eq(diasFestivos.id, id));
  }

  private aEntidad(fila: typeof sucursales.$inferSelect): Sucursal {
    return Sucursal.reconstruir({
      id: fila.id,
      nombre: fila.nombre,
      numeroWhatsappAlias: fila.numeroWhatsappAlias,
      horarioSemanal: HorarioSemanal.crear(fila.horarioSemanal as HorarioSemanalData),
      descansos: fila.descansos,
      enMantenimiento: fila.enMantenimiento,
    });
  }
}
