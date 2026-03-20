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

const SLIDES = [
  {
    id: 'welcome',
    icon: 'terrain' as const,
    iconColor: '#2E5E4E',
    bg: ['#1E3A3F', '#2A5F6B'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Ribeira_do_Porto_%28Portugal%29.jpg/800px-Ribeira_do_Porto_%28Portugal%29.jpg',
    label: 'BEM-VINDO',
    title: 'Descobre o\nPatrimonio Vivo',
    desc: 'Mais de 2 000 lugares, sabores e historias que fazem Portugal unico. A tua jornada começa aqui.',
  },
  {
    id: 'map',
    icon: 'map' as const,
    iconColor: '#3B82F6',
    bg: ['#1E293B', '#1E3A5F'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Pena_Palace_in_Sintra_-_panorama_%28cropped%29.jpg/800px-Pena_Palace_in_Sintra_-_panorama_%28cropped%29.jpg',
    label: 'EXPLORA',
    title: 'Mapa Interativo\nPerto de Ti',
    desc: 'Encontra monumentos, aldeias historicas, paisagens e gastronomia autentica a poucos passos.',
  },
  {
    id: 'narrative',
    icon: 'auto-stories' as const,
    iconColor: '#C49A6C',
    bg: ['#2D1B00', '#4A2E00'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Douro_Vinhateiro2.jpg/800px-Douro_Vinhateiro2.jpg',
    label: 'NARRATIVAS IA',
    title: 'Historias Geradas\npor Inteligencia Artificial',
    desc: 'Cada lugar tem uma historia para contar. Escolhe o estilo — historico, mistico ou poético — e ouve ou le a narrativa.',
  },
  {
    id: 'checkin',
    icon: 'flag' as const,
    iconColor: '#22C55E',
    bg: ['#052e16', '#14532d'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Panorama_of_Lisbon_%2811977231484%29.jpg/800px-Panorama_of_Lisbon_%2811977231484%29.jpg',
    label: 'CHECK-IN',
    title: 'Coleciona\nMemorías Reais',
    desc: 'Faz check-in nos locais que visitas, coleciona o teu roteiro pessoal e partilha com amigos.',
  },
  {
    id: 'offline',
    icon: 'wifi-off' as const,
    iconColor: '#A855F7',
    bg: ['#1a0533', '#2d0a5e'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Azores_paysage.jpg/800px-Azores_paysage.jpg',
    label: 'OFFLINE',
    title: 'Funciona Sem\nInternet',
    desc: 'Os teus favoritos e narrativas ficam guardados no dispositivo. Explora sem rede, em qualquer lugar.',
  },
  {
    id: 'premium',
    icon: 'diamond' as const,
    iconColor: '#C49A6C',
    bg: ['#2D1500', '#5C2E00'] as [string, string],
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Geres1.jpg/800px-Geres1.jpg',
    label: 'DESCOBRIDOR',
    title: 'Desbloqueia\nPortugal Completo',
    desc: 'Roteiros IA, áudio guias, modo offline e muito mais. Experimenta 7 dias grátis.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      goTo(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    router.replace('/(tabs)');
  };

  const handleTryPremium = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    router.replace('/premium' as any);
  };

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
  };

  const slide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;
  const isPremiumSlide = slide.id === 'premium';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
      >
        {SLIDES.map((s, i) => (
          <View key={s.id} style={{ width, height }}>
            <Image
              source={{ uri: s.image }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <LinearGradient
              colors={[`${s.bg[0]}CC`, `${s.bg[1]}F0`, '#000000EE']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </ScrollView>

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 16 }]}
          onPress={handleFinish}
        >
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      )}

      {/* Content overlay (non-scrollable, updates with index) */}
      <View
        style={[styles.contentWrap, { paddingBottom: insets.bottom + 24, paddingTop: insets.top + 60 }]}
        pointerEvents="box-none"
      >
        {/* Icon badge */}
        <View style={[styles.iconBadge, { backgroundColor: slide.iconColor + '33', borderColor: slide.iconColor + '66' }]}>
          <MaterialIcons name={slide.icon} size={36} color={slide.iconColor} />
        </View>

        {/* Label */}
        <Text style={styles.slideLabel}>{slide.label}</Text>

        {/* Title */}
        <Text style={styles.slideTitle}>{slide.title}</Text>

        {/* Description */}
        <Text style={styles.slideDesc}>{slide.desc}</Text>

        {/* Feature bullets on slide 0 */}
        {currentIndex === 0 && (
          <View style={styles.bullets}>
            {[
              { icon: 'place' as const, text: '2 000+ lugares em Portugal' },
              { icon: 'auto-stories' as const, text: 'Narrativas por IA (Premium)' },
              { icon: 'wifi-off' as const, text: 'Acesso offline aos favoritos' },
            ].map((b) => (
              <View key={b.text} style={styles.bulletRow}>
                <MaterialIcons name={b.icon} size={16} color="rgba(255,255,255,0.7)" />
                <Text style={styles.bulletText}>{b.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Premium features on last slide */}
        {isPremiumSlide && (
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
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <View
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons */}
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
              style={[styles.nextBtn, { backgroundColor: slide.iconColor }]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Continuar</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
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
  contentWrap: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  } as any,
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  slideLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  slideTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 42,
    marginBottom: 16,
  },
  slideDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 26,
    marginBottom: 8,
  },
  bullets: {
    marginTop: 20,
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
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
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
    flex: 1,
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
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
  },
});
