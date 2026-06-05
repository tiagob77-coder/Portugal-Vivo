import api from './client';

// Image Uploads
export const uploadImage = async (
  file: { uri: string; type: string; name: string },
  context: 'poi' | 'review' | 'contribution' | 'general',
  token: string,
  itemId?: string,
): Promise<{ url: string; id: string; size: number }> => {
  const formData = new FormData();
  formData.append('file', file as any);
  formData.append('context', context);
  if (itemId) formData.append('item_id', itemId);

  const response = await api.post('/uploads', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Community Photo Gallery — fetch user-uploaded images for a POI
export const getPoiImages = async (poiId: string): Promise<{
  images: { public_id: string; url: string; thumbnail_url: string; user_id: string; created_at: string }[];
  total: number;
}> => {
  const response = await api.get(`/cloudinary/poi-images/${poiId}`);
  return response.data;
};

// Admin: get all pending/recent user uploads for moderation
export const getAdminUploads = async (
  token: string,
  params?: { status?: string; limit?: number; skip?: number },
): Promise<{ uploads: any[]; total: number }> => {
  const response = await api.get('/admin/uploads', {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Admin: moderate an image (approve/reject/delete)
export const moderateImage = async (
  token: string,
  imageId: string,
  action: 'approve' | 'reject' | 'delete',
): Promise<{ success: boolean }> => {
  const response = await api.post(`/admin/uploads/${imageId}/moderate`, { action }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
