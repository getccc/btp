import React, { useState, useEffect, useMemo } from 'react';
import { Contract, parseUnits, formatUnits } from 'ethers';
import { useWallet } from '../hooks/useWallet';
import { useSolanaWallet } from '../hooks/useSolanaWallet';
import jupiterService from '../services/jupiterService';
import TransactionHistory, { addTransactionToHistory } from '../components/TransactionHistory';
import PriceChart from '../components/PriceChart';
import LimitOrder from '../components/LimitOrder';
import {
  BSC_TOKENS,
  SOLANA_TOKENS,
  PANCAKE_ROUTER_ADDRESS,
  PANCAKE_ROUTER_ABI,
  ERC20_ABI
} from '../utils/tokens';
import './SwapPage.css';

function SwapPageEnhanced() {
  // BSC钱包
  const {
    account: bscAccount,
    provider,
    chain,
    isConnected: bscConnected,
    connect: connectBSC,
    switchToBSC
  } = useWallet();

  // Solana钱包
  const {
    publicKey: solanaPublicKey,
    isConnected: solanaConnected,
    connect: connectSolana
  } = useSolanaWallet();

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
  const [selectingToken, setSelectingToken] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [showChart, setShowChart] = useState(true);

  // 当前钱包状态
  const isConnected = selectedChain === 'bsc' ? bscConnected : solanaConnected;
  const currentAccount = selectedChain === 'bsc' ? bscAccount : solanaPublicKey;

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
    setTxHash(null);
  }, [selectedChain]);

  // 获取余额
  useEffect(() => {
    if (isConnected && fromToken) {
      loadBalance();
    }
  }, [isConnected, fromToken, selectedChain, currentAccount]);

  const loadBalance = async () => {
    if (!fromToken) return;

    try {
      if (selectedChain === 'bsc' && provider && bscAccount) {
        if (fromToken.symbol === 'BNB') {
          const balance = await provider.getBalance(bscAccount);
          setBalance(formatUnits(balance, 18));
        } else {
          const tokenContract = new Contract(fromToken.address, ERC20_ABI, provider);
          const balance = await tokenContract.balanceOf(bscAccount);
          setBalance(formatUnits(balance, fromToken.decimals));
        }
      } else if (selectedChain === 'solana' && solanaPublicKey) {
        // Solana余额获取逻辑
        const connection = new window.solanaWeb3.Connection('https://api.mainnet-beta.solana.com');
        if (fromToken.symbol === 'SOL') {
          const balance = await connection.getBalance(new window.solanaWeb3.PublicKey(solanaPublicKey));
          setBalance((balance / 1e9).toString());
        } else {
          // SPL Token余额 - 需要实现
          setBalance('0');
        }
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
      setQuoteData(null);
    }
  }, [fromAmount, fromToken, toToken, selectedChain, slippage]);

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
      setQuoteData({
        route: 'PancakeSwap',
        priceImpact: '0.1%'
      });
    } catch (error) {
      console.error('Error getting BSC quote:', error);
      setToAmount('0');
    }
  };

  const getQuoteSolana = async () => {
    if (!fromToken || !toToken) return;

    try {
      const amountLamports = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
      const slippageBps = Math.floor(parseFloat(slippage) * 100);

      const quote = await jupiterService.getQuote(
        fromToken.address,
        toToken.address,
        amountLamports,
        slippageBps
      );

      if (quote && quote.outAmount) {
        const outAmount = quote.outAmount / Math.pow(10, toToken.decimals);
        setToAmount(outAmount.toFixed(6));
        setQuoteData({
          route: quote.routePlan?.map(r => r.swapInfo?.label).join(' → ') || 'Jupiter',
          priceImpact: quote.priceImpactPct ? `${quote.priceImpactPct.toFixed(2)}%` : 'N/A'
        });
      }
    } catch (error) {
      console.error('Error getting Solana quote:', error);
      setToAmount('0');
    }
  };

  // 执行交易
  const handleSwap = async () => {
    if (!isConnected) {
      if (selectedChain === 'bsc') {
        connectBSC();
      } else {
        connectSolana();
      }
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

      // 添加失败记录
      addTransactionToHistory(selectedChain, {
        hash: 'failed',
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount: parseFloat(fromAmount),
        toAmount: parseFloat(toAmount),
        status: 'failed'
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const swapBSC = async () => {
    if (!provider || !bscAccount) return;

    const signer = await provider.getSigner();
    const router = new Contract(PANCAKE_ROUTER_ADDRESS, PANCAKE_ROUTER_ABI, signer);

    const amountIn = parseUnits(fromAmount, fromToken.decimals);
    const amountOutMin = parseUnits(
      (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(toToken.decimals),
      toToken.decimals
    );
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const path = [
      fromToken.symbol === 'BNB' ? BSC_TOKENS[1].address : fromToken.address,
      toToken.symbol === 'BNB' ? BSC_TOKENS[1].address : toToken.address
    ];

    let tx;

    if (fromToken.symbol === 'BNB') {
      tx = await router.swapExactETHForTokens(amountOutMin, path, bscAccount, deadline, { value: amountIn });
    } else if (toToken.symbol === 'BNB') {
      const tokenContract = new Contract(fromToken.address, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(bscAccount, PANCAKE_ROUTER_ADDRESS);

      if (allowance < amountIn) {
        const approveTx = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, amountIn);
        await approveTx.wait();
      }

      tx = await router.swapExactTokensForETH(amountIn, amountOutMin, path, bscAccount, deadline);
    } else {
      const tokenContract = new Contract(fromToken.address, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(bscAccount, PANCAKE_ROUTER_ADDRESS);

      if (allowance < amountIn) {
        const approveTx = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, amountIn);
        await approveTx.wait();
      }

      tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, bscAccount, deadline);
    }

    const receipt = await tx.wait();
    setTxHash(receipt.hash);

    // 添加成功记录
    addTransactionToHistory('bsc', {
      hash: receipt.hash,
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      fromAmount: parseFloat(fromAmount),
      toAmount: parseFloat(toAmount),
      status: 'success'
    });

    setFromAmount('');
    setToAmount('');
    loadBalance();
  };

  const swapSolana = async () => {
    if (!solanaPublicKey) return;

    try {
      const amountLamports = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals));
      const slippageBps = Math.floor(parseFloat(slippage) * 100);

      // 获取报价
      const quote = await jupiterService.getQuote(
        fromToken.address,
        toToken.address,
        amountLamports,
        slippageBps
      );

      // 获取交换指令
      const { swapTransaction } = await jupiterService.getSwapInstructions(quote, solanaPublicKey);

      // 执行交易
      const signature = await jupiterService.executeSwap(swapTransaction);

      setTxHash(signature);

      // 添加成功记录
      addTransactionToHistory('solana', {
        hash: signature,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount: parseFloat(fromAmount),
        toAmount: parseFloat(toAmount),
        status: 'success'
      });

      setFromAmount('');
      setToAmount('');
      loadBalance();
    } catch (error) {
      console.error('Solana swap error:', error);
      throw error;
    }
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
    if (fromToken.symbol === 'BNB' || fromToken.symbol === 'SOL') {
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
          <p className="subtitle">Trade tokens instantly on BSC and Solana</p>
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
          >
            Solana (Jupiter)
          </button>
        </div>

        {/* 交易历史 */}
        <TransactionHistory chain={selectedChain} />

        {/* 价格图表 */}
        {showChart && fromToken && toToken && (
          <PriceChart fromToken={fromToken} toToken={toToken} chain={selectedChain} />
        )}

        <div className="swap-box">
          {/* From Token */}
          <div className="token-input-container">
            <div className="input-header">
              <span>From</span>
              {isConnected && (
                <span className="balance">Balance: {parseFloat(balance).toFixed(6)}</span>
              )}
            </div>
            <div className="token-input">
              <button className="token-select" onClick={() => { setSelectingToken('from'); setShowTokenSelector(true); }}>
                {fromToken?.logoURI && <img src={fromToken.logoURI} alt={fromToken.symbol} />}
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
              <button className="max-btn" onClick={handleMaxAmount}>MAX</button>
            )}
          </div>

          {/* Switch Button */}
          <div className="switch-tokens">
            <button className="switch-btn" onClick={handleSwitchTokens}>⇅</button>
          </div>

          {/* To Token */}
          <div className="token-input-container">
            <div className="input-header">
              <span>To</span>
            </div>
            <div className="token-input">
              <button className="token-select" onClick={() => { setSelectingToken('to'); setShowTokenSelector(true); }}>
                {toToken?.logoURI && <img src={toToken.logoURI} alt={toToken.symbol} />}
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

          {/* Quote Info */}
          {quoteData && (
            <div className="quote-info">
              <div className="quote-item">
                <span>Route:</span>
                <span>{quoteData.route}</span>
              </div>
              <div className="quote-item">
                <span>Price Impact:</span>
                <span>{quoteData.priceImpact}</span>
              </div>
            </div>
          )}
        </div>

        {/* Slippage Settings */}
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

        {/* Messages */}
        {error && <div className="error-message">⚠️ {error}</div>}
        {txHash && (
          <div className="success-message">
            ✅ Transaction successful!
            <a
              href={selectedChain === 'bsc' ? `https://bscscan.com/tx/${txHash}` : `https://solscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Explorer →
            </a>
          </div>
        )}

        {/* Swap Button */}
        <button
          className="swap-button"
          onClick={handleSwap}
          disabled={isSwapping || isLoadingQuote || !fromAmount || parseFloat(fromAmount) <= 0}
        >
          {!isConnected
            ? `Connect ${selectedChain === 'bsc' ? 'MetaMask' : 'Phantom'}`
            : isSwapping
            ? 'Swapping...'
            : 'Swap'}
        </button>

        {!isConnected && (
          <div className="wallet-info">
            <p>
              {selectedChain === 'bsc'
                ? 'Connect your MetaMask wallet to start trading on BSC'
                : 'Connect your Phantom wallet to start trading on Solana'}
            </p>
          </div>
        )}

        {/* 限价单组件 */}
        {isConnected && fromToken && toToken && (
          <LimitOrder
            fromToken={fromToken}
            toToken={toToken}
            chain={selectedChain}
            userAddress={currentAccount}
          />
        )}
      </div>

      {/* Token Selector Modal */}
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
                  {token.logoURI && <img src={token.logoURI} alt={token.symbol} />}
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

export default SwapPageEnhanced;
