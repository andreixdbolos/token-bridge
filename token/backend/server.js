import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fetch from 'node-fetch';
import { ethers } from 'ethers';
import { getFullnodeUrl } from '@mysten/sui.js/client';
import { SuiClient, SuiHTTPTransport } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

globalThis.fetch = fetch;

const app = express();
app.use(bodyParser.json());
app.use(cors());

const ETH_RPC_URL = 'http://127.0.0.1:8545';
const ETH_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ETH_CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const NETWORK = 'localnet';
const SUI_RPC_URL = getFullnodeUrl(NETWORK);
const SUI_PRIVATE_KEY_HEX = 'd359be4cd668af6049e62149b0b1a79fd3dbb7cd8dc16171c7a625e3e78e4dee';
const SUI_CONTRACT_PACKAGE_ID = '0x9396313a91b60a4442228aa73e4e3b352c019c1ccd054e0f8e3dccceff631685';
const SUI_MODULE_NAME = 'token';

const SUI_TREASURY_CAP_ID = '0x0e137aed417c7489af1ca0c7b53d9601e1c73cfcde6d43c080c35739d247217f';
const SUI_MINTER_CAP_ID = '0x27d87bef734a3442d4d2746d952e3384bd05f966297824f4515bee0f9d9548db';

const ETH_DECIMALS = 18;
const SUI_DECIMALS = 9;

const ethProvider = new ethers.JsonRpcProvider(ETH_RPC_URL);
const ethWallet = new ethers.Wallet(ETH_PRIVATE_KEY, ethProvider);
const ethContractABI = [
  'function mint(address to, uint256 amount) external',
  'function burn(address from, uint256 amount) external',
];
const ethContract = new ethers.Contract(ETH_CONTRACT_ADDRESS, ethContractABI, ethWallet);

// Initialize Sui client
const transport = new SuiHTTPTransport({ url: SUI_RPC_URL });
const suiClient = new SuiClient({ transport });
const suiKeypair = Ed25519Keypair.fromSecretKey(Buffer.from(SUI_PRIVATE_KEY_HEX, 'hex'));

// Helper function to convert between decimal precisions
const convertDecimals = (amount, fromDecimals, toDecimals) => {
  const difference = fromDecimals - toDecimals;
  if (difference > 0) {
    return BigInt(amount) / BigInt(10 ** difference);
  } else {
    return BigInt(amount) * BigInt(10 ** Math.abs(difference));
  }
};

// Helper function to parse Ethereum amount
const parseAmount = (amount) => {
  return ethers.parseUnits(amount.toString(), ETH_DECIMALS);
};

// Fetch the latest object state and version
const fetchLatestObjectState = async (objectId) => {
  try {
    const objectInfo = await suiClient.getObject({
      id: objectId,
      options: { showContent: true, showType: true, showOwner: true },
    });
    if (!objectInfo || !objectInfo.data) {
      throw new Error(`Failed to fetch state for object ID: ${objectId}`);
    }
    return {
      objectId: objectInfo.data.objectId,
      version: objectInfo.data.version,
    };
  } catch (error) {
    console.error(`Error fetching latest state for object ID ${objectId}:`, error);
    throw error;
  }
};

// Sign and execute transaction block
const signAndExecuteTransaction = async (tx) => {
  try {
    const response = await suiClient.signAndExecuteTransactionBlock({
      signer: suiKeypair,
      transactionBlock: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    if (response.effects?.status?.status !== 'success') {
      throw new Error(`Transaction failed: ${response.effects?.status?.error || 'Unknown error'}`);
    }

    return response;
  } catch (error) {
    console.error('Transaction execution failed:', error);
    throw error;
  }
};

// Mint tokens on Sui with decimal adjustment
const mintTokensSui = async (amount, recipient) => {
  try {
    if (!amount || amount <= 0) throw new Error('Invalid amount specified for minting');
    if (!recipient || !recipient.startsWith('0x')) throw new Error('Invalid recipient address');

    // Convert amount to Sui decimals (ETH 18 -> SUI 9)
    const suiAmount = convertDecimals(amount, ETH_DECIMALS, SUI_DECIMALS);
    console.log(`Converting amount ${amount} (${ETH_DECIMALS} decimals) to ${suiAmount} (${SUI_DECIMALS} decimals)`);

    const latestTreasuryCap = await fetchLatestObjectState(SUI_TREASURY_CAP_ID);
    const latestMinterCap = await fetchLatestObjectState(SUI_MINTER_CAP_ID);

    console.log('Using latest object states:', { latestTreasuryCap, latestMinterCap });

    const tx = new TransactionBlock();
    tx.setGasBudget(20000000);

    tx.moveCall({
      target: `${SUI_CONTRACT_PACKAGE_ID}::${SUI_MODULE_NAME}::mint`,
      arguments: [
        tx.object(latestTreasuryCap.objectId),
        tx.object(latestMinterCap.objectId),
        tx.pure(suiAmount),
        tx.pure(recipient),
      ],
    });

    const result = await signAndExecuteTransaction(tx);
    console.log('Minting on Sui successful:', result.digest);
    return result.digest;
  } catch (error) {
    console.error('Error minting tokens on Sui:', error);
    throw error;
  }
};

// Function to get owned coin object of specific type
const getOwnedCoin = async (ownerAddress) => {
  try {
    const coins = await suiClient.getCoins({
      owner: ownerAddress,
      coinType: `${SUI_CONTRACT_PACKAGE_ID}::token::TOKEN`
    });
    
    if (!coins || coins.data.length === 0) {
      throw new Error('No suitable coins found for burning');
    }

    // Get the first available coin with sufficient balance
    return coins.data[0].coinObjectId;
  } catch (error) {
    console.error('Error fetching owned coins:', error);
    throw error;
  }
};

// Burn tokens on Sui
const burnTokensSui = async (coinId) => {
  try {
    if (!coinId || !coinId.startsWith('0x')) throw new Error('Invalid coin ID specified for burning');

    const latestTreasuryCap = await fetchLatestObjectState(SUI_TREASURY_CAP_ID);
    const latestMinterCap = await fetchLatestObjectState(SUI_MINTER_CAP_ID);

    console.log('Using latest object states:', { latestTreasuryCap, latestMinterCap });

    const tx = new TransactionBlock();
    tx.setGasBudget(20000000);

    tx.moveCall({
      target: `${SUI_CONTRACT_PACKAGE_ID}::${SUI_MODULE_NAME}::burn`,
      arguments: [
        tx.object(latestTreasuryCap.objectId),
        tx.object(latestMinterCap.objectId),
        tx.object(coinId),
      ],
    });

    const result = await signAndExecuteTransaction(tx);
    console.log('Burning on Sui successful:', result.digest);
    return result.digest;
  } catch (error) {
    console.error('Error burning tokens on Sui:', error);
    throw error;
  }
};

// API Endpoint for bridging
app.post('/api/bridge', async (req, res) => {
  const { direction, amount, ethAccount, suiAccount } = req.body;

  try {
    if (!direction || !['eth-to-sui', 'sui-to-eth'].includes(direction)) {
      throw new Error('Invalid bridge direction specified');
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount specified');
    }
    if (!ethAccount?.startsWith('0x') || ethAccount.length !== 42) {
      throw new Error('Invalid Ethereum account address');
    }
    if (!suiAccount?.startsWith('0x')) {
      throw new Error('Invalid Sui account address');
    }

    if (direction === 'eth-to-sui') {
      const burnAmount = parseAmount(amount);
      const burnTx = await ethContract.burn(ethAccount, burnAmount);
      console.log('Burning on Ethereum initiated:', burnTx.hash);

      const receipt = await Promise.race([
        burnTx.wait(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Ethereum transaction timeout')), 60000)
        ),
      ]);
      console.log('Burning on Ethereum confirmed:', receipt.hash);

      // Use the same amount as burned on Ethereum
      const mintTxDigest = await mintTokensSui(burnAmount, suiAccount);
      console.log('Minting on Sui completed:', mintTxDigest);

      res.status(200).json({
        success: true,
        message: 'Bridge from Ethereum to Sui successful',
        mintTxDigest,
        ethTxHash: receipt.hash,
      });
    } else {
      // Get the coin ID from the user's account
      const coinId = await getOwnedCoin(suiAccount);
      console.log('Found coin to burn:', coinId);
      
      const burnTxDigest = await burnTokensSui(coinId);
      console.log('Burning on Sui completed:', burnTxDigest);

      const mintAmount = parseAmount(amount);
      const mintTx = await ethContract.mint(ethAccount, mintAmount);
      console.log('Minting on Ethereum initiated:', mintTx.hash);

      const receipt = await Promise.race([
        mintTx.wait(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Ethereum transaction timeout')), 60000)
        ),
      ]);
      console.log('Minting on Ethereum confirmed:', receipt.hash);

      res.status(200).json({
        success: true,
        message: 'Bridge from Sui to Ethereum successful',
        burnTxDigest,
        ethTxHash: receipt.hash,
      });
    }
  } catch (error) {
    console.error('Bridge operation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Bridge operation failed',
      error: error.message,
      details: error.stack,
    });
  }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Bridge backend service running on port ${PORT}`);
  console.log(`Connected to Sui network: ${NETWORK}`);
  console.log(`Sui RPC URL: ${SUI_RPC_URL}`);
  console.log(`Ethereum RPC URL: ${ETH_RPC_URL}`);
});