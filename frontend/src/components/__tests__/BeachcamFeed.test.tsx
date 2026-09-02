import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('expo-av', () => ({ Video: 'Video', ResizeMode: { COVER: 'cover' } }));
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import BeachcamFeed from '../BeachcamFeed';

/** Todos os URIs de <Image> na árvore renderizada. */
const imageUris = (tree: ReturnType<typeof render>): string[] =>
  tree.UNSAFE_getAllByType('Image' as never)
    .map((n) => (n.props as { source?: { uri?: string } }).source?.uri)
    .filter((u): u is string => !!u);

describe('BeachcamFeed', () => {
  afterEach(() => jest.useRealTimers());

  it('avisa quando a câmara não declara fonte', () => {
    const { getByText } = render(<BeachcamFeed name="Praia X" />);
    expect(getByText('Câmara sem transmissão disponível')).toBeTruthy();
  });

  it('avisa quando há provider mas falta o URL', () => {
    const { getByText } = render(<BeachcamFeed name="Praia X" provider="hls" />);
    expect(getByText('Câmara sem transmissão disponível')).toBeTruthy();
  });

  it('mostra a imagem de recurso mesmo sem transmissão', () => {
    const tree = render(
      <BeachcamFeed name="Praia X" fallbackImage="https://img/praia.jpg" />,
    );
    expect(imageUris(tree)).toContain('https://img/praia.jpg');
  });

  it('renderiza um snapshot com o URL da fonte', () => {
    const tree = render(
      <BeachcamFeed name="Praia X" provider="snapshot" feedUrl="https://cam/now.jpg" />,
    );
    expect(imageUris(tree).some((u) => u.startsWith('https://cam/now.jpg'))).toBe(true);
  });

  it('acrescenta um parâmetro anti-cache ao snapshot', () => {
    const tree = render(
      <BeachcamFeed name="Praia X" provider="snapshot" feedUrl="https://cam/now.jpg" />,
    );
    expect(imageUris(tree).some((u) => u.includes('_t='))).toBe(true);
  });

  it('usa & quando o URL do snapshot já tem query string', () => {
    const tree = render(
      <BeachcamFeed name="Praia X" provider="snapshot" feedUrl="https://cam/now.jpg?id=3" />,
    );
    const uri = imageUris(tree).find((u) => u.includes('_t='));
    expect(uri).toContain('?id=3&_t=');
  });

  it('recarrega o snapshot na cadência indicada', () => {
    jest.useFakeTimers();
    const tree = render(
      <BeachcamFeed
        name="Praia X"
        provider="snapshot"
        feedUrl="https://cam/now.jpg"
        refreshSeconds={10}
      />,
    );
    const before = imageUris(tree).find((u) => u.includes('_t='));
    act(() => { jest.advanceTimersByTime(10_000); });
    const after = imageUris(tree).find((u) => u.includes('_t='));
    expect(after).not.toBe(before);
  });

  it('não recarrega antes da cadência', () => {
    jest.useFakeTimers();
    const tree = render(
      <BeachcamFeed
        name="Praia X"
        provider="snapshot"
        feedUrl="https://cam/now.jpg"
        refreshSeconds={30}
      />,
    );
    const before = imageUris(tree).find((u) => u.includes('_t='));
    act(() => { jest.advanceTimersByTime(5_000); });
    expect(imageUris(tree).find((u) => u.includes('_t='))).toBe(before);
  });

  it('não arma temporizador para providers que não são snapshot', () => {
    jest.useFakeTimers();
    render(<BeachcamFeed name="Praia X" provider="hls" feedUrl="https://cam/live.m3u8" />);
    // Um HLS não deve deixar intervalos pendentes
    expect(jest.getTimerCount()).toBe(0);
  });

  it('mostra o aviso de indisponível quando o snapshot falha', () => {
    const tree = render(
      <BeachcamFeed
        name="Praia X"
        provider="snapshot"
        feedUrl="https://cam/now.jpg"
        fallbackImage="https://img/praia.jpg"
      />,
    );
    const img = tree.UNSAFE_getAllByType('Image' as never)[0];
    act(() => { (img.props as { onError?: () => void }).onError?.(); });
    expect(tree.getByText('Câmara temporariamente indisponível')).toBeTruthy();
  });
});
