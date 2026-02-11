import React, { useState, useEffect, useMemo } from 'react';
import { Contract, parseUnits, formatUnits } from 'ethers';
import axios from 'axios';
import { useWallet } from '../hooks/useWallet';
import {
  BSC_TOKENS,
  SOLANA_TOKENS,
  PANCAKE_ROUTER_ADDRESS,
  PANCAKE_ROUTER_ABI,
  ERC20_ABI,
  JUPITER_API_URL
} from '../utils/tokens';
import './SwapPage.css';

function SwapPage() {
  const { account, provider, chain, isConnected, connect, switchToBSC } = useWallet();

  const [selectedChain, setSelectedChain] = useState('bsc');
  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken] = useState(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isSwapping, setIsSwapping] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [balance, setBalance] = useState('0');
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [selectingToken, setSelectingToken] = useState(null); // 'from' or 'to'
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  // 获取代币列表
  const tokens = useMemo(() => {
    return selectedChain === 'bsc' ? BSC_TOKENS : SOLANA_TOKENS;
  }, [selectedChain]);

  // 初始化默认代币
  useEffect(() => {
    if (selectedChain === 'bsc') {
      setFromToken(BSC_TOKENS[0]); // BNB
      setToToken(BSC_TOKENS[2]); // USDT
    } else {
      setFromToken(SOLANA_TOKENS[0]); // SOL
      setToToken(SOLANA_TOKENS[1]); // USDC
    }
    setFromAmount('');
    setToAmount('');
    setError(null);
  }, [selectedChain]);

  // 获取余额
  useEffect(() => {
    if (isConnected && fromToken && provider && selectedChain === 'bsc' && chain === 'bsc') {
      loadBalance();
    }
  }, [isConnected, fromToken, provider, selectedChain, chain, account]);

  const loadBalance = async () => {
    if (!provider || !account || !fromToken) return;

    try {
      if (fromToken.symbol === 'BNB') {
        const balance = await provider.getBalance(account);
        setBalance(formatUnits(balance, 18));
      } else {
        const tokenContract = new Contract(fromToken.address, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(account);
        setBalance(formatUnits(balance, fromToken.decimals));
      }
    } catch (error) {
      console.error('Error loading balance:', error);
      setBalance('0');
    }
  };

  // 获取报价
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0 && fromToken && toToken) {
      const timer = setTimeout(() => {
        getQuote();
      }, 500);

      return () => clearTimeout(timer);
    } else {
      setToAmount('');
    }
  }, [fromAmount, fromToken, toToken, selectedChain]);

  const getQuote = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) return;

    setIsLoadingQuote(true);
    setError(null);

    try {
      if (selectedChain === 'bsc') {
        await getQuoteBSC();
      } else {
        await getQuoteSolana();
      }
    } catch (error) {
      console.error('Error getting quote:', error);
      setError('Failed to get quote');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const getQuoteBSC = async () => {
    if (!provider || !fromToken || !toToken) return;

    try {
      const router = new Contract(PANCAKE_ROUTER_ADDRESS, PANCAKE_ROUTER_ABI, provider);
      const amountIn = parseUnits(fromAmount, fromToken.decimals);

      const path = [
        fromToken.symbol === 'BNB' ? BSC_TOKENS[1].address : fromToken.address,
        toToken.symbol === 'BNB' ? BSC_TOKENS[1].address : toToken.address
      ];

      const amounts = await router.getAmountsOut(amountIn, path);
      const amountOut = amounts[amounts.length - 1];

      setToAmount(formatUnits(amountOut, toToken.decimals));
    } catch (error) {
      console.error('Error getting BSC quote:', error);
      setToAmount('0');
    }
  };

  const getQuoteSolana = async () => {
    if (!fromToken || !toToken) return;

    try {
      const amountLamports = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));

      const response = await axios.get(`${JUPITER_API_URL}/quote`, {
        params: {
          inputMint: fromToken.address,
          outputMint: toToken.address,
          amount: amountLamports,
          slippageBps: Math.floor(parseFloat(slippage) * 100)
        }
      });

      if (response.data) {
        const outAmount = response.data.outAmount;
        setToAmount((outAmount / Math.pow(10, toToken.decimals)).toFixed(6));
      }
    } catch (error) {
      console.error('Error getting Solana quote:', error);
      setToAmount('0');
    }
  };

  // 执行交易
  const handleSwap = async () => {
    if (!isConnected) {
      connect();
      return;
    }

    if (selectedChain === 'bsc' && chain !== 'bsc') {
      const switched = await switchToBSC();
      if (!switched) {
        setError('Please switch to BSC network');
        return;
      }
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setError('Please enter an amount');
      return;
    }

    if (parseFloat(fromAmount) > parseFloat(balance)) {
      setError('Insufficient balance');
      return;
    }

    setIsSwapping(true);
    setError(null);
    setTxHash(null);

    try {
      if (selectedChain === 'bsc') {
        await swapBSC();
      } else {
        await swapSolana();
      }
    } catch (error) {
      console.error('Swap error:', error);
      setError(error.message || 'Transaction failed');
    } finally {
      setIsSwapping(false);
    }
  };

  const swapBSC = async () => {
    if (!provider || !account) return;

    const signer = await provider.getSigner();
    const router = new Contract(PANCAKE_ROUTER_ADDRESS, PANCAKE_ROUTER_ABI, signer);

    const amountIn = parseUnits(fromAmount, fromToken.decimals);
    const amountOutMin = parseUnits(
      (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(toToken.decimals),
      toToken.decimals
    );
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分钟

    const path = [
      fromToken.symbol === 'BNB' ? BSC_TOKENS[1].address : fromToken.address,
      toToken.symbol === 'BNB' ? BSC_TOKENS[1].address : toToken.address
    ];

    let tx;

    if (fromToken.symbol === 'BNB') {
      // BNB -> Token
      tx = await router.swapExactETHForTokens(
        amountOutMin,
        path,
        account,
        deadline,
        { value: amountIn }
      );
    } else if (toToken.symbol === 'BNB') {
      // Token -> BNB
      // 先授权
      const tokenContract = new Contract(fromToken.address, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(account, PANCAKE_ROUTER_ADDRESS);

      if (allowance < amountIn) {
        const approveTx = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, amountIn);
        await approveTx.wait();
      }

      tx = await router.swapExactTokensForETH(
        amountIn,
        amountOutMin,
        path,
        account,
        deadline
      );
    } else {
      // Token -> Token
      // 先授权
      const tokenContract = new Contract(fromToken.address, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(account, PANCAKE_ROUTER_ADDRESS);

      if (allowance < amountIn) {
        const approveTx = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, amountIn);
        await approveTx.wait();
      }

      tx = await router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        account,
        deadline
      );
    }

    const receipt = await tx.wait();
    setTxHash(receipt.hash);
    setFromAmount('');
    setToAmount('');
    loadBalance();
  };

  const swapSolana = async () => {
    setError('Solana swap requires Phantom wallet. This is a demo - full implementation requires wallet adapter.');
    // 完整实现需要 @solana/wallet-adapter-react 和 Phantom 钱包
  };

  // 切换代币
  const handleSwitchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  // 选择代币
  const handleSelectToken = (token) => {
    if (selectingToken === 'from') {
      setFromToken(token);
    } else {
      setToToken(token);
    }
    setShowTokenSelector(false);
    setSelectingToken(null);
  };

  // 设置最大金额
  const handleMaxAmount = () => {
    if (fromToken.symbol === 'BNB') {
      // 预留一些gas费
      const maxAmount = Math.max(0, parseFloat(balance) - 0.001);
      setFromAmount(maxAmount.toFixed(6));
    } else {
      setFromAmount(balance);
    }
  };

  return (
    <div className="swap-page">
      <div className="swap-container">
        <div className="swap-header">
          <h2>💱 Swap Tokens</h2>
          <p className="subtitle">Trade tokens instantly</p>
        </div>

        <div className="chain-selector">
          <button
            className={`chain-btn ${selectedChain === 'bsc' ? 'active' : ''}`}
            onClick={() => setSelectedChain('bsc')}
          >
            BSC (PancakeSwap)
          </button>
          <button
            className={`chain-btn ${selectedChain === 'solana' ? 'active' : ''}`}
            onClick={() => setSelectedChain('solana')}
            disabled
          >
            Solana (Jupiter) - Coming Soon
          </button>
        </div>

        <div className="swap-box">
          <div className="token-input-container">
            <div className="input-header">
              <span>From</span>
              {isConnected && (
                <span className="balance">
                  Balance: {parseFloat(balance).toFixed(6)}
                </span>
              )}
            </div>
            <div className="token-input">
              <button
                className="token-select"
                onClick={() => {
                  setSelectingToken('from');
                  setShowTokenSelector(true);
                }}
              >
                {fromToken?.logoURI && (
                  <img src={fromToken.logoURI} alt={fromToken.symbol} />
                )}
                <span>{fromToken?.symbol || 'Select'}</span>
                <span className="arrow">▼</span>
              </button>
              <input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
              />
            </div>
            {isConnected && (
              <button className="max-btn" onClick={handleMaxAmount}>
                MAX
              </button>
            )}
          </div>

          <div className="switch-tokens">
            <button className="switch-btn" onClick={handleSwitchTokens}>
              ⇅
            </button>
          </div>

          <div className="token-input-container">
            <div className="input-header">
              <span>To</span>
            </div>
            <div className="token-input">
              <button
                className="token-select"
                onClick={() => {
                  setSelectingToken('to');
                  setShowTokenSelector(true);
                }}
              >
                {toToken?.logoURI && (
                  <img src={toToken.logoURI} alt={toToken.symbol} />
                )}
                <span>{toToken?.symbol || 'Select'}</span>
                <span className="arrow">▼</span>
              </button>
              <input
                type="number"
                placeholder="0.0"
                value={isLoadingQuote ? 'Loading...' : toAmount}
                readOnly
              />
            </div>
          </div>
        </div>

        <div className="slippage-settings">
          <label>Slippage Tolerance: {slippage}%</label>
          <div className="slippage-buttons">
            {['0.1', '0.5', '1.0', '3.0'].map((value) => (
              <button
                key={value}
                className={slippage === value ? 'active' : ''}
                onClick={() => setSlippage(value)}
              >
                {value}%
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {txHash && (
          <div className="success-message">
            ✅ Transaction successful!
            <a
              href={`https://bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on BscScan →
            </a>
          </div>
        )}

        <button
          className="swap-button"
          onClick={handleSwap}
          disabled={isSwapping || isLoadingQuote || !fromAmount || parseFloat(fromAmount) <= 0}
        >
          {!isConnected
            ? 'Connect Wallet'
            : isSwapping
            ? 'Swapping...'
            : 'Swap'}
        </button>

        {!isConnected && (
          <div className="wallet-info">
            <p>Connect your MetaMask wallet to start trading</p>
          </div>
        )}
      </div>

      {showTokenSelector && (
        <div className="token-selector-modal" onClick={() => setShowTokenSelector(false)}>
          <div className="token-selector" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select a token</h3>
              <button onClick={() => setShowTokenSelector(false)}>×</button>
            </div>
            <div className="token-list">
              {tokens.map((token) => (
                <button
                  key={token.address}
                  className="token-item"
                  onClick={() => handleSelectToken(token)}
                >
                  {token.logoURI && (
                    <img src={token.logoURI} alt={token.symbol} />
                  )}
                  <div className="token-info">
                    <div className="token-symbol">{token.symbol}</div>
                    <div className="token-name">{token.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SwapPage;
