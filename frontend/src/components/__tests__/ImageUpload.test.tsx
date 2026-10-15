import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ImageUpload from '../ImageUpload';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../services/api', () => ({
  uploadImage: jest.fn(() => Promise.resolve({ url: 'https://example.com/photo.jpg' })),
}));

jest.mock('../../theme/colors', () => ({
  palette: {
    terracotta: { 500: '#C49A6C' },
  },
  withOpacity: (color: string, _opacity: number) => color,
}));

const defaultProps = {
  token: 'test-token',
  context: 'poi' as const,
  itemId: 'item-1',
  onUpload: jest.fn(),
};

describe('ImageUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders placeholder text in the default (empty) state', () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByText('Adicionar foto')).toBeTruthy();
  });

  it('shows hint text with max size', () => {
    render(<ImageUpload {...defaultProps} maxSizeMB={5} />);
    expect(screen.getByText('JPEG, PNG ou WebP (máx. 5 MB)')).toBeTruthy();
  });

  it('uses custom maxSizeMB in hint text', () => {
    render(<ImageUpload {...defaultProps} maxSizeMB={10} />);
    expect(screen.getByText('JPEG, PNG ou WebP (máx. 10 MB)')).toBeTruthy();
  });

  it('renders a touchable dropzone', () => {
    const { UNSAFE_getAllByType } = render(<ImageUpload {...defaultProps} />);
    const { TouchableOpacity } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    expect(touchables.length).toBeGreaterThanOrEqual(1);
  });

  it('renders without crashing for review context', () => {
    expect(() =>
      render(<ImageUpload {...defaultProps} context="review" />)
    ).not.toThrow();
  });

  it('renders without crashing for contribution context', () => {
    expect(() =>
      render(<ImageUpload {...defaultProps} context="contribution" />)
    ).not.toThrow();
  });

  it('renders without crashing for general context', () => {
    expect(() =>
      render(<ImageUpload {...defaultProps} context="general" />)
    ).not.toThrow();
  });

  it('accepts an onUpload callback without errors', () => {
    const onUpload = jest.fn();
    expect(() =>
      render(<ImageUpload {...defaultProps} onUpload={onUpload} />)
    ).not.toThrow();
  });
});

describe('ImageUpload — origem da foto', () => {
  it('oferece câmara e galeria no estado vazio', () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByText('Tirar foto')).toBeTruthy();
    expect(screen.getByText('Da galeria')).toBeTruthy();
  });

  it('não mostra "Remover" sem foto escolhida', () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.queryByText('Remover')).toBeNull();
  });

  it('os botões de origem são acessíveis por rótulo', () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByLabelText('Tirar foto com a câmara')).toBeTruthy();
    expect(screen.getByLabelText('Escolher foto da galeria')).toBeTruthy();
  });

  it('em nativo, tocar em "Tirar foto" pede permissão de câmara, não de galeria', async () => {
    const requestCamera = jest.fn(() => Promise.resolve({ status: 'denied' }));
    const requestLibrary = jest.fn(() => Promise.resolve({ status: 'denied' }));
    jest.doMock('expo-image-picker', () => ({
      requestCameraPermissionsAsync: requestCamera,
      requestMediaLibraryPermissionsAsync: requestLibrary,
      launchCameraAsync: jest.fn(),
      launchImageLibraryAsync: jest.fn(),
      CameraType: { back: 'back' },
    }), { virtual: true });
    const { fireEvent } = require('@testing-library/react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const { Alert } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(<ImageUpload {...defaultProps} />);
    fireEvent.press(screen.getByLabelText('Tirar foto com a câmara'));
    await Promise.resolve();

    expect(requestCamera).toHaveBeenCalledTimes(1);
    expect(requestLibrary).not.toHaveBeenCalled();
    alertSpy.mockRestore();
    jest.dontMock('expo-image-picker');
  });
});
