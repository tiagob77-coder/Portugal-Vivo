import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { palette } from '../theme';
import logger from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Algo correu mal</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'Erro inesperado'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </TouchableOpacity>
          {__DEV__ && this.state.error && (
            <ScrollView style={styles.debugContainer}>
              <Text style={styles.debugText}>{this.state.error.stack}</Text>
            </ScrollView>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: palette.gray[900],
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.white,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: palette.gray[400],
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 300,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: palette.rust[500],
  },
  buttonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 24,
    maxHeight: 200,
    width: '100%',
    backgroundColor: palette.black,
    borderRadius: 8,
    padding: 12,
  },
  debugText: {
    fontSize: 10,
    color: palette.rust[300],
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;
