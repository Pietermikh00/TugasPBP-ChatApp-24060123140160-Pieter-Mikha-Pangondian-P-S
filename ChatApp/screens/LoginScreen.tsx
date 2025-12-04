import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from '../firebase';

// Halaman login sederhana: input nama lalu navigasi ke Chat
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let unsub: any;
    try {
      unsub = onAuthStateChanged(auth, async u => {
        if (u) {
          try {
            const AS = require('@react-native-async-storage/async-storage').default;
            const savedName = await AS.getItem('display_name');
            const nameToUse = savedName || u.displayName || u.email || 'User';
            navigation.reset({ index: 0, routes: [{ name: 'Chat', params: { name: nameToUse } }] });
          } catch {
            const nameToUse = u.displayName || u.email || 'User';
            navigation.reset({ index: 0, routes: [{ name: 'Chat', params: { name: nameToUse } }] });
          }
        }
      });
    } catch {}
    return () => {
      if (unsub) unsub();
    };
  }, [navigation]);

  const handleEmailLogin = async () => {
    const n = name.trim();
    const e = email.trim();
    const p = password.trim();
    if (!e || !p || !n) return;
    try {
      setLoading(true);
      setError('');
      await signInWithEmailAndPassword(auth, e, p);
      if (!auth.currentUser?.displayName) await updateProfile(auth.currentUser!, { displayName: n });
      try {
        const AS = require('@react-native-async-storage/async-storage').default;
        await AS.setItem('display_name', n);
      } catch {}
      navigation.navigate('Chat', { name: n });
    } catch (err: any) {
      setError(err?.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const n = name.trim();
    const e = email.trim();
    const p = password.trim();
    if (!e || !p || !n) return;
    try {
      setLoading(true);
      setError('');
      await createUserWithEmailAndPassword(auth, e, p);
      await updateProfile(auth.currentUser!, { displayName: n });
      try {
        const AS = require('@react-native-async-storage/async-storage').default;
        await AS.setItem('display_name', n);
      } catch {}
      navigation.navigate('Chat', { name: n });
    } catch (err: any) {
      setError(err?.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Masukkan Nama</Text>
      <TextInput
        style={styles.input}
        placeholder="Nama"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleEmailLogin} disabled={loading}>
          <Text style={styles.btnText}>{loading ? '...' : 'Masuk'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: '#34C759' }, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
          <Text style={styles.btnText}>{loading ? '...' : 'Daftar'}</Text>
        </TouchableOpacity>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  btn: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  error: {
    color: '#ff3b30',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default LoginScreen;
