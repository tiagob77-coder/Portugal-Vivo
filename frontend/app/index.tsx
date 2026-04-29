import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Landing page redirector
 * Automatically redirects to the main tabs interface (Explorar page)
 */
export default function LandingRedirect() {
  // Simply redirect to tabs - the Explorar page is the main experience
  return <Redirect href="/(tabs)" />;
}
