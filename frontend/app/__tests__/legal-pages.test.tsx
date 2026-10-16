/**
 * Páginas legais: identificação do responsável, Livro de Reclamações,
 * Declaração de Acessibilidade e o próprio cumprimento de contraste/rótulos
 * nas páginas onde a declaração é publicada.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { LEGAL_ENTITY, isValidNif } from '../../src/config/legalEntity';
import { LEGAL_PAGE_COLORS } from '../../src/components/legal/LegalPage';
import { contrastRatio } from '../../src/theme/colors';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
}));
jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));

/* eslint-disable @typescript-eslint/no-require-imports */
const PrivacyScreen = () => React.createElement(require('../privacy').default);
const TermsScreen = () => React.createElement(require('../terms').default);
const AccessibilityScreen = () => React.createElement(require('../acessibilidade').default);
/* eslint-enable @typescript-eslint/no-require-imports */

/** Texto completo do ecrã (os parágrafos juntam vários <Text> aninhados). */
const allText = (): string => {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') parts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in node) walk((node as { children: unknown }).children);
  };
  walk(screen.toJSON());
  return parts.join('').replace(/\s+/g, ' ');
};

describe('LEGAL_ENTITY', () => {
  it('tem um NIF válido (dígito de controlo)', () => {
    expect(isValidNif(LEGAL_ENTITY.nif)).toBe(true);
  });

  it('valida e rejeita NIFs como a AT', () => {
    expect(isValidNif('212825771')).toBe(true);
    expect(isValidNif('212825772')).toBe(false); // dígito de controlo errado
    expect(isValidNif('21282577')).toBe(false);
    expect(isValidNif('21282577a')).toBe(false);
  });

  it('não tem campos de identificação por preencher', () => {
    for (const value of [LEGAL_ENTITY.holderName, LEGAL_ENTITY.legalForm, LEGAL_ENTITY.address]) {
      expect(value.trim().length).toBeGreaterThan(3);
    }
    expect(LEGAL_ENTITY.address).toMatch(/\d{4}-\d{3}/); // código postal
  });
});

describe('páginas legais — contraste (WCAG 2.1 AA)', () => {
  it.each(['heading', 'text', 'meta', 'link', 'disclaimer'] as const)(
    'a cor "%s" tem pelo menos 4,5:1 sobre o fundo',
    (key) => {
      expect(contrastRatio(LEGAL_PAGE_COLORS[key], LEGAL_PAGE_COLORS.background)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('Política de Privacidade', () => {
  it('identifica o responsável pelo tratamento com nome, NIF e morada', () => {
    render(<PrivacyScreen />);
    const text = allText();
    expect(text).toContain(LEGAL_ENTITY.holderName);
    expect(text).toContain(`NIF ${LEGAL_ENTITY.nif}`);
    expect(text).toContain(LEGAL_ENTITY.address);
    expect(text).toContain('Empresário em nome individual');
  });

  it('diz que não foi designado EPD', () => {
    render(<PrivacyScreen />);
    expect(allText()).toContain('Não foi designado um Encarregado de Proteção de Dados');
  });

  it('o contacto de privacidade abre o e-mail certo', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<PrivacyScreen />);
    fireEvent.press(screen.getByText(LEGAL_ENTITY.emails.privacy));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^mailto:privacidade@portugalvivo\.pt\?subject=/));
    open.mockRestore();
  });

  it('o botão de voltar tem nome acessível', () => {
    render(<PrivacyScreen />);
    fireEvent.press(screen.getByLabelText('Voltar'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('Termos de Utilização', () => {
  it('identifica o prestador (DL 7/2004, art. 10.º)', () => {
    render(<TermsScreen />);
    const text = allText();
    expect(text).toContain(LEGAL_ENTITY.holderName);
    expect(text).toContain(`NIF ${LEGAL_ENTITY.nif}`);
  });

  it('remete para o Livro de Reclamações e já não para a plataforma RLL encerrada', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<TermsScreen />);
    expect(allText()).not.toContain('ec.europa.eu/consumers/odr');
    fireEvent.press(screen.getByText('www.livroreclamacoes.pt'));
    expect(open).toHaveBeenCalledWith('https://www.livroreclamacoes.pt');
    open.mockRestore();
  });
});

describe('Declaração de Acessibilidade', () => {
  it('declara o estado de conformidade e a norma de referência', () => {
    render(<AccessibilityScreen />);
    const text = allText();
    expect(text).toContain('parcialmente conforme');
    expect(text).toContain('WCAG 2.1, nível AA');
  });

  it('identifica o responsável e diz como foi avaliada', () => {
    render(<AccessibilityScreen />);
    const text = allText();
    expect(text).toContain(LEGAL_ENTITY.holderName);
    expect(text).toContain('autoavaliação técnica');
    expect(text).toContain('não houve auditoria externa');
  });

  it('a alternativa ao mapa leva à lista Perto de mim', () => {
    render(<AccessibilityScreen />);
    fireEvent.press(screen.getByText('Perto de mim'));
    expect(mockPush).toHaveBeenCalledWith('/nearby');
  });

  it('os títulos das secções são cabeçalhos para leitores de ecrã', () => {
    render(<AccessibilityScreen />);
    expect(screen.getAllByRole('header').length).toBeGreaterThanOrEqual(7);
  });
});

describe('idioma do documento web (WCAG 3.1.1)', () => {
  it('o HTML exportado declara português', () => {
    const Root = require('../+html').default; // eslint-disable-line @typescript-eslint/no-require-imports
    const tree = Root({ children: null });
    expect(tree.props.lang).toBe('pt-PT');
  });

  it('acompanha a língua da interface', () => {
    const { syncDocumentLanguage } = require('../../src/i18n'); // eslint-disable-line @typescript-eslint/no-require-imports
    const html = { lang: '' };
    const g = globalThis as { document?: unknown };
    const previous = g.document;
    g.document = { documentElement: html };
    try {
      syncDocumentLanguage('en');
      expect(html.lang).toBe('en');
      syncDocumentLanguage('pt');
      expect(html.lang).toBe('pt-PT');
    } finally {
      g.document = previous;
    }
  });
});
