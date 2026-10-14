/**
 * NavigationChooser — bottom sheet "Navegar para o local"
 *
 * Deixa o utilizador escolher a app de navegação (Google Maps ou Waze)
 * para chegar a um POI, em vez de abrir diretamente um único serviço.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

interface NavigationChooserProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  lat: number;
  lng: number;
  /** Ex.: "12 km" — mostrado como "a 12 km da sua localização" */
  distanceLabel?: string;
}

const openExternal = (url: string) => {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
  } else {
    Linking.openURL(url).catch(() => {});
  }
};

export default function NavigationChooser({
  visible,
  onClose,
  name,
  lat,
  lng,
  distanceLabel,
}: NavigationChooserProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const openGoogleMaps = () => {
    openExternal(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    onClose();
  };

  const openWaze = () => {
    openExternal(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('components.navigationChooser.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {name}
            {distanceLabel ? ` · ${t('components.navigationChooser.distanceAway', { distance: distanceLabel })}` : ''}
          </Text>

          <TouchableOpacity
            style={[styles.option, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}
            onPress={openGoogleMaps}
            accessibilityRole="button"
            accessibilityLabel={t('components.navigationChooser.googleA11y')}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#4285F4' }]}>
              <MaterialIcons name="map" size={20} color="#FFF" />
            </View>
            <View style={styles.optionBody}>
              <Text style={[styles.optionName, { color: colors.textPrimary }]}>Google Maps</Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>{t('components.navigationChooser.googleDesc')}</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}
            onPress={openWaze}
            accessibilityRole="button"
            accessibilityLabel={t('components.navigationChooser.wazeA11y')}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#05C8F7' }]}>
              <MaterialIcons name="directions-car" size={20} color="#FFF" />
            </View>
            <View style={styles.optionBody}>
              <Text style={[styles.optionName, { color: colors.textPrimary }]}>Waze</Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>{t('components.navigationChooser.wazeDesc')}</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('components.navigationChooser.cancelA11y')}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14,30,26,0.62)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: {
    flex: 1,
  },
  optionName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 11.5,
    marginTop: 1,
  },
  cancelButton: {
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
