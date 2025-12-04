// Root: setup navigasi + auth anonim Firebase
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import ChatScreen from './screens/ChatScreen';
import { auth, onAuthStateChanged } from './firebase';
import type { User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definisi tipe untuk route params
export type RootStackParamList = {
  Login: undefined;
  Chat: { name: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState<string>('User');
  const [initializing, setInitializing] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async current => {
      setUser(current);
      if (current) {
        try {
          const savedName = await AsyncStorage.getItem('display_name');
          setName(savedName || current.displayName || current.email || 'User');
        } catch {
          setName(current.displayName || current.email || 'User');
        }
      } else {
        setName('User');
      }
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <Stack.Screen name="Chat" component={ChatScreen} initialParams={{ name }} options={{ title: 'Chat Room' }} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
