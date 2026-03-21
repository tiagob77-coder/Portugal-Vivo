/**
 * ProximityMonitor - Manages geofencing lifecycle and renders alert banners
 * Mount this once in the tabs layout to enable proximity monitoring app-wide
 */
import React, { useState, useEffect, useCallback } from 'react';
// import { Platform } from 'react-native';
import geofenceService, { ProximityAlert } from '../services/geofencing';
import ProximityAlertBanner from './ProximityAlertBanner';

interface Props {
  enabled?: boolean;
}

export default function ProximityMonitor({ enabled = true }: Props) {
  const [pendingAlerts, setPendingAlerts] = useState<ProximityAlert[]>([]);
  const [isStarted, setIsStarted] = useState(false);

  const handleNewAlerts = useCallback((alerts: ProximityAlert[]) => {
    setPendingAlerts(alerts);
  }, []);

  useEffect(() => {
    if (!enabled || isStarted) return;

    const startMonitoring = async () => {
      await geofenceService.start({
        onAlert: handleNewAlerts,
      });
      setIsStarted(true);
    };

    // Delay start to let the app settle
    const timer = setTimeout(startMonitoring, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [enabled, isStarted, handleNewAlerts]);

  useEffect(() => {
    return () => {
      // Don't stop service on unmount - it should keep running
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setPendingAlerts([]);
  }, []);

  if (pendingAlerts.length === 0) return null;

  return (
    <ProximityAlertBanner
      alerts={pendingAlerts}
      onDismiss={handleDismiss}
    />
  );
}
