/**
 * SensoryCard — Experiências multisensoriais associadas a um POI
 * Som ambiente · Aroma · Sabor local · Dica fotográfica
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

export interface SensoryData {
  sound_url?: string;       // URL de áudio ambiente
  sound_label?: string;     // e.g. "Rumor do rio Douro"
  aroma_note?: string;      // e.g. "Pinheiro bravo e urze"
  flavor_note?: string;     // e.g. "Queijo da Serra e mel de urze"
  photo_angle_tip?: string; // e.g. "Posiciona-te a NW às 17h para a luz dourada"
}

interface Props {
  data: SensoryData;
}

export default function SensoryCard({ data }: Props) {
  const [playingDesc, setPlayingDesc] = useState(false);

  const hasAny = data.aroma_note || data.flavor_note || data.photo_angle_tip || data.sound_label;
  if (!hasAny) return null;

  const speakSoundLabel = () => {
    if (!data.sound_label) return;
    if (playingDesc) { Speech.stop(); setPlayingDesc(false); return; }
    setPlayingDesc(true);
    Speech.speak(`Som ambiente: ${data.sound_label}`, {
      language: 'pt-PT', rate: 0.9,
      onDone: () => setPlayingDesc(false),
      onError: () => setPlayingDesc(false),
    });
  };

  return (
    <View style={s.container}>
      <View style={s.titleRow}>
        <MaterialIcons name="sensors" size={16} color="#C49A6C" />
        <Text style={s.title}>Experiência Sensorial</Text>
      </View>

      {/* Sound */}
      {data.sound_label && (
        <TouchableOpacity style={s.row} onPress={speakSoundLabel} activeOpacity={0.75}>
          <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
            <MaterialIcons name={playingDesc ? 'stop' : 'hearing'} size={18} color="#3B82F6" />
          </View>
          <View style={s.textCol}>
            <Text style={s.label}>Som Ambiente</Text>
            <Text style={s.value}>{data.sound_label}</Text>
          </View>
          {data.sound_url && Platform.OS !== 'web' && (
            <MaterialIcons name="play-circle" size={20} color="#3B82F6" />
          )}
        </TouchableOpacity>
      )}

      {/* Aroma */}
      {data.aroma_note && (
        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: '#F0FDF4' }]}>
            <MaterialIcons name="spa" size={18} color="#22C55E" />
          </View>
          <View style={s.textCol}>
            <Text style={s.label}>Aroma</Text>
            <Text style={s.value}>{data.aroma_note}</Text>
          </View>
        </View>
      )}

      {/* Flavor */}
      {data.flavor_note && (
        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: '#FEF2F2' }]}>
            <MaterialIcons name="restaurant" size={18} color="#EF4444" />
          </View>
          <View style={s.textCol}>
            <Text style={s.label}>Sabor Local</Text>
            <Text style={s.value}>{data.flavor_note}</Text>
          </View>
        </View>
      )}

      {/* Photo angle */}
      {data.photo_angle_tip && (
        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: '#FFFBEB' }]}>
            <MaterialIcons name="photo-camera" size={18} color="#F59E0B" />
          </View>
          <View style={s.textCol}>
            <Text style={s.label}>Melhor Ângulo</Text>
            <Text style={s.value}>{data.photo_angle_tip}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: 14,
    backgroundColor: '#FFFAF5',
    borderWidth: 1,
    borderColor: '#F5E6D3',
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#F5E6D3',
  },
  title: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FEF3E2',
  },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', color: '#92400E', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 13, color: '#374151', lineHeight: 18 },
});
