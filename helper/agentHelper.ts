import { createPublicClient, createWalletClient, custom, http, WalletClient } from "viem";
import { Address } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import Safe, { getSafeAddressFromDeploymentTx } from "@safe-global/protocol-kit";
import { CdpWalletProvider } from "@coinbase/agentkit";
import SafeApiKit from "@safe-global/api-kit";

const AGENT_SIGNER_ADDRESS = "0x897A99e53440703eF4817215821926F6067091f7";
const RPC_URL = "https://sepolia.base.org";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// safe api clients
const apiKit = new SafeApiKit({
  chainId: BigInt(baseSepolia.id),
});

// forward standard eip1193 methods to CDP Wallet Provider
export const transformTransport = (cdpProvider: CdpWalletProvider) => {
  const transport = custom({
    async request({ method, params }) {
      if (method === "eth_sendTransaction") {
        return cdpProvider.sendTransaction(params);
      }

      // Signing methods
      if (method === "personal_sign") {
        return cdpProvider.signMessage(params[0]);
      }

      if (method === "eth_signTypedData_v4") {
        return cdpProvider.signTypedData(params[0]);
      }
    },
  });

  return transport;
};

// create a safe from agent account (cdp wallet provider)
export const createSafeFromAgent = async (agentAccount: CdpWalletProvider, employerAddress: Address, employeeAddress: Address) => {
  console.log(employerAddress);

  const client = createWalletClient({ chain: baseSepolia, transport: transformTransport(agentAccount) });

  const agentAddress = await agentAccount.getAddress();
  const safeClient = await Safe.init({
    provider: client.transport,
    signer: agentAddress,
    predictedSafe: {
      safeAccountConfig: {
        owners: [employerAddress, employeeAddress, agentAddress],
        threshold: 2,
      },
    },
  });

  if (await safeClient.isSafeDeployed()) {
    console.log("safe already deployed");
  }

  const deploymentTransaction = await safeClient.createSafeDeploymentTransaction();

  const transactionHash = await agentAccount.sendTransaction({
    to: deploymentTransaction.to,
    value: BigInt(deploymentTransaction.value),
    data: deploymentTransaction.data as `0x${string}`,
  });

  // wait for the transaction to be done
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });

  const safeAddress = getSafeAddressFromDeploymentTx(receipt, "1.4.1");

  console.log("safeclient", deploymentTransaction, await safeClient.isSafeDeployed(), await safeClient.getAddress(), safeClient.getPredictedSafe());

  return safeAddress;
};

export const getDeployedSafeClient = async (safeAddress: Address, signer: WalletClient) => {
  const safeClient = await Safe.init({
    provider: signer.transport,
    safeAddress: safeAddress,
    signer: (await signer.requestAddresses())[0],
  });

  if (!(await safeClient.isSafeDeployed())) {
    throw new Error("Safe not deployed");
  }

  return safeClient;
};

// approve a transaction to the safe (safeclient needs to be deployed safe)
export const approveWithdrawTransaction = async (safeClient: Safe) => {
  // check safe client deployed
  if (!(await safeClient.isSafeDeployed())) {
    throw new Error("Safe not deployed");
  }

  // Get pending transactions that need a signature
  const pendingTransactions = await apiKit.getPendingTransactions(await safeClient.getAddress());
  // We assume there is only one pending transaction for the safe address
  const transaction = pendingTransactions.results[0];
  // sign the transaction
  const signature = await safeClient.signHash(transaction.transactionHash);
  // confirm the transaction
  await apiKit.confirmTransaction(transaction.transactionHash, signature.data);
  // execute the transaction
  await safeClient.executeTransaction(transaction);
  // todo: better resp
  return true;
};
