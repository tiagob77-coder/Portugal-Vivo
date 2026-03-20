/**
 * Onboarding – Welcome + 3-step profile qualification + Premium upsell
 *
 * Flow: Welcome → Tipo de viajante → Interesses → Região → Premium
 * Profile saved to AsyncStorage so the feed personalises from the first screen.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export const ONBOARDING_KEY = 'onboarding_complete';
export const PROFILE_TRAVELER_KEY = 'profile_traveler_type';
export const PROFILE_INTERESTS_KEY = 'profile_interests';
export const PROFILE_REGION_KEY = 'profile_region';

// ─── Slide backgrounds ────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 'welcome',
    bg: ['#1E3A3F', '#2A5F6B'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Ribeira_do_Porto_%28Portugal%29.jpg/800px-Ribeira_do_Porto_%28Portugal%29.jpg',
  },
  {
    id: 'traveler',
    bg: ['#1E293B', '#1E3A5F'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Douro_Vinhateiro2.jpg/800px-Douro_Vinhateiro2.jpg',
  },
  {
    id: 'interest',
    bg: ['#2D1B00', '#4A2E00'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Pena_Palace_in_Sintra_-_panorama_%28cropped%29.jpg/800px-Pena_Palace_in_Sintra_-_panorama_%28cropped%29.jpg',
  },
  {
    id: 'location',
    bg: ['#052e16', '#14532d'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Azores_paysage.jpg/800px-Azores_paysage.jpg',
  },
  {
    id: 'premium',
    bg: ['#2D1500', '#5C2E00'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Geres1.jpg/800px-Geres1.jpg',
  },
] as const;

// ─── Qualification options ────────────────────────────────────────────────────

const TRAVELER_TYPES = [
  { id: 'adventurer', icon: 'terrain', label: 'Aventureiro', desc: 'Trilhos e natureza' },
  { id: 'culture', icon: 'account-balance', label: 'Cultura & História', desc: 'Monumentos e tradições' },
  { id: 'food', icon: 'restaurant', label: 'Gastronomia', desc: 'Sabores e vinhos' },
  { id: 'family', icon: 'family-restroom', label: 'Família', desc: 'Passeios para todos' },
  { id: 'photo', icon: 'photo-camera', label: 'Fotografia', desc: 'Paisagens únicas' },
  { id: 'beach', icon: 'beach-access', label: 'Mar & Praias', desc: 'Litoral e surf' },
] as const;

const INTEREST_OPTIONS = [
  { id: 'monuments', icon: 'account-balance', label: 'Monumentos' },
  { id: 'nature', icon: 'forest', label: 'Natureza' },
  { id: 'food', icon: 'restaurant', label: 'Gastronomia' },
  { id: 'beach', icon: 'waves', label: 'Praias' },
  { id: 'villages', icon: 'home-work', label: 'Aldeias' },
  { id: 'art', icon: 'palette', label: 'Arte & Cultura' },
  { id: 'hiking', icon: 'directions-walk', label: 'Caminhadas' },
  { id: 'spiritual', icon: 'church', label: 'Espiritualidade' },
] as const;

const REGIONS = [
  { id: 'norte', label: 'Norte', desc: 'Porto, Braga, Viana…' },
  { id: 'centro', label: 'Centro', desc: 'Coimbra, Aveiro…' },
  { id: 'lisboa', label: 'Lisboa e Tejo', desc: 'Lisboa, Setúbal…' },
  { id: 'alentejo', label: 'Alentejo', desc: 'Évora, Beja…' },
  { id: 'algarve', label: 'Algarve', desc: 'Faro, Portimão…' },
  { id: 'acores', label: 'Açores', desc: 'São Miguel, Terceira…' },
  { id: 'madeira', label: 'Madeira', desc: 'Funchal, Santana…' },
  { id: 'all', label: 'Todo Portugal', desc: 'Sem preferência' },
] as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Profile state
  const [travelerType, setTravelerType] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [region, setRegion] = useState('');

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentIndex(index);
  };

  const saveProfile = () =>
    Promise.all([
      AsyncStorage.setItem(ONBOARDING_KEY, '1'),
      travelerType ? AsyncStorage.setItem(PROFILE_TRAVELER_KEY, travelerType) : Promise.resolve(),
      interests.length
        ? AsyncStorage.setItem(PROFILE_INTERESTS_KEY, JSON.stringify(interests))
        : Promise.resolve(),
      region ? AsyncStorage.setItem(PROFILE_REGION_KEY, region) : Promise.resolve(),
    ]);

  const handleFinish = async () => {
    await saveProfile();
    router.replace('/(tabs)');
  };

  const handleTryPremium = async () => {
    await saveProfile();
    router.replace('/premium' as any);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      goTo(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const toggleInterest = (id: string) => {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const slide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;
  const isPremiumSlide = slide.id === 'premium';

  // Qualification slides require a selection before advancing
  const canAdvance =
    slide.id === 'traveler' ? travelerType !== '' :
    slide.id === 'interest' ? interests.length > 0 :
    slide.id === 'location' ? region !== '' :
    true;

  const nextLabel =
    currentIndex === 0 ? 'Começar' :
    slide.id === 'location' ? 'Ver o meu feed' :
    'Continuar';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Slide backgrounds — scrolling disabled, programmatic only */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={StyleSheet.absoluteFill}
      >
        {SLIDES.map((s) => (
          <View key={s.id} style={{ width, height }}>
            <Image source={{ uri: s.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient
              colors={[`${s.bg[0]}CC`, `${s.bg[1]}F0`, '#000000EE']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </ScrollView>

      {/* Skip (welcome only) */}
      {slide.id === 'welcome' && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 16 }]}
          onPress={handleFinish}
        >
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      )}

      {/* Content overlay */}
      <View
        style={[styles.contentWrap, { paddingBottom: insets.bottom + 24, paddingTop: insets.top + 56 }]}
        pointerEvents="box-none"
      >
        {slide.id === 'welcome' && <WelcomeContent />}
        {slide.id === 'traveler' && (
          <TravelerStep selected={travelerType} onSelect={setTravelerType} />
        )}
        {slide.id === 'interest' && (
          <InterestStep selected={interests} onToggle={toggleInterest} />
        )}
        {slide.id === 'location' && (
          <LocationStep selected={region} onSelect={setRegion} />
        )}
        {isPremiumSlide && <PremiumContent />}

        <View style={{ flex: 1 }} />

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        {/* Action buttons */}
        {isPremiumSlide ? (
          <View style={styles.premiumBtnCol}>
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: '#C49A6C' }]}
              onPress={handleTryPremium}
              activeOpacity={0.85}
            >
              <MaterialIcons name="diamond" size={18} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.nextBtnText}>Experimentar Descobridor</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipFreeBtn} onPress={handleFinish}>
              <Text style={styles.skipFreeText}>Começar grátis</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.btnRow}>
            {currentIndex > 0 && (
              <TouchableOpacity style={styles.backBtn} onPress={() => goTo(currentIndex - 1)}>
                <MaterialIcons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { flex: 1, backgroundColor: canAdvance ? '#C49A6C' : 'rgba(255,255,255,0.18)' },
              ]}
              onPress={canAdvance ? handleNext : undefined}
              activeOpacity={canAdvance ? 0.85 : 1}
            >
              <Text style={[styles.nextBtnText, !canAdvance && { color: 'rgba(255,255,255,0.4)' }]}>
                {nextLabel}
              </Text>
              <MaterialIcons
                name="arrow-forward"
                size={18}
                color={canAdvance ? '#FFF' : 'rgba(255,255,255,0.3)'}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Slide content components ─────────────────────────────────────────────────

function WelcomeContent() {
  return (
    <>
      <View style={[styles.iconBadge, { backgroundColor: '#2E5E4E33', borderColor: '#2E5E4E66' }]}>
        <MaterialIcons name="terrain" size={36} color="#4CAF82" />
      </View>
      <Text style={styles.slideLabel}>BEM-VINDO</Text>
      <Text style={styles.slideTitle}>{'Descobre o\nPatrimonio Vivo'}</Text>
      <Text style={styles.slideDesc}>
        Mais de 2 000 lugares, sabores e histórias que fazem Portugal único. Em 3 passos personalizamos a tua experiência.
      </Text>
      <View style={styles.bullets}>
        {[
          { icon: 'place' as const, text: '2 000+ lugares em Portugal' },
          { icon: 'auto-awesome' as const, text: 'Feed personalizado ao teu perfil' },
          { icon: 'wifi-off' as const, text: 'Acesso offline aos favoritos' },
        ].map((b) => (
          <View key={b.text} style={styles.bulletRow}>
            <MaterialIcons name={b.icon} size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.bulletText}>{b.text}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function TravelerStep({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.qualWrap}>
      <Text style={styles.qualStep}>PASSO 1 DE 3</Text>
      <Text style={styles.qualQuestion}>Que tipo de viajante és?</Text>
      <Text style={styles.qualSubtitle}>Personalizamos o teu feed com base na tua resposta</Text>
      <View style={styles.cardGrid}>
        {TRAVELER_TYPES.map((t) => {
          const active = selected === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.typeCard, active && styles.cardSelected]}
              onPress={() => onSelect(t.id)}
              activeOpacity={0.75}
            >
              <MaterialIcons
                name={t.icon as any}
                size={22}
                color={active ? '#C49A6C' : 'rgba(255,255,255,0.65)'}
              />
              <Text style={[styles.cardLabel, active && styles.cardLabelSelected]}>{t.label}</Text>
              <Text style={styles.cardDesc}>{t.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function InterestStep({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.qualWrap}>
      <Text style={styles.qualStep}>PASSO 2 DE 3</Text>
      <Text style={styles.qualQuestion}>O que mais te interessa?</Text>
      <Text style={styles.qualSubtitle}>Escolhe um ou mais temas</Text>
      <View style={styles.chipGrid}>
        {INTEREST_OPTIONS.map((opt) => {
          const active = selected.includes(opt.id);
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, active && styles.chipSelected]}
              onPress={() => onToggle(opt.id)}
              activeOpacity={0.75}
            >
              <MaterialIcons
                name={opt.icon as any}
                size={15}
                color={active ? '#C49A6C' : 'rgba(255,255,255,0.65)'}
              />
              <Text style={[styles.chipText, active && styles.chipTextSelected]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function LocationStep({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.qualWrap}>
      <Text style={styles.qualStep}>PASSO 3 DE 3</Text>
      <Text style={styles.qualQuestion}>A tua zona de interesse?</Text>
      <Text style={styles.qualSubtitle}>Mostramos lugares próximos primeiro</Text>
      <ScrollView
        style={styles.regionScroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {REGIONS.map((r) => {
          const active = selected === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.regionRow, active && styles.regionRowSelected]}
              onPress={() => onSelect(r.id)}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.regionLabel, active && styles.regionLabelSelected]}>
                  {r.label}
                </Text>
                <Text style={styles.regionDesc}>{r.desc}</Text>
              </View>
              {active && <MaterialIcons name="check-circle" size={20} color="#C49A6C" />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function PremiumContent() {
  return (
    <>
      <View
        style={[styles.iconBadge, { backgroundColor: 'rgba(196,154,108,0.2)', borderColor: 'rgba(196,154,108,0.4)' }]}
      >
        <MaterialIcons name="diamond" size={36} color="#C49A6C" />
      </View>
      <Text style={styles.slideLabel}>DESCOBRIDOR</Text>
      <Text style={styles.slideTitle}>{'Desbloqueia\nPortugal Completo'}</Text>
      <Text style={styles.slideDesc}>
        Roteiros IA, áudio guias, modo offline e muito mais. Experimenta 7 dias grátis.
      </Text>
      <View style={styles.premiumFeatures}>
        {[
          { icon: 'auto-awesome' as const, text: 'Roteiros personalizados por IA' },
          { icon: 'headphones' as const, text: 'Áudio guias em 9 vozes' },
          { icon: 'cloud-download' as const, text: 'Modo offline completo' },
          { icon: 'route' as const, text: 'Rotas e coleções exclusivas' },
        ].map((b) => (
          <View key={b.text} style={styles.premiumRow}>
            <View style={styles.premiumIconWrap}>
              <MaterialIcons name={b.icon} size={16} color="#C49A6C" />
            </View>
            <Text style={styles.bulletText}>{b.text}</Text>
          </View>
        ))}
        <View style={styles.pricingRow}>
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Mensal</Text>
            <Text style={styles.priceAmount}>€4.99</Text>
            <Text style={styles.pricePer}>/mês</Text>
          </View>
          <View style={[styles.priceCard, styles.priceCardHighlight]}>
            <Text style={[styles.priceLabel, { color: '#C49A6C' }]}>Anual</Text>
            <Text style={[styles.priceAmount, { color: '#FFF' }]}>€39.99</Text>
            <Text style={[styles.pricePer, { color: 'rgba(255,255,255,0.6)' }]}>/ano · -33%</Text>
          </View>
        </View>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Skip button
  skipBtn: {
    position: 'absolute',
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    zIndex: 10,
  },
  skipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },

  // Main content area
  contentWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  } as any,

  // Welcome slide
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    alignSelf: 'flex-start',
  },
  slideLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  slideTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 42,
    marginBottom: 14,
  },
  slideDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 24,
    marginBottom: 8,
  },
  bullets: {
    marginTop: 18,
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },

  // Qualification wrapper
  qualWrap: {
    flex: 1,
  },
  qualStep: {
    fontSize: 11,
    color: '#C49A6C',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  qualQuestion: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 34,
    marginBottom: 6,
  },
  qualSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
  },

  // Traveler type grid (2 columns)
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: (width - 24 * 2 - 10) / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  cardSelected: {
    backgroundColor: 'rgba(196,154,108,0.15)',
    borderColor: '#C49A6C',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  cardLabelSelected: {
    color: '#C49A6C',
  },
  cardDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
  },

  // Interest chips (2 columns)
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipSelected: {
    backgroundColor: 'rgba(196,154,108,0.15)',
    borderColor: '#C49A6C',
  },
  chipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#C49A6C',
  },

  // Region list (scrollable)
  regionScroll: {
    maxHeight: 280,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  regionRowSelected: {
    backgroundColor: 'rgba(196,154,108,0.15)',
    borderColor: '#C49A6C',
  },
  regionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
  },
  regionLabelSelected: {
    color: '#C49A6C',
  },
  regionDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },

  // Progress dots
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },

  // Navigation buttons
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 48,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Premium slide
  premiumFeatures: {
    marginTop: 16,
    gap: 10,
  },
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  premiumIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(196,154,108,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  priceCard: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  priceCardHighlight: {
    backgroundColor: 'rgba(196,154,108,0.18)',
    borderColor: 'rgba(196,154,108,0.5)',
  },
  priceLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  priceAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pricePer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  premiumBtnCol: {
    gap: 10,
  },
  skipFreeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipFreeText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
});
