import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider } from 'ethers';

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [chain, setChain] = useState(null);
  const [provider, setProvider] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // 检查MetaMask是否已连接
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            const provider = new BrowserProvider(window.ethereum);
            setProvider(provider);
            checkChain();
          }
        })
        .catch(console.error);

      // 监听账户变化
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount(null);
      setProvider(null);
    } else if (accounts[0] !== account) {
      setAccount(accounts[0]);
      const provider = new BrowserProvider(window.ethereum);
      setProvider(provider);
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const checkChain = async () => {
    if (!window.ethereum) return;

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });

      // BSC Mainnet: 0x38 (56), BSC Testnet: 0x61 (97)
      if (chainId === '0x38') {
        setChain('bsc');
      } else if (chainId === '0x61') {
        setChain('bsc-testnet');
      } else {
        setChain('other');
      }
    } catch (error) {
      console.error('Error checking chain:', error);
    }
  };

  // 连接钱包
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return false;
    }

    setIsConnecting(true);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      setAccount(accounts[0]);
      const provider = new BrowserProvider(window.ethereum);
      setProvider(provider);
      await checkChain();

      setIsConnecting(false);
      return true;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setIsConnecting(false);
      return false;
    }
  }, []);

  // 切换到BSC网络
  const switchToBSC = useCallback(async () => {
    if (!window.ethereum) return false;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }], // BSC Mainnet
      });
      return true;
    } catch (switchError) {
      // 如果BSC网络未添加，则添加它
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x38',
                chainName: 'BSC Mainnet',
                nativeCurrency: {
                  name: 'BNB',
                  symbol: 'BNB',
                  decimals: 18
                },
                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                blockExplorerUrls: ['https://bscscan.com/']
              }
            ]
          });
          return true;
        } catch (addError) {
          console.error('Error adding BSC network:', addError);
          return false;
        }
      }
      console.error('Error switching network:', switchError);
      return false;
    }
  }, []);

  // 断开钱包
  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setChain(null);
  }, []);

  return {
    account,
    chain,
    provider,
    isConnecting,
    isConnected: !!account,
    connect,
    disconnect,
    switchToBSC
  };
}
