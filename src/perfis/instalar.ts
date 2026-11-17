/**
 * Primeiro import do app (main.tsx): troca as chaves de perfil no localStorage
 * antes de qualquer outro módulo ler favoritos, progresso ou recentes.
 */
import { instalarChavesPorPerfil } from './perfis';

instalarChavesPorPerfil();
