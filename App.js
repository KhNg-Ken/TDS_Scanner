import React, { useState } from 'react';
import Auth from './src/components/Auth';
import Scanner from './src/components/Scanner';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => setIsAuthenticated(true);

  return isAuthenticated ? <Scanner /> : <Auth onLogin={handleLogin} />;
}