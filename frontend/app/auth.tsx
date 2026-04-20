/**
 * Authentication Screens
 * Login, Register, and Password Recovery
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import { useTheme, palette, spacing, borders, withOpacity } from '../src/theme';

import { API_URL } from '../src/config/api';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { login: googleLogin, isLoading: googleLoading } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Email inválido';
    }

    if (mode !== 'forgot') {
      if (!password) {
        newErrors.password = 'Password é obrigatória';
      } else if (password.length < 6) {
        newErrors.password = 'Password deve ter pelo menos 6 caracteres';
      }
    }

    if (mode === 'register') {
      if (!name) {
        newErrors.name = 'Nome é obrigatório';
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords não coincidem';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        Alert.alert('Erro', error.detail || 'Credenciais inválidas');
        return;
      }

      const _data = await response.json();
      Alert.alert('Sucesso', 'Login efetuado com sucesso!');
      router.replace('/(tabs)/descobrir');
    } catch (_error) {
      Alert.alert('Erro', 'Não foi possível fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const error = await response.json();
        Alert.alert('Erro', error.detail || 'Não foi possível criar conta');
        return;
      }

      Alert.alert(
        'Conta Criada!',
        'A sua conta foi criada com sucesso. Faça login para continuar.',
        [{ text: 'OK', onPress: () => setMode('login') }]
      );
    } catch (_error) {
      Alert.alert('Erro', 'Não foi possível criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !validateEmail(email)) {
      setErrors({ email: 'Introduza um email válido' });
      return;
    }

    setIsLoading(true);
    try {
      const _response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      Alert.alert(
        'Email Enviado',
        'Se o email existir na nossa base de dados, receberá instruções para repor a password.',
        [{ text: 'OK', onPress: () => setMode('login') }]
      );
    } catch (_error) {
      Alert.alert('Erro', 'Não foi possível processar o pedido.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await googleLogin();
      router.replace('/(tabs)/descobrir');
    } catch (error) {
      console.error('Google login error:', error);
    }
  };

  const handleSubmit = () => {
    switch (mode) {
      case 'login':
        handleEmailLogin();
        break;
      case 'register':
        handleRegister();
        break;
      case 'forgot':
        handleForgotPassword();
        break;
    }
  };

  const renderInput = (
    icon: string,
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    error?: string,
    options?: {
      secureTextEntry?: boolean;
      keyboardType?: 'default' | 'email-address';
      autoCapitalize?: 'none' | 'sentences';
    }
  ) => (
    <View style={styles.inputWrapper}>
      <View style={[styles.inputContainer, { backgroundColor: colors.primary, borderColor: colors.border }, error && { borderColor: colors.error }]}>
        <MaterialIcons name={icon as any} size={20} color={colors.textMuted} />
        <TextInput
          style={[styles.input, { color: colors.textOnPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={options?.secureTextEntry && !showPassword}
          keyboardType={options?.keyboardType || 'default'}
          autoCapitalize={options?.autoCapitalize || 'none'}
        />
        {options?.secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={[palette.forest[500], palette.forest[600]]}
        style={[styles.gradient, { paddingTop: insets.top }]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <MaterialIcons name="arrow-back" size={24} color={colors.textOnPrimary} />
            </TouchableOpacity>

            <View style={styles.logoContainer}>
              <MaterialIcons name="castle" size={48} color={colors.accent} />
              <Text style={[styles.logoText, { color: colors.textOnPrimary }]}>Portugal Vivo</Text>
              <Text style={[styles.logoSubtext, { color: colors.accent }]}>de Portugal</Text>
            </View>
          </View>

          {/* Form */}
          <View style={[styles.formContainer, { backgroundColor: withOpacity(palette.gray[800], 0.8) }]}>
            <Text style={[styles.title, { color: colors.textOnPrimary }]}>
              {mode === 'login' && 'Bem-vindo de volta'}
              {mode === 'register' && 'Criar Conta'}
              {mode === 'forgot' && 'Recuperar Password'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {mode === 'login' && 'Entre na sua conta para continuar'}
              {mode === 'register' && 'Junte-se à comunidade'}
              {mode === 'forgot' && 'Introduza o seu email para repor a password'}
            </Text>

            {mode === 'register' && (
              renderInput('person', 'Nome completo', name, setName, errors.name)
            )}

            {renderInput(
              'email',
              'Email',
              email,
              setEmail,
              errors.email,
              { keyboardType: 'email-address', autoCapitalize: 'none' }
            )}

            {mode !== 'forgot' && (
              renderInput(
                'lock',
                'Password',
                password,
                setPassword,
                errors.password,
                { secureTextEntry: true }
              )
            )}

            {mode === 'register' && (
              renderInput(
                'lock',
                'Confirmar Password',
                confirmPassword,
                setConfirmPassword,
                errors.confirmPassword,
                { secureTextEntry: true }
              )
            )}

            {mode === 'login' && (
              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => { setMode('forgot'); setErrors({}); }}
              >
                <Text style={[styles.forgotLinkText, { color: colors.accent }]}>Esqueceu a password?</Text>
              </TouchableOpacity>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.accent }, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              data-testid="auth-submit-btn"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={palette.gray[900]} />
              ) : (
                <Text style={[styles.submitButtonText, { color: palette.gray[900] }]}>
                  {mode === 'login' && 'Entrar'}
                  {mode === 'register' && 'Criar Conta'}
                  {mode === 'forgot' && 'Enviar Email'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            {mode !== 'forgot' && (
              <>
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.dividerText, { color: colors.textMuted }]}>ou</Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>

                {/* Google Login */}
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleLogin}
                  disabled={googleLoading}
                  data-testid="google-login-btn"
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <>
                      <MaterialIcons name="g-mobiledata" size={24} color={colors.textOnPrimary} />
                      <Text style={[styles.googleButtonText, { color: colors.textOnPrimary }]}>Continuar com Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Mode Switch */}
            <View style={styles.modeSwitchContainer}>
              {mode === 'login' && (
                <TouchableOpacity onPress={() => { setMode('register'); setErrors({}); }}>
                  <Text style={[styles.modeSwitchText, { color: colors.textMuted }]}>
                    Não tem conta? <Text style={[styles.modeSwitchLink, { color: colors.accent }]}>Criar agora</Text>
                  </Text>
                </TouchableOpacity>
              )}
              {mode === 'register' && (
                <TouchableOpacity onPress={() => { setMode('login'); setErrors({}); }}>
                  <Text style={[styles.modeSwitchText, { color: colors.textMuted }]}>
                    Já tem conta? <Text style={[styles.modeSwitchLink, { color: colors.accent }]}>Entrar</Text>
                  </Text>
                </TouchableOpacity>
              )}
              {mode === 'forgot' && (
                <TouchableOpacity onPress={() => { setMode('login'); setErrors({}); }}>
                  <Text style={[styles.modeSwitchText, { color: colors.textMuted }]}>
                    <Text style={[styles.modeSwitchLink, { color: colors.accent }]}>Voltar ao login</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Terms */}
          <Text style={[styles.termsText, { color: colors.textMuted }]}>
            Ao continuar, aceita os nossos{' '}
            <Text style={[styles.termsLink, { color: colors.textSecondary }]}>Termos de Serviço</Text> e{' '}
            <Text style={[styles.termsLink, { color: colors.textSecondary }]}>Política de Privacidade</Text>
          </Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing[6],
  },
  header: {
    marginBottom: spacing[8],
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borders.radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: spacing[3],
  },
  logoSubtext: {
    fontSize: 16,
    fontWeight: '500',
  },
  formContainer: {
    borderRadius: borders.radius['3xl'],
    padding: spacing[6],
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 14,
    marginBottom: spacing[6],
  },
  inputWrapper: {
    marginBottom: spacing[4],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borders.radius.lg,
    paddingHorizontal: spacing[4],
    height: 52,
    borderWidth: 1,
    gap: spacing[3],
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  errorText: {
    fontSize: 12,
    marginTop: spacing[1],
    marginLeft: spacing[1],
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing[6],
  },
  forgotLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    borderRadius: borders.radius.lg,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[6],
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    marginHorizontal: spacing[4],
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    borderRadius: borders.radius.lg,
    height: 52,
    gap: spacing[3],
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modeSwitchContainer: {
    marginTop: spacing[6],
    alignItems: 'center',
  },
  modeSwitchText: {
    fontSize: 14,
  },
  modeSwitchLink: {
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
});
