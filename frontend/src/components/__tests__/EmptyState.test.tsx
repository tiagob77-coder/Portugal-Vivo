import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import EmptyState from '../EmptyState';

// Mock MaterialIcons
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

describe('EmptyState', () => {
  it('renders title text', () => {
    const { getByText } = render(
      <EmptyState title="Sem resultados" />
    );
    expect(getByText('Sem resultados')).toBeTruthy();
  });

  it('renders subtitle/description', () => {
    const { getByText } = render(
      <EmptyState title="Nada aqui" subtitle="Tente outra pesquisa" />
    );
    expect(getByText('Tente outra pesquisa')).toBeTruthy();
  });

  it('renders icon via variant preset', () => {
    const { getByText } = render(
      <EmptyState variant="no-favorites" />
    );
    expect(getByText('Sem favoritos ainda')).toBeTruthy();
    expect(getByText('Explore locais e adicione aos seus favoritos')).toBeTruthy();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="Vazio"
        actionLabel="Explorar"
        onAction={onAction}
      />
    );
    const button = getByText('Explorar');
    expect(button).toBeTruthy();
    fireEvent.press(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders multiple action buttons when actions array is provided', () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const { getByText } = render(
      <EmptyState
        title="Vazio"
        actions={[
          { label: 'Acao 1', onPress: onPrimary, variant: 'primary' },
          { label: 'Acao 2', onPress: onSecondary, variant: 'secondary' },
        ]}
      />
    );
    expect(getByText('Acao 1')).toBeTruthy();
    expect(getByText('Acao 2')).toBeTruthy();

    fireEvent.press(getByText('Acao 1'));
    expect(onPrimary).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Acao 2'));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('explicit props override variant presets', () => {
    const { getByText } = render(
      <EmptyState variant="no-results" title="Custom title" />
    );
    expect(getByText('Custom title')).toBeTruthy();
  });

  it('renders compact variant without crashing', () => {
    const { getByText } = render(
      <EmptyState variant="no-connection" compact />
    );
    expect(getByText('Sem ligação')).toBeTruthy();
  });
});
