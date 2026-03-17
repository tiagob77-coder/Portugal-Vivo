/**
 * Reviews Section Component
 * Displays reviews and ratings for heritage items
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, ScrollView as HScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { API_URL } from '../config/api';
import ImageUpload from './ImageUpload';

interface Review {
  id: string;
  item_id: string;
  user_id: string;
  user_name: string;
  user_picture?: string;
  rating: number;
  title?: string;
  text?: string;
  visit_date?: string;
  image_urls?: string[];
  helpful_votes: number;
  created_at: string;
}

interface ReviewSummary {
  item_id: string;
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<string, number>;
}

interface ReviewsSectionProps {
  itemId: string;
  authToken?: string;
  onLoginRequired?: () => void;
}

const getReviewSummary = async (itemId: string): Promise<ReviewSummary> => {
  const res = await fetch(`${API_URL}/api/reviews/item/${itemId}/summary`);
  if (!res.ok) throw new Error('Failed to fetch review summary');
  return res.json();
};

const getReviews = async (itemId: string): Promise<Review[]> => {
  const res = await fetch(`${API_URL}/api/reviews/item/${itemId}?limit=10`);
  if (!res.ok) throw new Error('Failed to fetch reviews');
  return res.json();
};

const createReview = async (data: { item_id: string; rating: number; title?: string; text?: string; image_urls?: string[] }, token: string) => {
  const res = await fetch(`${API_URL}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to create review');
  }
  return res.json();
};

function StarRating({ rating, size = 16, interactive = false, onRate }: { 
  rating: number; 
  size?: number; 
  interactive?: boolean;
  onRate?: (rating: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          disabled={!interactive}
          onPress={() => onRate?.(star)}
          style={styles.starButton}
        >
          <MaterialIcons
            name={star <= rating ? 'star' : star - 0.5 <= rating ? 'star-half' : 'star-outline'}
            size={size}
            color={star <= rating ? '#C49A6C' : '#4B5563'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RatingBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.ratingBarRow}>
      <Text style={styles.ratingBarLabel}>{label}</Text>
      <View style={styles.ratingBarBg}>
        <View style={[styles.ratingBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.ratingBarCount}>{count}</Text>
    </View>
  );
}

function ReviewCard({ review, onHelpful, token }: { review: Review; onHelpful: () => void; token?: string }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <View style={styles.reviewCard} data-testid={`review-card-${review.id}`}>
      <View style={styles.reviewHeader}>
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{review.user_name.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{review.user_name}</Text>
            <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
          </View>
        </View>
        <StarRating rating={review.rating} size={14} />
      </View>
      
      {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
      {review.text && <Text style={styles.reviewText}>{review.text}</Text>}

      {review.image_urls && review.image_urls.length > 0 && (
        <HScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewImages}>
          {review.image_urls.map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={styles.reviewImage} resizeMode="cover" />
          ))}
        </HScrollView>
      )}

      {review.visit_date && (
        <View style={styles.visitDateRow}>
          <MaterialIcons name="event" size={12} color="#64748B" />
          <Text style={styles.visitDateText}>Visitou em {review.visit_date}</Text>
        </View>
      )}
      
      <TouchableOpacity style={styles.helpfulButton} onPress={onHelpful} disabled={!token}>
        <MaterialIcons name="thumb-up" size={14} color="#64748B" />
        <Text style={styles.helpfulText}>Útil ({review.helpful_votes})</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ReviewsSection({ itemId, authToken, onLoginRequired }: ReviewsSectionProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reviewSummary', itemId],
    queryFn: () => getReviewSummary(itemId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', itemId],
    queryFn: () => getReviews(itemId),
    staleTime: 5 * 60 * 1000,
  });

  const submitMutation = useMutation({
    mutationFn: (data: { item_id: string; rating: number; title?: string; text?: string; image_urls?: string[] }) =>
      createReview(data, authToken || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', itemId] });
      queryClient.invalidateQueries({ queryKey: ['reviewSummary', itemId] });
      setShowForm(false);
      setNewRating(0);
      setNewTitle('');
      setNewText('');
      setImageUrl(null);
      Alert.alert('Sucesso', 'A sua avaliação foi publicada!');
    },
    onError: (error: Error) => {
      Alert.alert('Erro', error.message);
    },
  });

  const handleSubmit = () => {
    if (!authToken) {
      onLoginRequired?.();
      return;
    }
    if (newRating === 0) {
      Alert.alert('Avaliação necessária', 'Por favor selecione uma classificação de 1 a 5 estrelas.');
      return;
    }
    submitMutation.mutate({
      item_id: itemId,
      rating: newRating,
      title: newTitle || undefined,
      text: newText || undefined,
      image_urls: imageUrl ? [imageUrl] : undefined,
    });
  };

  const handleHelpful = async (reviewId: string) => {
    if (!authToken) {
      onLoginRequired?.();
      return;
    }
    try {
      await fetch(`${API_URL}/api/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      queryClient.invalidateQueries({ queryKey: ['reviews', itemId] });
    } catch (_e) {
      // Silently fail
    }
  };

  if (summaryLoading || reviewsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#C49A6C" />
      </View>
    );
  }

  return (
    <View style={styles.container} data-testid="reviews-section">
      {/* Summary Header */}
      <View style={styles.summarySection}>
        <View style={styles.summaryLeft}>
          <Text style={styles.averageRating}>{summary?.average_rating.toFixed(1) || '0.0'}</Text>
          <StarRating rating={summary?.average_rating || 0} size={20} />
          <Text style={styles.totalReviews}>{summary?.total_reviews || 0} avaliações</Text>
        </View>
        
        <View style={styles.summaryRight}>
          <RatingBar label="5" count={summary?.rating_distribution['5'] || 0} total={summary?.total_reviews || 1} color="#22C55E" />
          <RatingBar label="4" count={summary?.rating_distribution['4'] || 0} total={summary?.total_reviews || 1} color="#84CC16" />
          <RatingBar label="3" count={summary?.rating_distribution['3'] || 0} total={summary?.total_reviews || 1} color="#C49A6C" />
          <RatingBar label="2" count={summary?.rating_distribution['2'] || 0} total={summary?.total_reviews || 1} color="#F97316" />
          <RatingBar label="1" count={summary?.rating_distribution['1'] || 0} total={summary?.total_reviews || 1} color="#EF4444" />
        </View>
      </View>

      {/* Write Review Button / Form */}
      {!showForm ? (
        <TouchableOpacity
          style={styles.writeReviewButton}
          onPress={() => authToken ? setShowForm(true) : onLoginRequired?.()}
          data-testid="write-review-btn"
        >
          <MaterialIcons name="rate-review" size={20} color="#FFF" />
          <Text style={styles.writeReviewText}>Escrever Avaliação</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.formContainer}>
          <Text style={styles.formLabel}>A sua classificação</Text>
          <StarRating rating={newRating} size={32} interactive onRate={setNewRating} />
          
          <Text style={styles.formLabel}>Título (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Experiência incrível!"
            placeholderTextColor="#64748B"
            value={newTitle}
            onChangeText={setNewTitle}
          />
          
          <Text style={styles.formLabel}>A sua avaliação</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Partilhe a sua experiência..."
            placeholderTextColor="#64748B"
            value={newText}
            onChangeText={setNewText}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.formLabel}>Foto (opcional)</Text>
          {authToken && (
            <ImageUpload
              token={authToken}
              context="review"
              itemId={itemId}
              onUpload={(url) => setImageUrl(url)}
            />
          )}

          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, submitMutation.isPending && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Publicar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reviews List */}
      <View style={styles.reviewsList}>
        <Text style={styles.reviewsListTitle}>Avaliações Recentes</Text>
        {reviews && reviews.length > 0 ? (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              token={authToken}
              onHelpful={() => handleHelpful(review.id)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="rate-review" size={48} color="#374151" />
            <Text style={styles.emptyText}>Seja o primeiro a avaliar!</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 16,
    marginVertical: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  summarySection: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  summaryLeft: {
    alignItems: 'center',
    gap: 4,
  },
  averageRating: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalReviews: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  summaryRight: {
    flex: 1,
    gap: 4,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBarLabel: {
    fontSize: 12,
    color: '#94A3B8',
    width: 14,
  },
  ratingBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  ratingBarCount: {
    fontSize: 12,
    color: '#64748B',
    width: 24,
    textAlign: 'right',
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  starButton: {
    padding: 2,
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C49A6C',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  writeReviewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  formContainer: {
    backgroundColor: '#2E5E4E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#264E41',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#C49A6C',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  reviewsList: {
    marginTop: 8,
  },
  reviewsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: '#2E5E4E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C49A6C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reviewDate: {
    fontSize: 11,
    color: '#64748B',
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  reviewText: {
    fontSize: 14,
    color: '#C8C3B8',
    lineHeight: 20,
  },
  reviewImages: {
    marginTop: 10,
    marginBottom: 4,
  },
  reviewImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginRight: 8,
  },
  visitDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  visitDateText: {
    fontSize: 12,
    color: '#64748B',
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
  },
  helpfulText: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
});

export default ReviewsSection;
