import api from './client';

// Contributions
export interface Contribution {
  id: string;
  user_id: string;
  user_name: string;
  heritage_item_id?: string;
  type: string;
  title: string;
  content: string;
  location?: { lat: number; lng: number };
  category?: string;
  region?: string;
  image_urls?: string[];
  status: string;
  votes: number;
  created_at: string;
}

export interface ContributionCreate {
  heritage_item_id?: string;
  type: string;
  title: string;
  content: string;
  location?: { lat: number; lng: number };
  category?: string;
  region?: string;
  image_urls?: string[];
}

export const getContributions = async (params?: {
  status?: string;
  type?: string;
  region?: string;
}): Promise<Contribution[]> => {
  const response = await api.get('/contributions', { params });
  return response.data;
};

export const getApprovedContributions = async (): Promise<Contribution[]> => {
  const response = await api.get('/contributions/approved');
  return response.data;
};

export const getMyContributions = async (token: string): Promise<Contribution[]> => {
  const response = await api.get('/contributions/my', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const createContribution = async (
  contribution: ContributionCreate,
  token: string
): Promise<Contribution> => {
  const response = await api.post('/contributions', contribution, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const voteContribution = async (contributionId: string, token: string): Promise<void> => {
  await api.post(`/contributions/${contributionId}/vote`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// Gallery
export const getGallery = async (category: string): Promise<{
  id: string;
  name: string;
  image_url: string;
  region: string;
}[]> => {
  const response = await api.get(`/gallery/${category}`);
  return response.data;
};
