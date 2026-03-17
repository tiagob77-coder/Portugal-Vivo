/**
 * GeofenceControl - Simplified proximity monitoring toggle
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { geofenceService } from '../services/geofencing';
import { palette } from '../theme';

interface GeofenceControlProps {
  onPOIsLoad?: () => void;
}

export function GeofenceControl({ onPOIsLoad }: GeofenceControlProps) {
  const [isEnabled, setIsEnabled] = useState(false);

  const toggle = async () => {
    if (isEnabled) {
      geofenceService.stop();
      setIsEnabled(false);
    } else {
      await geofenceService.start({
        onAlert: (alerts: any) => {
          if (Platform.OS === 'web' && alerts.length > 0) {
            const msg = alerts.map((a: any) => a.message).join('\n');
            window.alert(msg);
          }
        },
        onNearby: () => { onPOIsLoad?.(); },
      });
      setIsEnabled(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MaterialIcons name="my-location" size={20} color={isEnabled ? '#22C55E' : '#94A3B8'} />
        <View style={styles.textCol}>
          <Text style={styles.title}>Proximidade</Text>
          <Text style={styles.subtitle}>Alerta quando perto de POIs raros</Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={toggle}
          trackColor={{ false: palette.gray[100], true: '#BBF7D0' }}
          thumbColor={isEnabled ? '#22C55E' : '#C8C3B8'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.gray[50],
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.gray[100],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.forest[500],
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});
