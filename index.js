import React from 'react';
import { registerRootComponent } from 'expo';
import App from './App';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function Main() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

// Register the main component of the app
registerRootComponent(Main);