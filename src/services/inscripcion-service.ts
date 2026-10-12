import Database from '../lib/database';
import CustomError from '../types/custom-error';
import { Errors } from '../constants/responses';
import { VERSION_AUTORIZACION_DATOS } from '../constants/hackathon';
import { env } from '../config/env';
import { hashPassword } from '../lib/hash';
import { mailer } from '../lib/mailer';
import { emailVerificationMessage } from '../lib/mail-templates';
import { generateRefreshToken, hashRefreshToken } from '../lib/refresh-token';
import FaseHackathon from '../types/enums/fase-hackathon';
import TipoTokenUsuario from '../types/enums/tipo-token-usuario';
import HackathonRepo from '../repositories/hackathon-repo';
import InscripcionRepo from '../repositories/inscripcion-repo';
import TokenUsuarioRepo from '../repositories/token-usuario-repo';
import UsuarioRepo from '../repositories/usuario-repo';
import { EventoPublico, Hackathon, ResultadoInscripcion, Usuario } from '../types/hackathon';
import type { RegistroInscripcionInput } from '../types/inputs';
import EstadoUsuario from '../types/enums/estado-usuario';

const HOUR_MS = 60 * 60 * 1000;

const esFaseOculta = (fase: FaseHackathon) => fase === FaseHackathon.Borrador || fase === FaseHackathon.Cancelado;

const esViolacionDeCorreoUnico = (error: unknown) => {
  const { code, constraint } = error as { code?: string; constraint?: string };
  return code === '23505' && Boolean(constraint?.includes('correo'));
};

const aEventoPublico = (hackathon: Hackathon): EventoPublico => ({
  id: hackathon.id,
  nombre: hackathon.nombre,
  descripcion: hackathon.descripcion,
  modalidad: hackathon.modalidad,
  lugar: hackathon.lugar,
  zonaHoraria: hackathon.zonaHoraria,
  equipoMin: hackathon.equipoMin,
  equipoMax: hackathon.equipoMax,
  faseActual: hackathon.faseActual,
  inscripcionesAbiertas: hackathon.faseActual === FaseHackathon.Inscripciones,
  versionReglamento: hackathon.versionReglamento,
  versionAutorizacionDatos: VERSION_AUTORIZACION_DATOS,
});

class InscripcionService {
  private static enlaceDeVerificacion(token: string): string {
    return `${env.APEX_WEB_BASE_URL.replace(/\/$/, '')}/hackathon/verificar-correo#token=${token}`;
  }

  private static enviarVerificacion(usuario: Pick<Usuario, 'correo' | 'nombre'>, token: string): void {
    const message = emailVerificationMessage({
      to: usuario.correo,
      nombre: usuario.nombre,
      link: InscripcionService.enlaceDeVerificacion(token),
      ttlHours: env.EMAIL_VERIFICATION_TTL_HOURS,
    });
    void mailer.send(message).catch((error) => {
      if (!env.isTest) console.error('email delivery failed', error);
    });
  }

  public static async obtenerEvento(hackathonId: string): Promise<EventoPublico> {
    const hackathon = await HackathonRepo.buscarPorId(hackathonId);
    if (!hackathon || esFaseOculta(hackathon.faseActual)) {
      throw new CustomError(Errors.EventNotFound.status, Errors.EventNotFound.message);
    }
    return aEventoPublico(hackathon);
  }

  public static async registrar(hackathonId: string, input: RegistroInscripcionInput): Promise<ResultadoInscripcion> {
    const hashContrasena = await hashPassword(input.contrasena);
    const token = generateRefreshToken();

    try {
      const inscripcion = await Database.transaction(async (transaction) => {
        const hackathon = await HackathonRepo.buscarParaCompartir(hackathonId, transaction);
        if (!hackathon || esFaseOculta(hackathon.faseActual)) {
          throw new CustomError(Errors.EventNotFound.status, Errors.EventNotFound.message);
        }
        if (hackathon.faseActual !== FaseHackathon.Inscripciones) {
          throw new CustomError(Errors.RegistrationClosed.status, Errors.RegistrationClosed.message);
        }
        if (input.versionReglamento !== hackathon.versionReglamento) {
          throw new CustomError(Errors.RulesOutdated.status, Errors.RulesOutdated.message);
        }
        if (input.versionDatos !== VERSION_AUTORIZACION_DATOS) {
          throw new CustomError(Errors.DataConsentOutdated.status, Errors.DataConsentOutdated.message);
        }

        const usuario = await UsuarioRepo.crear(
          {
            correo: input.correo,
            hashContrasena,
            nombre: input.nombre,
            github: input.github,
            linkedin: input.linkedin,
            portafolio: input.portafolio,
          },
          transaction,
        );
        const creada = await InscripcionRepo.crear(
          {
            usuarioId: usuario.id,
            hackathonId,
            institucion: input.institucion,
            programa: input.programa,
            semestre: input.semestre,
            reglamentoVersion: input.versionReglamento,
            datosVersion: input.versionDatos,
            consientePublicacionImagen: input.consientePublicacionImagen,
          },
          transaction,
        );
        await TokenUsuarioRepo.crear(
          usuario.id,
          TipoTokenUsuario.VerificacionCorreo,
          hashRefreshToken(token),
          new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_HOURS * HOUR_MS),
          transaction,
        );
        return { creada, usuario };
      });

      InscripcionService.enviarVerificacion(inscripcion.usuario, token);
      return {
        inscripcionId: inscripcion.creada.id,
        estado: inscripcion.creada.estado,
        correoVerificado: false,
      };
    } catch (error) {
      if (esViolacionDeCorreoUnico(error)) {
        throw new CustomError(Errors.EmailTaken.status, Errors.EmailTaken.message);
      }
      throw error;
    }
  }

  public static async verificarCorreo(token: string): Promise<void> {
    await Database.transaction(async (transaction) => {
      const usuarioId = await TokenUsuarioRepo.consumir(
        hashRefreshToken(token),
        TipoTokenUsuario.VerificacionCorreo,
        transaction,
      );
      if (!usuarioId) {
        throw new CustomError(Errors.InvalidVerificationToken.status, Errors.InvalidVerificationToken.message);
      }
      await UsuarioRepo.marcarCorreoVerificado(usuarioId, transaction);
    });
  }

  public static async reenviarVerificacion(correo: string): Promise<void> {
    const usuario = await UsuarioRepo.buscarPorCorreo(correo);
    if (!usuario || usuario.correoVerificadoEn || usuario.estado !== EstadoUsuario.Activo) return;

    const ultimo = await TokenUsuarioRepo.ultimoDeUsuario(usuario.id, TipoTokenUsuario.VerificacionCorreo);
    if (ultimo && Date.now() - ultimo.creadoEn.getTime() < env.EMAIL_VERIFICATION_COOLDOWN_SECONDS * 1000) return;

    await TokenUsuarioRepo.invalidarPendientes(usuario.id, TipoTokenUsuario.VerificacionCorreo);
    const token = generateRefreshToken();
    await TokenUsuarioRepo.crear(
      usuario.id,
      TipoTokenUsuario.VerificacionCorreo,
      hashRefreshToken(token),
      new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_HOURS * HOUR_MS),
    );
    InscripcionService.enviarVerificacion(usuario, token);
  }
}

export default InscripcionService;
