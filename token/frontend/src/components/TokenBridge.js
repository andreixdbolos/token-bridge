import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ConnectButton } from '@mysten/wallet-kit';
import { useWalletKit } from '@mysten/wallet-kit';
import './TokenBridge.css';

const TokenBridge = () => {
  const [direction, setDirection] = useState('eth-to-sui');
  const [amount, setAmount] = useState('');
  const [ethAccount, setEthAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { currentAccount } = useWalletKit();

  const connectEthWallet = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setEthAccount(accounts[0]);
      } else {
        throw new Error('Please install MetaMask to use this feature');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:5000/api/bridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          direction,
          amount,
          ethAccount,
          suiAccount: currentAccount?.address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Bridge operation failed');
      }

      setSuccess(`Bridge operation successful! Transaction Hash: ${
        direction === 'eth-to-sui' ? data.mintTxDigest : data.burnTxDigest
      }`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bridge-container">
      <h2 className="bridge-title">Token Bridge</h2>
      
      <form onSubmit={handleSubmit} className="bridge-form">
        <div className="form-group">
          <label>Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="eth-to-sui">Ethereum to Sui</option>
            <option value="sui-to-eth">Sui to Ethereum</option>
          </select>
        </div>

        <div className="form-group">
          <label>Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Ethereum Account</label>
          <div className="eth-input-container">
            <input
              type="text"
              value={ethAccount}
              onChange={(e) => setEthAccount(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={connectEthWallet}
              className="connect-button"
            >
              Connect MetaMask
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Sui Account</label>
          <div className="eth-input-container">
            <input
              type="text"
              value={currentAccount?.address || ''}
              readOnly
              required
            />
            <ConnectButton className="connect-button" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !ethAccount || !currentAccount?.address}
          className="submit-button"
        >
          {loading ? 'Processing...' : 'Bridge Tokens'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}
    </div>
  );
};

export default TokenBridge; 