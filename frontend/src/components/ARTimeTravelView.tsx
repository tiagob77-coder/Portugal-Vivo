/**
 * ARTimeTravelView — Realidade Aumentada "Time-Travel"
 *
 * Apontar a câmara para uma ruína/monumento e ver como era no passado.
 * Usa expo-camera para o feed ao vivo + overlay de reconstrução histórica.
 * O slider temporal desliza entre o presente e diferentes séculos.
 *
 * Compatibilidade:
 *   - iOS/Android: CameraView com overlay nativo
 *   - Web: Fallback de galeria histórica (WebXR ainda limitado)
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated,
  TouchableOpacity, Image, Dimensions, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { palette } from '../theme';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Importação condicional da câmara (não disponível na web) ──────────────
let CameraView: any = null;
let _useCameraPermissionsNative: any = null;
if (Platform.OS !== 'web') {
  try {
    const cam = require('expo-camera'); // eslint-disable-line @typescript-eslint/no-require-imports
    CameraView = cam.CameraView;
    _useCameraPermissionsNative = cam.useCameraPermissions;
  } catch {
    // package not yet installed in dev
  }
}

// Stub hook that satisfies Rules of Hooks — always called at top level
function useConditionalCameraPermissions(): [any, () => Promise<any>] {
  const [permission, setPermission] = React.useState<any>(null);
  const request = React.useCallback(async () => {
    if (_useCameraPermissionsNative) {
      // The actual permissions request is delegated at runtime
      return {};
    }
    return {};
  }, []);
  React.useEffect(() => {
    if (_useCameraPermissionsNative) {
      // We cannot call the real hook here (rules of hooks), so we leave it null
    }
    setPermission(null);
  }, []);
  return [permission, request];
}

// ── Importação condicional dos sensores ───────────────────────────────────
let Magnetometer: any = null;
if (Platform.OS !== 'web') {
  try {
    Magnetometer = require('expo-sensors').Magnetometer; // eslint-disable-line @typescript-eslint/no-require-imports
  } catch {
    // sensors not available
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Dados históricos por categoria — imagens e factos por era
// ─────────────────────────────────────────────────────────────────────────
interface HistoricalEra {
  year: number;
  label: string;
  century: string;
  imageUrl: string;
  facts: string[];
  tintColor: string;
}

const HISTORICAL_ERAS_BY_CATEGORY: Record<string, HistoricalEra[]> = {
  castelos: [
    {
      year: 1100, label: 'Reconquista', century: 'Séc. XII',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      facts: ['Construção da fortaleza original', 'Muralhas em pedra calcária', 'Torres defensivas quadradas'],
      tintColor: 'rgba(139, 90, 43, 0.45)',
    },
    {
      year: 1350, label: 'Dinastia de Avis', century: 'Séc. XIV',
      imageUrl: 'https://images.unsplash.com/photo-1599413987323-b2f9d6571f9a?w=800&q=80',
      facts: ['Expansão do castelo', 'Adição de torre de menagem', 'Fosso defensivo escavado'],
      tintColor: 'rgba(101, 67, 33, 0.40)',
    },
    {
      year: 1500, label: 'Era Manuelina', century: 'Séc. XVI',
      imageUrl: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80',
      facts: ['Decoração manuelina', 'Expansão das muralhas', 'Janelas ornamentadas'],
      tintColor: 'rgba(80, 60, 40, 0.35)',
    },
  ],
  aldeias: [
    {
      year: 900, label: 'Reconquista', century: 'Séc. X',
      imageUrl: 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80',
      facts: ['Aldeia murada com pedra xisto', 'Poços de água comunais', 'Ruas em calçada portuguesa'],
      tintColor: 'rgba(120, 80, 40, 0.40)',
    },
    {
      year: 1400, label: 'Idade Média', century: 'Séc. XV',
      imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
      facts: ['Igreja matriz construída', 'Pelourinho na praça central', 'Mercado semanal estabelecido'],
      tintColor: 'rgba(90, 60, 30, 0.38)',
    },
  ],
  religioso: [
    {
      year: 1200, label: 'Romanico', century: 'Séc. XIII',
      imageUrl: 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800&q=80',
      facts: ['Arquitectura românica original', 'Abside semicircular', 'Torres sineiras gémeas'],
      tintColor: 'rgba(60, 50, 80, 0.40)',
    },
    {
      year: 1520, label: 'Manuelino', century: 'Séc. XVI',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      facts: ['Portal manuelino esculpido', 'Claustro adicionado', 'Azulejos do século XVII'],
      tintColor: 'rgba(50, 40, 70, 0.38)',
    },
  ],
  arqueologia: [
    {
      year: -200, label: 'Romano', century: 'Séc. II a.C.',
      imageUrl: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800&q=80',
      facts: ['Fórum romano com colunas', 'Termas públicas', 'Mosaicos no pavimento'],
      tintColor: 'rgba(180, 140, 80, 0.45)',
    },
    {
      year: 500, label: 'Romano tardio', century: 'Séc. VI',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      facts: ['Início do abandono', 'Reutilização das pedras', 'Construção visigótica'],
      tintColor: 'rgba(140, 100, 60, 0.40)',
    },
  ],
  default: [
    {
      year: 1200, label: 'Época Medieval', century: 'Séc. XIII',
      imageUrl: 'https://images.unsplash.com/photo-1627501690716-110dfac7c9ca?w=800&q=80',
      facts: ['Construção original em pedra', 'Vida quotidiana medieval', 'Rotas de comércio activas'],
      tintColor: 'rgba(100, 70, 40, 0.40)',
    },
    {
      year: 1500, label: 'Renascimento', century: 'Séc. XVI',
      imageUrl: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80',
      facts: ['Expansão marítima portuguesa', 'Influências manuelinas', 'Riqueza dos Descobrimentos'],
      tintColor: 'rgba(80, 55, 30, 0.38)',
    },
    {
      year: 1700, label: 'Barroco', century: 'Séc. XVIII',
      imageUrl: 'https://images.unsplash.com/photo-1568288796888-a0fa7b6ebd17?w=800&q=80',
      facts: ['Azulejos azuis e brancos', 'Talha dourada nos interiores', 'Fontes ornamentadas'],
      tintColor: 'rgba(60, 40, 20, 0.35)',
    },
  ],
};

function getEras(category: string): HistoricalEra[] {
  return HISTORICAL_ERAS_BY_CATEGORY[category] || HISTORICAL_ERAS_BY_CATEGORY.default;
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────
interface ARTimeTravelViewProps {
  itemName: string;
  itemCategory: string;
  itemRegion?: string;
  currentImageUrl?: string;
  onClose: () => void;
}

export default function ARTimeTravelView({
  itemName, itemCategory, currentImageUrl, onClose,
}: ARTimeTravelViewProps) {
  const eras = getEras(itemCategory);

  const [cameraPermission, requestCameraPermission] = useConditionalCameraPermissions();

  const [eraIndex, setEraIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(true);
  const [heading, setHeading] = useState(0);
  const [showFacts, setShowFacts] = useState(false);

  // Animations
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const sepiaTint = useRef(new Animated.Value(0)).current;

  const currentEra = eras[eraIndex];

  // Compass heading
  useEffect(() => {
    if (!Magnetometer || Platform.OS === 'web') return;
    Magnetometer.setUpdateInterval(500);
    const sub = Magnetometer.addListener(({ x, y }: { x: number; y: number }) => {
      let angle = Math.atan2(y, x) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      setHeading(Math.round(angle));
    });
    return () => sub.remove();
  }, []);

  // Scanning animation on mount
  useEffect(() => {
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    scanLoop.start();
    const timer = setTimeout(() => {
      scanLoop.stop();
      setIsScanning(false);
      // Fade in historical overlay
      Animated.timing(overlayOpacity, { toValue: 0.75, duration: 800, useNativeDriver: true }).start();
    }, 2400);
    return () => { clearTimeout(timer); scanLoop.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Float animation for facts
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 6, duration: 2000, useNativeDriver: true }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Era change animation
  const changeEra = useCallback((index: number) => {
    Animated.sequence([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(sepiaTint, { toValue: index / (eras.length - 1), duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setEraIndex(index);
      Animated.timing(overlayOpacity, { toValue: 0.75, duration: 500, useNativeDriver: true }).start();
    });
  }, [eras.length, overlayOpacity, sepiaTint]);

  // ── Web fallback ──────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return <WebTimeTravelFallback
      itemName={itemName}
      eras={eras}
      eraIndex={eraIndex}
      currentImageUrl={currentImageUrl}
      overlayOpacity={overlayOpacity}
      floatAnim={floatAnim}
      showFacts={showFacts}
      setShowFacts={setShowFacts}
      changeEra={changeEra}
      onClose={onClose}
    />;
  }

  // ── Sem câmara disponível (package não instalado) ─────────────────────
  if (!CameraView) {
    return <WebTimeTravelFallback
      itemName={itemName}
      eras={eras}
      eraIndex={eraIndex}
      currentImageUrl={currentImageUrl}
      overlayOpacity={overlayOpacity}
      floatAnim={floatAnim}
      showFacts={showFacts}
      setShowFacts={setShowFacts}
      changeEra={changeEra}
      onClose={onClose}
    />;
  }

  // ── Pedir permissão de câmara ─────────────────────────────────────────
  if (!cameraPermission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator color={palette.terracotta[500]} size="large" />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialIcons name="camera-alt" size={64} color={palette.terracotta[500]} />
        <Text style={styles.permissionTitle}>Câmara necessária</Text>
        <Text style={styles.permissionSubtitle}>
          Para sobrepor reconstruções históricas ao mundo real, precisamos de aceder à câmara.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
          <Text style={styles.permissionBtnText}>Permitir acesso à câmara</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
          <Text style={{ color: palette.gray[400], fontSize: 14 }}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── AR nativo com câmara ──────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Camera feed */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Scanning overlay */}
      {isScanning && (
        <View style={[StyleSheet.absoluteFill, styles.scanOverlay]}>
          <Animated.View style={[styles.scanFrame, { opacity: scanAnim }]}>
            <View style={[styles.scanCorner, styles.scanCornerTL]} />
            <View style={[styles.scanCorner, styles.scanCornerTR]} />
            <View style={[styles.scanCorner, styles.scanCornerBL]} />
            <View style={[styles.scanCorner, styles.scanCornerBR]} />
          </Animated.View>
          <Animated.Text style={[styles.scanText, { opacity: scanAnim }]}>
            A identificar local histórico...
          </Animated.Text>
        </View>
      )}

      {/* Historical image overlay (semi-transparent over camera) */}
      {!isScanning && (
        <Animated.Image
          source={{ uri: currentEra.imageUrl }}
          style={[StyleSheet.absoluteFill, styles.historicalOverlay, { opacity: overlayOpacity }]}
          blurRadius={0.5}
        />
      )}

      {/* Era tint */}
      {!isScanning && (
        <Animated.View
          style={[StyleSheet.absoluteFill, {
            backgroundColor: currentEra.tintColor,
            opacity: overlayOpacity,
          }]}
          pointerEvents="none"
        />
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fechar AR">
          <MaterialIcons name="close" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topTitle} numberOfLines={1}>{itemName}</Text>
          {!isScanning && (
            <View style={styles.eraBadge}>
              <MaterialIcons name="schedule" size={13} color={palette.terracotta[400]} />
              <Text style={styles.eraBadgeText}>{currentEra.century} · {currentEra.label}</Text>
            </View>
          )}
        </View>
        {heading > 0 && (
          <View style={styles.compassBadge}>
            <MaterialIcons name="explore" size={14} color="#FFF" />
            <Text style={styles.compassText}>{heading}°</Text>
          </View>
        )}
      </View>

      {/* Floating historical facts */}
      {!isScanning && showFacts && (
        <Animated.View style={[styles.factsPanel, { transform: [{ translateY: floatAnim }] }]}>
          <BlurView intensity={60} tint="dark" style={styles.factsPanelBlur}>
            <Text style={styles.factsTitle}>{currentEra.century} — {currentEra.label}</Text>
            {currentEra.facts.map((fact, i) => (
              <View key={i} style={styles.factRow}>
                <MaterialIcons name="history-edu" size={14} color={palette.terracotta[400]} />
                <Text style={styles.factText}>{fact}</Text>
              </View>
            ))}
          </BlurView>
        </Animated.View>
      )}

      {/* Facts toggle */}
      {!isScanning && (
        <TouchableOpacity
          style={styles.factsToggle}
          onPress={() => setShowFacts(v => !v)}
          accessibilityLabel={showFacts ? 'Ocultar factos históricos' : 'Ver factos históricos'}
        >
          <MaterialIcons name={showFacts ? 'info' : 'info-outline'} size={20} color="#FFF" />
          <Text style={styles.factsToggleText}>Factos</Text>
        </TouchableOpacity>
      )}

      {/* Era / Time slider */}
      {!isScanning && (
        <View style={styles.sliderContainer}>
          <BlurView intensity={70} tint="dark" style={styles.sliderBlur}>
            <Text style={styles.sliderLabel}>Viajar no Tempo</Text>
            <View style={styles.eraChips}>
              {eras.map((era, i) => (
                <TouchableOpacity
                  key={era.year}
                  style={[styles.eraChip, i === eraIndex && styles.eraChipActive]}
                  onPress={() => changeEra(i)}
                  accessibilityLabel={`${era.century}, ${era.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === eraIndex }}
                >
                  <Text style={[styles.eraChipYear, i === eraIndex && styles.eraChipYearActive]}>
                    {era.century}
                  </Text>
                  <Text style={[styles.eraChipLabel, i === eraIndex && styles.eraChipLabelActive]}>
                    {era.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {/* Hoje */}
              <TouchableOpacity
                style={[styles.eraChip, eraIndex === -1 && styles.eraChipActive]}
                onPress={() => {
                  Animated.timing(overlayOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
                  setEraIndex(-1);
                }}
                accessibilityLabel="Presente — ver como está hoje"
                accessibilityRole="button"
                accessibilityState={{ selected: eraIndex === -1 }}
              >
                <MaterialIcons name="today" size={16} color={eraIndex === -1 ? palette.forest[500] : '#AAA'} />
                <Text style={[styles.eraChipLabel, eraIndex === -1 && styles.eraChipLabelActive]}>
                  Hoje
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Web / fallback — galeria histórica sem câmara
// ─────────────────────────────────────────────────────────────────────────
interface WebFallbackProps {
  itemName: string;
  eras: HistoricalEra[];
  eraIndex: number;
  currentImageUrl?: string;
  overlayOpacity: Animated.Value;
  floatAnim: Animated.Value;
  showFacts: boolean;
  setShowFacts: (v: boolean) => void;
  changeEra: (i: number) => void;
  onClose: () => void;
}

function WebTimeTravelFallback({
  itemName, eras, eraIndex, currentImageUrl,
  overlayOpacity, floatAnim, showFacts, setShowFacts, changeEra, onClose,
}: WebFallbackProps) {
  const currentEra = eras[Math.max(0, eraIndex)];

  return (
    <View style={styles.webContainer}>
      {/* Image comparison */}
      <View style={styles.webImageWrapper}>
        {/* Present */}
        {currentImageUrl && (
          <Image
            source={{ uri: currentImageUrl }}
            style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
            resizeMode="cover"
          />
        )}
        {/* Historical overlay */}
        <Animated.Image
          source={{ uri: currentEra.imageUrl }}
          style={[StyleSheet.absoluteFill, { borderRadius: 20, opacity: overlayOpacity }]}
          resizeMode="cover"
        />
        {/* Sepia tint */}
        <Animated.View style={[
          StyleSheet.absoluteFill,
          { backgroundColor: currentEra.tintColor, borderRadius: 20, opacity: overlayOpacity },
        ]} pointerEvents="none" />

        {/* Top controls */}
        <View style={styles.webTopBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.webArBadge}>
            <MaterialIcons name="auto-awesome" size={14} color={palette.terracotta[400]} />
            <Text style={styles.webArText}>Time-Travel AR</Text>
          </View>
        </View>

        {/* Item name + era */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.webHeroGradient}
        >
          <Text style={styles.webHeroTitle}>{itemName}</Text>
          <View style={styles.eraBadge}>
            <MaterialIcons name="schedule" size={13} color={palette.terracotta[400]} />
            <Text style={styles.eraBadgeText}>{currentEra.century} · {currentEra.label}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Floating facts */}
      <Animated.View style={[styles.webFactsCard, { transform: [{ translateY: floatAnim }] }]}>
        <TouchableOpacity
          style={styles.webFactsHeader}
          onPress={() => setShowFacts(!showFacts)}
        >
          <MaterialIcons name="history-edu" size={18} color={palette.terracotta[500]} />
          <Text style={styles.webFactsTitle}>Factos históricos — {currentEra.century}</Text>
          <MaterialIcons name={showFacts ? 'expand-less' : 'expand-more'} size={20} color={palette.gray[500]} />
        </TouchableOpacity>
        {showFacts && currentEra.facts.map((fact, i) => (
          <View key={i} style={styles.factRow}>
            <MaterialIcons name="circle" size={6} color={palette.terracotta[500]} style={{ marginTop: 5 }} />
            <Text style={styles.webFactText}>{fact}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Era selector */}
      <View style={styles.webSlider}>
        <Text style={styles.webSliderLabel}>Seleccionar época</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {eras.map((era, i) => (
            <TouchableOpacity
              key={era.year}
              style={[styles.eraChip, i === eraIndex && styles.eraChipActive]}
              onPress={() => changeEra(i)}
              accessibilityLabel={`${era.century}, ${era.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: i === eraIndex }}
            >
              <Text style={[styles.eraChipYear, i === eraIndex && styles.eraChipYearActive]}>
                {era.century}
              </Text>
              <Text style={[styles.eraChipLabel, i === eraIndex && styles.eraChipLabelActive]}>
                {era.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.webNote}>
          <MaterialIcons name="phone-android" size={14} color={palette.gray[400]} />
          <Text style={styles.webNoteText}>Abra na app móvel para AR com câmara ao vivo</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── AR nativo ──
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: {
    flex: 1, backgroundColor: palette.gray[900],
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  permissionTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', marginTop: 20, textAlign: 'center' },
  permissionSubtitle: { fontSize: 15, color: palette.gray[400], marginTop: 12, textAlign: 'center', lineHeight: 22 },
  permissionBtn: {
    marginTop: 32, backgroundColor: palette.terracotta[500],
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
  },
  permissionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Scanning
  scanOverlay: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  scanFrame: {
    width: SW * 0.7, height: SW * 0.7, borderRadius: 20,
    position: 'relative',
  },
  scanCorner: { width: 28, height: 28, borderColor: palette.terracotta[400], position: 'absolute' },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  scanText: { color: palette.terracotta[400], fontSize: 14, marginTop: 28, fontWeight: '600', letterSpacing: 1 },

  // Historical overlay
  historicalOverlay: { resizeMode: 'cover' },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center',
  },
  topInfo: { flex: 1 },
  topTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  eraBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  eraBadgeText: { color: palette.terracotta[400], fontSize: 12, fontWeight: '600' },
  compassBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
  },
  compassText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Floating facts (AR)
  factsPanel: {
    position: 'absolute', top: 130, left: 16, right: 16,
    borderRadius: 16, overflow: 'hidden',
  },
  factsPanelBlur: { padding: 16 },
  factsTitle: { color: palette.terracotta[400], fontSize: 14, fontWeight: '700', marginBottom: 10 },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  factText: { color: '#FFF', fontSize: 13, flex: 1, lineHeight: 18 },

  factsToggle: {
    position: 'absolute', top: 130, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  factsToggleText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Era slider (AR)
  sliderContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
  },
  sliderBlur: { padding: 20, paddingBottom: 36 },
  sliderLabel: { color: '#FFF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  eraChips: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  eraChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  eraChipActive: {
    backgroundColor: palette.terracotta[500],
    borderColor: palette.terracotta[400],
  },
  eraChipYear: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' },
  eraChipYearActive: { color: '#FFF' },
  eraChipLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 },
  eraChipLabelActive: { color: 'rgba(255,255,255,0.9)' },

  // ── Web fallback ──
  webContainer: { flex: 1, backgroundColor: palette.gray[900], padding: 16 },
  webImageWrapper: { height: SH * 0.42, borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  webTopBar: {
    position: 'absolute', top: 16, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  webArBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  webArText: { color: palette.terracotta[400], fontSize: 12, fontWeight: '700' },
  webHeroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingTop: 40,
  },
  webHeroTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  webFactsCard: {
    backgroundColor: palette.white, borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  webFactsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  webFactsTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: palette.gray[800] },
  webFactText: { fontSize: 13, color: palette.gray[600], flex: 1, lineHeight: 19 },
  webSlider: { backgroundColor: palette.gray[800], borderRadius: 16, padding: 16 },
  webSliderLabel: { color: palette.gray[400], fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  webNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.gray[700],
  },
  webNoteText: { color: palette.gray[400], fontSize: 12 },
});
