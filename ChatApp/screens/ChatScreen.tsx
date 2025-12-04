import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  Modal,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import {
  messagesCollection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  storage,
  ref,
  uploadString,
  getDownloadURL,
  auth,
  signOut,
} from '../firebase';

// Struktur pesan
type MessageType = {
  id: string;
  text: string;
  user: string;
  createdAt: { seconds: number; nanoseconds: number } | null;
  imageUrl?: string | null;
  imageBase64?: string | null;
  imageMime?: string | null;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { name } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const flatListRef = useRef<FlatList<MessageType>>(null);
  const cacheKey = 'messages_cache';
  const queueKey = 'pending_messages';
  const USE_FIREBASE_STORAGE = false;
  const USE_LOCAL_UPLOAD_SERVER = true;
  const UPLOAD_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  const [preview, setPreview] = useState<{ uri?: string; base64?: string; mime?: string } | null>(null);
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerBtn} onPress={async () => {
          try {
            await signOut(auth);
          } catch {}
          try {
            const AS = require('@react-native-async-storage/async-storage').default;
            await AS.removeItem('display_name');
          } catch {}
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }}>
          <Text style={styles.headerBtnText}>Logout</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    const loadCache = async () => {
      try {
        const AS = require('@react-native-async-storage/async-storage').default;
        const cached = await AS.getItem(cacheKey);
        if (cached) setMessages(JSON.parse(cached));
      } catch {}
    };
    loadCache();
    const q = query(messagesCollection, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const next: MessageType[] = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          text: data?.text ?? '',
          user: data?.user ?? 'Unknown',
          createdAt: data?.createdAt
            ? { seconds: data.createdAt.seconds, nanoseconds: data.createdAt.nanoseconds }
            : null,
          imageUrl: data?.imageUrl ?? null,
          imageBase64: data?.imageBase64 ?? null,
          imageMime: data?.imageMime ?? null,
        };
      });
      setMessages(next);
      (async () => {
        try {
          const AS = require('@react-native-async-storage/async-storage').default;
          await AS.setItem(cacheKey, JSON.stringify(next));
          const pendingRaw = await AS.getItem(queueKey);
          const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
          if (pending && pending.length) {
            for (const m of pending) {
              await addDoc(messagesCollection, { text: m.text, user: m.user, createdAt: serverTimestamp(), imageUrl: m.imageUrl ?? null, imageBase64: m.imageBase64 ?? null, imageMime: m.imageMime ?? null });
            }
            await AS.removeItem(queueKey);
          }
        } catch {}
      })();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => unsubscribe();
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    try {
      await addDoc(messagesCollection, {
        text: trimmed,
        user: name || auth.currentUser?.displayName || auth.currentUser?.email || 'User',
        createdAt: serverTimestamp(),
      });
      setMessage('');
    } catch {
      try {
        const AS = require('@react-native-async-storage/async-storage').default;
        const prevRaw = await AS.getItem(queueKey);
        const prev = prevRaw ? JSON.parse(prevRaw) : [];
        prev.push({ text: trimmed, user: name || auth.currentUser?.displayName || auth.currentUser?.email || 'User' });
        await AS.setItem(queueKey, JSON.stringify(prev));
        setMessage('');
      } catch {}
    }
  }, [message, name]);

  const pickAndSendImage = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const perm = await PermissionsAndroid.request(
          (PermissionsAndroid as any).PERMISSIONS.READ_MEDIA_IMAGES || (PermissionsAndroid as any).PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        if (perm !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Izin diperlukan', 'Berikan izin akses foto agar bisa memilih gambar.');
          return;
        }
      }
      const ImagePicker = require('react-native-image-picker');
      const res = await ImagePicker.launchImageLibrary({ mediaType: 'photo', includeBase64: true, quality: 0.6, maxWidth: 800, maxHeight: 800 });
      const asset = res?.assets?.[0];
      if (!asset || !asset.base64 || !asset.type) return;
      if (USE_FIREBASE_STORAGE) {
        const path = `images/${(auth.currentUser?.uid ?? 'anon')}/${Date.now()}`;
        const r = ref(storage, path);
        const dataUrl = `data:${asset.type};base64,${asset.base64}`;
        await uploadString(r, dataUrl, 'data_url');
        const url = await getDownloadURL(r);
        await addDoc(messagesCollection, {
          text: '',
          user: name || auth.currentUser?.displayName || auth.currentUser?.email || 'User',
          createdAt: serverTimestamp(),
          imageUrl: url,
        });
      } else if (USE_LOCAL_UPLOAD_SERVER) {
        const fd = new FormData();
        const ext = asset.type?.split('/')[1] ? `.${asset.type.split('/')[1]}` : '';
        const fname = `image_${Date.now()}${ext}`;
        fd.append('file', { uri: asset.uri, name: fname, type: asset.type } as any);
        const resp = await fetch(`${UPLOAD_BASE_URL}/upload`, { method: 'POST', body: fd });
        const json = await resp.json();
        if (!resp.ok || !json?.url) throw new Error(json?.error || 'Upload gagal');
        await addDoc(messagesCollection, {
          text: '',
          user: name || auth.currentUser?.displayName || auth.currentUser?.email || 'User',
          createdAt: serverTimestamp(),
          imageUrl: json.url,
        });
      } else {
        await addDoc(messagesCollection, {
          text: '',
          user: name || auth.currentUser?.displayName || auth.currentUser?.email || 'User',
          createdAt: serverTimestamp(),
          imageBase64: asset.base64,
          imageMime: asset.type,
        });
      }
    } catch (err: any) {
      Alert.alert('Gagal memilih/mengirim gambar', String(err?.message || err || 'Unknown error'));
      try {
        const AS = require('@react-native-async-storage/async-storage').default;
        const prevRaw = await AS.getItem(queueKey);
        const prev = prevRaw ? JSON.parse(prevRaw) : [];
        prev.push({ text: '', imageUrl: null, imageBase64: null, imageMime: null, user: name || auth.currentUser?.displayName || auth.currentUser?.email || 'User' });
        await AS.setItem(queueKey, JSON.stringify(prev));
      } catch {}
    }
  }, [name, USE_FIREBASE_STORAGE, USE_LOCAL_UPLOAD_SERVER, UPLOAD_BASE_URL]);

  const renderItem = ({ item }: { item: MessageType }) => {
    const isMine = item.user === name;
    return (
      <View style={[styles.msgBox, isMine ? styles.myMsg : styles.otherMsg]}>
        <Text style={styles.sender}>{item.user}</Text>
        {item.imageUrl ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setPreview({ uri: item.imageUrl! })}>
            <View style={{ width: 200, height: 200 }}>
              <ImageWrapper uri={item.imageUrl} />
            </View>
          </TouchableOpacity>
        ) : item.imageBase64 && item.imageMime ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setPreview({ base64: item.imageBase64!, mime: item.imageMime! })}
          >
            <View style={{ width: 200, height: 200 }}>
              <ImageWrapper base64={item.imageBase64} mime={item.imageMime} />
            </View>
          </TouchableOpacity>
        ) : (
          <Text style={styles.messageText}>{item.text}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>Belum ada pesan. Mulai chat!</Text></View>}
          ListFooterComponent={<View style={{ height: 80 }} />}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Tulis pesan..."
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity style={[styles.sendButton, { marginRight: 8 }]} onPress={pickAndSendImage}>
            <Text style={styles.sendButtonText}>Gambar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={!message.trim()}>
            <Text style={styles.sendButtonText}>KIRIM</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!preview} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPreview(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.previewBackdrop} onPress={() => setPreview(null)}>
          {preview?.uri ? (
            <PreviewImage uri={preview.uri} />
          ) : preview?.base64 && preview?.mime ? (
            <PreviewImage base64={preview.base64} mime={preview.mime} />
          ) : null}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const ImageWrapper = ({ uri, base64, mime }: { uri?: string; base64?: string; mime?: string }) => {
  const { Image } = require('react-native');
  const src = uri ? { uri } : base64 && mime ? { uri: `data:${mime};base64,${base64}` } : undefined;
  return <Image source={src as any} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" />;
};

const PreviewImage = ({ uri, base64, mime }: { uri?: string; base64?: string; mime?: string }) => {
  const { Image } = require('react-native');
  const src = uri ? { uri } : base64 && mime ? { uri: `data:${mime};base64,${base64}` } : undefined;
  return <Image source={src as any} style={styles.previewImage} resizeMode="contain" />;
};

const styles = StyleSheet.create({
  listContent: {
    padding: 10,
    paddingBottom: 20,
  },
  msgBox: {
    padding: 12,
    marginVertical: 4,
    borderRadius: 12,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myMsg: {
    backgroundColor: '#d1f0ff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherMsg: {
    backgroundColor: '#eee',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  sender: {
    fontWeight: 'bold',
    marginBottom: 4,
    fontSize: 11,
    opacity: 0.7,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  headerBtn: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  headerBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});

export default ChatScreen;
