import axios from 'axios';

const JUPITER_API_V6 = 'https://quote-api.jup.ag/v6';
const JUPITER_PRICE_API = 'https://price.jup.ag/v4';

class JupiterService {
  /**
   * 获取交易报价
   */
  async getQuote(inputMint, outputMint, amount, slippageBps = 50) {
    try {
      const response = await axios.get(`${JUPITER_API_V6}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount,
          slippageBps, // 50 = 0.5%
          onlyDirectRoutes: false,
          asLegacyTransaction: false
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error getting Jupiter quote:', error);
      throw error;
    }
  }

  /**
   * 获取交换指令
   */
  async getSwapInstructions(quoteResponse, userPublicKey) {
    try {
      const response = await axios.post(`${JUPITER_API_V6}/swap`, {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto'
      });

      return response.data;
    } catch (error) {
      console.error('Error getting swap instructions:', error);
      throw error;
    }
  }

  /**
   * 执行交换（通过Phantom钱包）
   */
  async executeSwap(swapTransaction) {
    if (!window.solana || !window.solana.isPhantom) {
      throw new Error('Phantom wallet not found');
    }

    try {
      // 反序列化交易
      const transaction = window.solanaWeb3.Transaction.from(
        Buffer.from(swapTransaction, 'base64')
      );

      // 发送交易
      const { signature } = await window.solana.signAndSendTransaction(transaction);

      // 等待确认
      const connection = new window.solanaWeb3.Connection(
        'https://api.mainnet-beta.solana.com'
      );

      await connection.confirmTransaction(signature, 'confirmed');

      return signature;
    } catch (error) {
      console.error('Error executing swap:', error);
      throw error;
    }
  }

  /**
   * 获取代币价格
   */
  async getTokenPrice(mintAddress) {
    try {
      const response = await axios.get(`${JUPITER_PRICE_API}/price`, {
        params: {
          ids: mintAddress
        }
      });

      return response.data.data[mintAddress]?.price || 0;
    } catch (error) {
      console.error('Error getting token price:', error);
      return 0;
    }
  }

  /**
   * 获取多个代币价格
   */
  async getTokenPrices(mintAddresses) {
    try {
      const response = await axios.get(`${JUPITER_PRICE_API}/price`, {
        params: {
          ids: mintAddresses.join(',')
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Error getting token prices:', error);
      return {};
    }
  }

  /**
   * 获取代币列表
   */
  async getTokenList() {
    try {
      const response = await axios.get('https://token.jup.ag/strict');
      return response.data;
    } catch (error) {
      console.error('Error getting token list:', error);
      return [];
    }
  }

  /**
   * 计算价格影响
   */
  calculatePriceImpact(inputAmount, outputAmount, inputPrice, outputPrice) {
    const expectedOutput = (inputAmount * inputPrice) / outputPrice;
    const priceImpact = ((expectedOutput - outputAmount) / expectedOutput) * 100;
    return priceImpact.toFixed(2);
  }
}

export default new JupiterService();
