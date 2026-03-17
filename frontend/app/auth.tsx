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

import { API_URL } from '../src/config/api';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      // Store token and navigate
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
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <MaterialIcons name={icon as any} size={20} color="#64748B" />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#64748B"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={options?.secureTextEntry && !showPassword}
          keyboardType={options?.keyboardType || 'default'}
          autoCapitalize={options?.autoCapitalize || 'none'}
        />
        {options?.secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#2E5E4E', '#264E41']}
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
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.logoContainer}>
              <MaterialIcons name="castle" size={48} color="#C49A6C" />
              <Text style={styles.logoText}>Portugal Vivo</Text>
              <Text style={styles.logoSubtext}>de Portugal</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>
              {mode === 'login' && 'Bem-vindo de volta'}
              {mode === 'register' && 'Criar Conta'}
              {mode === 'forgot' && 'Recuperar Password'}
            </Text>
            <Text style={styles.subtitle}>
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
                <Text style={styles.forgotLinkText}>Esqueceu a password?</Text>
              </TouchableOpacity>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              data-testid="auth-submit-btn"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.submitButtonText}>
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
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Login */}
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleLogin}
                  disabled={googleLoading}
                  data-testid="google-login-btn"
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="g-mobiledata" size={24} color="#FFFFFF" />
                      <Text style={styles.googleButtonText}>Continuar com Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Mode Switch */}
            <View style={styles.modeSwitchContainer}>
              {mode === 'login' && (
                <TouchableOpacity onPress={() => { setMode('register'); setErrors({}); }}>
                  <Text style={styles.modeSwitchText}>
                    Não tem conta? <Text style={styles.modeSwitchLink}>Criar agora</Text>
                  </Text>
                </TouchableOpacity>
              )}
              {mode === 'register' && (
                <TouchableOpacity onPress={() => { setMode('login'); setErrors({}); }}>
                  <Text style={styles.modeSwitchText}>
                    Já tem conta? <Text style={styles.modeSwitchLink}>Entrar</Text>
                  </Text>
                </TouchableOpacity>
              )}
              {mode === 'forgot' && (
                <TouchableOpacity onPress={() => { setMode('login'); setErrors({}); }}>
                  <Text style={styles.modeSwitchText}>
                    <Text style={styles.modeSwitchLink}>Voltar ao login</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Terms */}
          <Text style={styles.termsText}>
            Ao continuar, aceita os nossos{' '}
            <Text style={styles.termsLink}>Termos de Serviço</Text> e{' '}
            <Text style={styles.termsLink}>Política de Privacidade</Text>
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
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  logoSubtext: {
    fontSize: 16,
    color: '#C49A6C',
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E5E4E',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#2A2F2A',
    gap: 12,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotLinkText: {
    color: '#C49A6C',
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#C49A6C',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2F2A',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 14,
    marginHorizontal: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    borderRadius: 12,
    height: 52,
    gap: 12,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modeSwitchContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  modeSwitchText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  modeSwitchLink: {
    color: '#C49A6C',
    fontWeight: '600',
  },
  termsText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
});
