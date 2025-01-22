import React from 'react';
import { WalletKitProvider } from '@mysten/wallet-kit';
import TokenBridge from './components/TokenBridge';
import './App.css';

function App() {
  return (
    <WalletKitProvider>
      <div className="app">
        <div className="container">
          <div className="header">
            <h1 className="title">
              Cross-Chain Token Bridge
            </h1>
          </div>
          <TokenBridge />
        </div>
      </div>
    </WalletKitProvider>
  );
}

export default App; 