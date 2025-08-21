import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, child, get } from 'firebase/database';
import { auth } from '../lib/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';

const { height, width } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const router = useRouter();
  const passwordInputRef = useRef(null);
  const floatingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation for floating effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(floatingAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    ).start();

    const checkSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('userEmail');
        const savedPassword = await AsyncStorage.getItem('userPassword');

        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setIsAutoLoggingIn(true);
          setTimeout(() => handleLogin(true), 1000);
        }
      } catch (error) {
        console.log('Lỗi khi lấy thông tin đăng nhập đã lưu:', error);
      }
    };

    checkSavedCredentials();
  }, []);

  const floatingStyle = {
    transform: [
      {
        translateY: floatingAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10]
        })
      }
    ]
  };

  const handleLogin = async (isAutoLogin = false) => {
    if (!isAutoLogin && (!email || !password)) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Lưu thông tin đăng nhập
      await AsyncStorage.setItem('userEmail', email);
      await AsyncStorage.setItem('userPassword', password);

      // Lấy role từ Realtime Database
      const dbRef = ref(getDatabase());
      const snapshot = await get(child(dbRef, `users/${user.uid}`));

      if (snapshot.exists()) {
        const role = snapshot.val()?.role;
        if (role) {
          await AsyncStorage.setItem('userRole', role);
        }
      }

      router.replace('/(auth)/branch-selection');
    } catch (error) {
      if (!isAutoLogin) {
        Alert.alert('Lỗi', error.message || 'Đăng nhập thất bại. Vui lòng thử lại');
      }

      // Xoá thông tin nếu đăng nhập tự động thất bại
      if (isAutoLogin) {
        await AsyncStorage.removeItem('userEmail');
        await AsyncStorage.removeItem('userPassword');
      }
    } finally {
      setIsLoading(false);
      setIsAutoLoggingIn(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1a2a6c', '#2a5298']}
      style={styles.background}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.logoContainer}>
        <Animated.View style={[styles.logo, floatingStyle]}>
          <FontAwesome5 name="utensils" size={32} color="white" style={styles.logoIcon} />
          <Text style={styles.logoText}>Foodiee</Text>
        </Animated.View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -height * 0.15 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSpacer} />

          <Animated.View style={[styles.formContainer, floatingStyle]}>
            {isAutoLoggingIn && (
              <Text style={styles.autoLoginText}>Đang tự động đăng nhập...</Text>
            )}

            <View style={styles.formHeader}>
              <Text style={styles.title}>Đăng nhập</Text>
              <Text style={styles.subtitle}>Chào mừng trở lại! Vui lòng đăng nhập để tiếp tục</Text>
            </View>

            <View style={[styles.inputContainer, emailFocused && styles.inputFocused]}>
              <MaterialIcons 
                name="email" 
                size={24} 
                color={emailFocused ? '#2a5298' : '#1a2a6c'} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#95a5a6"
                value={email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                returnKeyType="next"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />
              {emailFocused && <View style={styles.inputFocusLine} />}
            </View>

            <View style={[styles.inputContainer, passwordFocused && styles.inputFocused]}>
              <MaterialIcons 
                name="lock" 
                size={24} 
                color={passwordFocused ? '#2a5298' : '#1a2a6c'} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu"
                placeholderTextColor="#95a5a6"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                ref={passwordInputRef}
                returnKeyType="done"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity 
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons 
                  name={showPassword ? 'visibility-off' : 'visibility'} 
                  size={24} 
                  color="#95a5a6" 
                />
              </TouchableOpacity>
              {passwordFocused && <View style={styles.inputFocusLine} />}
            </View>

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() =>
                Alert.alert('Thông báo', 'Vui lòng liên hệ quản trị viên để đặt lại mật khẩu')
              }
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, (isLoading || isAutoLoggingIn) && styles.buttonDisabled]}
              onPress={() => handleLogin(false)}
              disabled={isLoading || isAutoLoggingIn}
            >
              <LinearGradient
                colors={['#1a2a6c', '#2a5298']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>
                  {isAutoLoggingIn
                    ? 'Đang đăng nhập tự động...'
                    : isLoading
                    ? 'Đang xử lý...'
                    : 'Đăng nhập'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  topSpacer: {
    height: Dimensions.get('window').height * 0.1,
  },
  logoContainer: {
    position: 'absolute',
    top: 50,
    left: 30,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    marginRight: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
  formHeader: {
    marginBottom: 25,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a2a6c',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingLeft: 20,
    paddingRight: 15,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e1e8ed',
    flexDirection: 'row',
    alignItems: 'center',
    height: 55,
    shadowColor: 'rgba(26, 42, 108, 0.05)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  inputFocused: {
    borderColor: '#a0b9f1',
    shadowColor: 'rgba(26, 42, 108, 0.1)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 5,
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#1a202c',
    paddingVertical: 0,
  },
  inputFocusLine: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#1a2a6c',
    borderRadius: 2,
  },
  passwordToggle: {
    padding: 5,
    marginLeft: 10,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#3498db',
    fontWeight: '500',
    fontSize: 14,
  },
  button: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: 'rgba(26, 42, 108, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 4,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  autoLoginText: {
    textAlign: 'center',
    color: '#2ecc71',
    marginBottom: 16,
    fontWeight: '500',
    fontSize: 14,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

});