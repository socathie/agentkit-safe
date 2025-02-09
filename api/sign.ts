import { AgentKit, CdpWalletProvider } from "@coinbase/agentkit";
import { approveWithdrawTransaction, createSafeFromAgent, getDeployedSafeClient, transformTransport } from "../helper/agentHelper";

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createWalletClient } from "node_modules/viem/_types";
import { baseSepolia } from "node_modules/viem/_types/chains";

const walletData = {
  walletId: "06be1f44-0b15-45a9-afd6-23d9a2817791",
  seed: process.env.CDP_WALLET_SEED,
  networkId: "base-sepolia",
};

export async function handler(request: VercelRequest, res: VercelResponse) {
  try {
    const provider = await CdpWalletProvider.configureWithWallet({
      // Optional: Provide API key details. If not provided, it will attempt to configure from JSON.
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,

      networkId: "base-sepolia", // other options: "base-mainnet", "ethereum-mainnet", "arbitrum-mainnet", "polygon-mainnet".
      cdpWalletData: JSON.stringify(walletData),
    });

    const agentKit = await AgentKit.from({
      walletProvider: provider,
    });

    console.log(agentKit);

    const { safeAddress } = await request.body();

    if (!safeAddress) {
      return res.status(400).json({ error: "Safe address is required" });
    }

    const client = createWalletClient({ transport: transformTransport(provider), chain: baseSepolia });
    const safeClient = await getDeployedSafeClient(safeAddress, client);
    // Create a new multisig agent in the database

    const result = await approveWithdrawTransaction(safeClient);

    return res.json({ success: result });
  } catch (error) {
    console.error("Error creating multisig agent:", error);
    return res.status(500).json({ error: "Failed to create multisig agent." });
  }
}
