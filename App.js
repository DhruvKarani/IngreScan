import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import DebugConsole from './src/components/DebugConsole';

export default function App() {
  return (
    <>
      <AppNavigator />
      <DebugConsole />
    </>
  );
}
