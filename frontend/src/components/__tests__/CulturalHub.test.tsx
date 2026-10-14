import React from 'react';
import { act, render } from '@testing-library/react-native';
import i18n from 'i18next';
import CulturalHubTimeline, { buildTimelineMonths } from '../CulturalHubTimeline';
import CulturalHubPlaylists, { DEFAULT_PLAYLISTS } from '../CulturalHubPlaylists';

describe('Cultural hub timeline and playlists', () => {
  afterEach(async () => {
    await act(() => i18n.changeLanguage('pt'));
  });

  it('renders the Portuguese copy from the data', () => {
    const months = buildTimelineMonths([[6, 7], [6]]);
    const timeline = render(<CulturalHubTimeline months={months} />);
    expect(timeline.getByText('Calendário Cultural')).toBeTruthy();
    expect(timeline.getByText('São João')).toBeTruthy();
    expect(timeline.getByText('Dez')).toBeTruthy();

    const playlists = render(<CulturalHubPlaylists playlists={DEFAULT_PLAYLISTS} onSelect={jest.fn()} />);
    expect(playlists.getByText('Playlists Temáticas')).toBeTruthy();
    expect(playlists.getByText('Rota UNESCO')).toBeTruthy();
    expect(playlists.getByText('1 rota')).toBeTruthy();
  });

  it('renders in English, keeping unknown playlists as they come', async () => {
    await act(() => i18n.changeLanguage('en'));
    const months = buildTimelineMonths([[12]]);
    const timeline = render(<CulturalHubTimeline months={months} />);
    expect(timeline.getByText('Cultural Calendar')).toBeTruthy();
    expect(timeline.getByText('Christmas')).toBeTruthy();
    expect(timeline.getByText('Dec')).toBeTruthy();

    const custom = { id: 'pl_api', title: 'Rota do Vinho', subtitle: 'Douro', icon: 'wine-bar' as const, color: '#900', routeIds: ['a', 'b'] };
    const playlists = render(<CulturalHubPlaylists playlists={[DEFAULT_PLAYLISTS[0], custom]} onSelect={jest.fn()} />);
    expect(playlists.getByText('Themed Playlists')).toBeTruthy();
    expect(playlists.getByText('World Heritage only')).toBeTruthy();
    expect(playlists.getByText('Rota do Vinho')).toBeTruthy();
    expect(playlists.getByText('2 routes')).toBeTruthy();
  });
});
