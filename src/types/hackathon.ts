import EstadoInscripcion from './enums/estado-inscripcion';
import EstadoUsuario from './enums/estado-usuario';
import FaseHackathon from './enums/fase-hackathon';
import TipoTokenUsuario from './enums/tipo-token-usuario';

export interface Usuario {
  id: string;
  correo: string;
  hashContrasena: string;
  nombre: string;
  github: string | null;
  linkedin: string | null;
  portafolio: string | null;
  estado: EstadoUsuario;
  correoVerificadoEn: Date | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface Hackathon {
  id: string;
  nombre: string;
  descripcion: string;
  modalidad: string;
  lugar: string;
  zonaHoraria: string;
  cupoMaximo: number | null;
  equipoMin: number;
  equipoMax: number;
  faseActual: FaseHackathon;
  versionReglamento: string;
  finalistasPorCategoria: number;
  creadoEn: Date;
}

export interface Inscripcion {
  id: string;
  usuarioId: string;
  hackathonId: string;
  estado: EstadoInscripcion;
  institucion: string;
  programa: string;
  semestre: number;
  reglamentoVersion: string;
  datosVersion: string;
  aceptadoEn: Date;
  consientePublicacionImagen: boolean;
  creadoEn: Date;
}

export interface TokenUsuario {
  id: string;
  usuarioId: string;
  tipo: TipoTokenUsuario;
  hashToken: string;
  expiraEn: Date;
  usadoEn: Date | null;
  creadoEn: Date;
}

export interface EventoPublico {
  id: string;
  nombre: string;
  descripcion: string;
  modalidad: string;
  lugar: string;
  zonaHoraria: string;
  equipoMin: number;
  equipoMax: number;
  faseActual: FaseHackathon;
  inscripcionesAbiertas: boolean;
  versionReglamento: string;
  versionAutorizacionDatos: string;
}

export interface CrearUsuarioData {
  correo: string;
  hashContrasena: string;
  nombre: string;
  github?: string;
  linkedin?: string;
  portafolio?: string;
}

export interface CrearInscripcionData {
  usuarioId: string;
  hackathonId: string;
  institucion: string;
  programa: string;
  semestre: number;
  reglamentoVersion: string;
  datosVersion: string;
  consientePublicacionImagen: boolean;
}

export interface ResultadoInscripcion {
  inscripcionId: string;
  estado: EstadoInscripcion;
  correoVerificado: boolean;
}
