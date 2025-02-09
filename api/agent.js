import { AgentKit, CdpWalletProvider } from "@coinbase/agentkit";

const walletData = {
  walletId: "06be1f44-0b15-45a9-afd6-23d9a2817791",
  seed: process.env.CDP_WALLET_SEED,
  networkId: "base-sepolia",
};

const provider = await CdpWalletProvider.configureWithWallet({
  // Optional: Provide API key details. If not provided, it will attempt to configure from JSON.
  apiKeyName: process.env.CDP_API_KEY_NAME,
  apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,

  // Optional: Provide network ID (defaults to base-sepolia if not specified)
  networkId: "base-sepolia", // other options: "base-mainnet", "ethereum-mainnet", "arbitrum-mainnet", "polygon-mainnet".

  // Optional: Provide existing wallet data as JSON string
  cdpWalletData: JSON.stringify(walletData),
});

const agentKit = await AgentKit.from({
  walletProvider: provider,
});

export default async function handler(req, res) {
  const { safeAddress } = req.query;
  
  const address = provider.getAddress();

  return res.json({
    message: `Wallet address: ${address}`,
  });
}
