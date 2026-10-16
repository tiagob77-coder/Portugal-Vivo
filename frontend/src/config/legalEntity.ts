/**
 * Quem está por trás do Portugal Vivo — fonte única para as páginas legais
 * (Política de Privacidade, Termos de Utilização, Declaração de Acessibilidade).
 *
 * Exigido pelo RGPD (art. 13.º, n.º 1, a) — identidade e contactos do
 * responsável pelo tratamento) e pelo DL 7/2004 (art. 10.º — identificação do
 * prestador de serviços da sociedade da informação). Um empresário em nome
 * individual identifica-se pelo nome civil, NIF e domicílio profissional.
 *
 * Ao alterar qualquer valor, atualizar também a data `LAST_UPDATED` das
 * páginas que o mostram.
 */
export interface LegalEntity {
  /** Nome comercial da plataforma. */
  brand: string;
  /** Nome civil do titular (empresário em nome individual). */
  holderName: string;
  legalForm: string;
  /** NIF — 9 dígitos, com dígito de controlo válido (ver isValidNif). */
  nif: string;
  /** Domicílio profissional. */
  address: string;
  country: string;
  emails: {
    privacy: string;
    legal: string;
    /** Pedidos e problemas de acessibilidade. */
    accessibility: string;
  };
  /** Encarregado de Proteção de Dados; `null` quando não foi designado. */
  dpo: { name: string; email: string } | null;
}

export const LEGAL_ENTITY: LegalEntity = {
  brand: 'Portugal Vivo',
  holderName: 'Tiago Nuno Ramalho de Brito Beato',
  legalForm: 'Empresário em nome individual',
  nif: '212825771',
  address: 'Praceta da Amizade, Torre 5, 7.º B, Mira Sintra, 2735-387 Agualva-Cacém',
  country: 'Portugal',
  emails: {
    privacy: 'privacidade@portugalvivo.pt',
    legal: 'legal@portugalvivo.pt',
    accessibility: 'legal@portugalvivo.pt',
  },
  dpo: null,
};

/** Validação do NIF português (módulo 11). */
export function isValidNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const digits = nif.split('').map(Number);
  const sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * (9 - i), 0);
  const check = 11 - (sum % 11);
  return digits[8] === (check >= 10 ? 0 : check);
}
