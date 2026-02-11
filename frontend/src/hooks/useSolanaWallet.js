import { useState, useEffect, useCallback } from 'react';

export function useSolanaWallet() {
  const [publicKey, setPublicKey] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // 检查Phantom钱包是否已连接
  useEffect(() => {
    const checkPhantom = async () => {
      if (window.solana && window.solana.isPhantom) {
        try {
          const response = await window.solana.connect({ onlyIfTrusted: true });
          setPublicKey(response.publicKey.toString());
        } catch (error) {
          // 用户未授权自动连接
        }
      }
    };

    checkPhantom();

    // 监听账户变化
    if (window.solana) {
      window.solana.on('accountChanged', (publicKey) => {
        if (publicKey) {
          setPublicKey(publicKey.toString());
        } else {
          setPublicKey(null);
        }
      });

      window.solana.on('disconnect', () => {
        setPublicKey(null);
      });
    }

    return () => {
      if (window.solana && window.solana.removeAllListeners) {
        window.solana.removeAllListeners();
      }
    };
  }, []);

  // 连接Phantom钱包
  const connect = useCallback(async () => {
    if (!window.solana || !window.solana.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      return false;
    }

    setIsConnecting(true);

    try {
      const response = await window.solana.connect();
      setPublicKey(response.publicKey.toString());
      setIsConnecting(false);
      return true;
    } catch (error) {
      console.error('Error connecting Phantom wallet:', error);
      setIsConnecting(false);
      return false;
    }
  }, []);

  // 断开钱包
  const disconnect = useCallback(async () => {
    if (window.solana) {
      try {
        await window.solana.disconnect();
        setPublicKey(null);
      } catch (error) {
        console.error('Error disconnecting wallet:', error);
      }
    }
  }, []);

  // 获取余额
  const getBalance = useCallback(async () => {
    if (!publicKey || !window.solana) return 0;

    try {
      const connection = new window.solanaWeb3.Connection(
        'https://api.mainnet-beta.solana.com'
      );
      const balance = await connection.getBalance(
        new window.solanaWeb3.PublicKey(publicKey)
      );
      return balance / 1e9; // 转换为SOL
    } catch (error) {
      console.error('Error getting balance:', error);
      return 0;
    }
  }, [publicKey]);

  return {
    publicKey,
    isConnecting,
    isConnected: !!publicKey,
    connect,
    disconnect,
    getBalance
  };
}
