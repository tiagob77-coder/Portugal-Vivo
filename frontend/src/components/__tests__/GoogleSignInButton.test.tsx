import React from 'react';
import { render, act } from '@testing-library/react-native';

import GoogleSignInButton from '../GoogleSignInButton';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../theme/colors', () => ({
  palette: {
    gray: { 50: '#F8FAFC', 800: '#1E293B' },
    white: '#FFFFFF',
  },
}));

jest.mock('../../config/api', () => ({
  API_BASE: 'http://localhost:8000/api',
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GoogleSignInButton', () => {
  const onSuccess = jest.fn();
  const onError = jest.fn();

  beforeEach(() => {
    onSuccess.mockClear();
    onError.mockClear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing while clientId has not been fetched', () => {
    // fetch is not resolved yet — clientId stays empty → component returns null
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { toJSON } = render(
      <GoogleSignInButton onSuccess={onSuccess} onError={onError} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the button after clientId is resolved', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ client_id: 'test-client-id' }),
    });

    let component: any;
    await act(async () => {
      component = render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
    });

    const { getByText } = component;
    expect(getByText('Entrar com Google')).toBeTruthy();
  });

  it('renders Google G letter inside the button', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ client_id: 'test-client-id' }),
    });

    let component: any;
    await act(async () => {
      component = render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
    });

    const { getByText } = component;
    expect(getByText('G')).toBeTruthy();
  });

  it('remains null when server returns no client_id', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ client_id: '' }),
    });

    let component: any;
    await act(async () => {
      component = render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
    });

    expect(component.toJSON()).toBeNull();
  });

  it('remains null when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    let component: any;
    await act(async () => {
      component = render(<GoogleSignInButton onSuccess={onSuccess} onError={onError} />);
    });

    expect(component.toJSON()).toBeNull();
  });

  it('accepts a custom style prop without crashing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ client_id: 'test-client-id' }),
    });

    await act(async () => {
      render(
        <GoogleSignInButton
          onSuccess={onSuccess}
          onError={onError}
          style={{ marginTop: 16 }}
        />
      );
    });
    // No crash is the assertion
  });
});
