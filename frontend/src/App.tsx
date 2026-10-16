import { Navigate, Route, Routes } from 'react-router-dom';
import { ExigeRol, ExigeSesion } from './auth/guardas';
import { ROLES_DE_OPERACION, ROL_DE_MANICURISTA, rutaInicialDe } from './auth/roles';
import { useSesion } from './auth/sesion';
import { Layout } from './componentes/Layout';
import { Cargando } from './componentes/Cargando';
import { Entrar } from './paginas/entrar/Entrar';
import { Bandeja } from './paginas/bandeja/Bandeja';
import { Anticipos } from './paginas/anticipos/Anticipos';
import { Clientas } from './paginas/clientas/Clientas';
import { Agenda } from './paginas/agenda/Agenda';
import { MiAgenda } from './paginas/mi-agenda/MiAgenda';
import { SinAcceso } from './paginas/SinAcceso';

/**
 * Mapa de rutas. **Dos árboles separados, y la separación es el control de acceso.**
 *
 * - El árbol de **operación** monta `Layout`, que lleva la navegación y el contador de escaladas.
 *   Está envuelto en `ExigeRol(ROLES_DE_OPERACION)`, así que la Manicurista **nunca llega a
 *   montarlo**: no hay forma de que vea un enlace a la Bandeja o a Clientas aunque alguien se
 *   equivoque editando el layout.
 * - El árbol de la **Manicurista** (`/mi-agenda`) tiene su propio marco, sin enlaces ni contador
 *   (`DEC-040`: su vista no transporta PII ni señales de riesgo).
 *
 * Es más código que un layout compartido con condicionales de rol, y es la razón de hacerlo así:
 * **ocultar enlaces con `if` dentro de un marco común es la forma habitual de que un día se filtre
 * uno.** Aquí la separación es estructural.
 *
 * Y vale la pena repetirlo porque es la regla 1 de `ADR-027`: esto decide **qué se dibuja**. La
 * autorización está en el `@Roles` de cada endpoint, que revalida contra los permisos resueltos en
 * el servidor.
 */
export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />

      {/* Operación: Dueña, Super Admin y Encargada. */}
      <Route
        element={
          <ExigeRol roles={ROLES_DE_OPERACION}>
            <Layout />
          </ExigeRol>
        }
      >
        <Route path="/bandeja" element={<Bandeja />} />
        <Route path="/anticipos" element={<Anticipos />} />
        <Route path="/clientas" element={<Clientas />} />
        <Route path="/agenda" element={<Agenda />} />
      </Route>

      {/* Manicurista: su propio marco, sin navegación ni contador. */}
      <Route
        path="/mi-agenda"
        element={
          <ExigeRol roles={[ROL_DE_MANICURISTA]}>
            <MiAgenda />
          </ExigeRol>
        }
      />

      <Route
        path="/sin-acceso"
        element={
          <ExigeSesion>
            <SinAcceso />
          </ExigeSesion>
        }
      />

      <Route path="*" element={<Raiz />} />
    </Routes>
  );
}

/**
 * Dónde aterriza quien entra por `/` o por una ruta que no existe.
 *
 * No es un `Navigate` fijo: el destino **depende del rol**, y el rol llega de `/yo` de forma
 * asíncrona. Redirigir antes de tenerlo mandaría a la Manicurista a `/bandeja` por un instante.
 */
function Raiz() {
  const { estado, perfil } = useSesion();

  if (estado === 'cargando') return <Cargando mensaje="Restaurando tu sesión…" />;
  if (estado !== 'activa' || !perfil) return <Navigate to="/entrar" replace />;
  return <Navigate to={rutaInicialDe(perfil.rol)} replace />;
}
