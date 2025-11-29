import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for BarcodeScanner
 * Priority: P0 - Critical
 * Issue: Scanner crashes leave users stuck with no recovery option
 * Fix: Catch errors and provide reset button
 *
 * IMPORTANT: This is a WRAPPER ONLY - does not modify BarcodeScanner.js logic
 */
export default class ScannerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('Scanner Error:', error);
    console.error('Error Info:', errorInfo);

    // Send to Sentry if configured
    if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
      const Sentry = require('@sentry/react-native');
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  handleReset = () => {
    // Reset error state to retry
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Scanner Error</Text>
          <Text style={styles.errorMessage}>
            The scanner encountered an unexpected error.
          </Text>
          {this.state.error && (
            <Text style={styles.errorDetails}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity
            style={styles.resetButton}
            onPress={this.handleReset}
          >
            <Text style={styles.resetButtonText}>🔄 Reset Scanner</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  errorDetails: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  resetButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
