import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface CoastalDataCardProps {
  zone: {
    condicoes: {
      ondas_media_m: number;
      vento_predominante: string;
      melhor_epoca: string;
      seguranca: string; // "muito_alta"|"alta"|"media"|"baixa"
    };
  };
  compact?: boolean;
}

function getSimulatedTideHeight(): { height: number; phase: string } {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  // Simulate tidal cycle: ~12.4h period, amplitude ~1.5m, base 1.5m
  const radians = (hour / 12.4) * 2 * Math.PI;
  const height = 1.5 + 1.5 * Math.sin(radians);
  // Determine phase from derivative
  const derivative = Math.cos(radians);
  const phase = derivative > 0 ? 'Enchente' : 'Vazante';
  return { height: Math.round(height * 10) / 10, phase };
}

function getSimulatedWindSpeed(vento: string): number {
  // Use hash of vento_predominante string to get deterministic-ish speed
  let seed = 0;
  for (let i = 0; i < vento.length; i++) {
    seed += vento.charCodeAt(i);
  }
  const hour = new Date().getHours();
  // Speed varies 15-35 km/h based on seed and hour
  const base = 15 + (seed % 12);
  const hourVariation = Math.round(4 * Math.sin((hour / 24) * 2 * Math.PI));
  return Math.max(10, Math.min(40, base + hourVariation));
}

function getSegurancaDisplay(seguranca: string): { label: string; color: string; bg: string; emoji: string } {
  switch (seguranca) {
    case 'muito_alta':
      return { label: 'Segura', color: '#16A34A', bg: '#DCFCE7', emoji: '🟢' };
    case 'alta':
      return { label: 'Boa', color: '#16A34A', bg: '#DCFCE7', emoji: '🟢' };
    case 'media':
      return { label: 'Atenção', color: '#D97706', bg: '#FEF3C7', emoji: '🟡' };
    case 'baixa':
      return { label: 'Perigosa', color: '#DC2626', bg: '#FEE2E2', emoji: '🔴' };
    default:
      return { label: 'Desconhecida', color: '#64748B', bg: '#F1F5F9', emoji: '⚪' };
  }
}

const CoastalDataCard: React.FC<CoastalDataCardProps> = ({ zone, compact = false }) => {
  const { condicoes } = zone;
  const tide = getSimulatedTideHeight();
  const windSpeed = getSimulatedWindSpeed(condicoes.vento_predominante);
  const seg = getSegurancaDisplay(condicoes.seguranca);

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.grid}>

        {/* Marés */}
        <View style={[styles.cell, styles.cellBorderRight, styles.cellBorderBottom]}>
          <View style={styles.cellHeader}>
            <MaterialIcons name="water" size={20} color="#0E7490" />
            <Text style={styles.cellLabel}>Marés</Text>
          </View>
          <Text style={styles.cellValue}>{tide.phase}</Text>
          <Text style={styles.cellSub}>{tide.height} m</Text>
        </View>

        {/* Ondas */}
        <View style={[styles.cell, styles.cellBorderBottom]}>
          <View style={styles.cellHeader}>
            <MaterialIcons name="waves" size={20} color="#0E7490" />
            <Text style={styles.cellLabel}>Ondas</Text>
          </View>
          <Text style={styles.cellValue}>{condicoes.ondas_media_m} m</Text>
          <Text style={styles.cellSub}>~12s · NW</Text>
        </View>

        {/* Vento */}
        <View style={[styles.cell, styles.cellBorderRight]}>
          <View style={styles.cellHeader}>
            <MaterialIcons name="air" size={20} color="#0E7490" />
            <Text style={styles.cellLabel}>Vento</Text>
          </View>
          <Text style={styles.cellValue}>{windSpeed} km/h</Text>
          <Text style={styles.cellSub}>{condicoes.vento_predominante}</Text>
        </View>

        {/* Segurança */}
        <View style={styles.cell}>
          <View style={styles.cellHeader}>
            <MaterialIcons name="shield" size={20} color="#0E7490" />
            <Text style={styles.cellLabel}>Segurança</Text>
          </View>
          <View style={[styles.segurancaBadge, { backgroundColor: seg.bg }]}>
            <Text style={[styles.segurancaText, { color: seg.color }]}>
              {seg.emoji} {seg.label}
            </Text>
          </View>
        </View>

      </View>

      {/* Melhor época */}
      <View style={styles.epocaRow}>
        <MaterialIcons name="wb-sunny" size={14} color="#D97706" />
        <Text style={styles.epocaLabel}>Melhor época:</Text>
        <View style={styles.epocaChip}>
          <Text style={styles.epocaChipText}>{condicoes.melhor_epoca}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0E7490',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginTop: 12,
  },
  cardCompact: {
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    padding: 14,
    gap: 4,
  },
  cellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: '#E0F2FE',
  },
  cellBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0F2FE',
  },
  cellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  cellLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cellValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cellSub: {
    fontSize: 11,
    color: '#64748B',
  },
  segurancaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  segurancaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  epocaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0F2FE',
    backgroundColor: '#F0F7FA',
  },
  epocaLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  epocaChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  epocaChipText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
  },
});

export default CoastalDataCard;
