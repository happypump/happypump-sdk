import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { DEFAULT_DECIMALS, HappyPumpSDK } from "../../src/index.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  getOrCreateKeypair,
  getSPLBalance,
  printSOLBalance,
  printSPLBalance,
} from "../util.js";

const KEYS_FOLDER = path.join(import.meta.dirname, ".keys");
const SLIPPAGE_BASIS_POINTS = 100n;

//create token example:
//https://solscan.io/tx/bok9NgPeoJPtYQHoDqJZyRDmY88tHbPcAk1CJJsKV3XEhHpaTZhUCG3mA9EQNXcaUfNSgfPkuVbEsKMp6H7D9NY
//devnet faucet
//https://faucet.solana.com/

const main = async () => {
  dotenv.config();

  if (!process.env.HELIUS_RPC_URL) {
    console.error("Please set HELIUS_RPC_URL in .env file");
    console.error(
      "Example: HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<your api key>"
    );
    console.error("Get one at: https://www.helius.dev");
    return;
  }

  const connection = new Connection(process.env.HELIUS_RPC_URL || "");

  const wallet = new Wallet(new Keypair()); //note this is not used
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "finalized",
  });

  const testAccount = getOrCreateKeypair(KEYS_FOLDER, "id");
  const mint = getOrCreateKeypair(KEYS_FOLDER, "mint");
  console.log(`mint: ${mint.publicKey.toBase58()}`);

  await printSOLBalance(
    connection,
    testAccount.publicKey,
    "Test Account keypair"
  );

  const sdk = new HappyPumpSDK(provider);

  const globalAccount = await sdk.getGlobalAccount();
  console.log(globalAccount);

  const currentSolBalance = await connection.getBalance(testAccount.publicKey);
  if (currentSolBalance == 0) {
    console.log(
      "Please send some SOL to the test-account:",
      testAccount.publicKey.toBase58()
    );
    return;
  }

  console.log(await sdk.getGlobalAccount());

  //Check if mint already exists
  const boundingCurveAccount = await sdk.getBondingCurveAccount(mint.publicKey);
  if (!boundingCurveAccount) {
    console.log('boundingCurveAccount not found: ', boundingCurveAccount);
    const tokenMetadata = {
      name: "HP",
      symbol: "HP",
      description: "HP: This is a test token",
      file: await fs.openAsBlob("example/basic/icon.png"),
    };

    const createResults = await sdk.createAndBuy(
      testAccount,
      mint,
      tokenMetadata,
      BigInt(0.001 * LAMPORTS_PER_SOL),
      SLIPPAGE_BASIS_POINTS,
      undefined,
      {
        unitLimit: 250000,
        unitPrice: 250000,
      },
    );

    if (createResults.success) {
      console.log("Success:", `https://happypump.io/${mint.publicKey.toBase58()}`);
      const boundingCurveAccount = await sdk.getBondingCurveAccount(mint.publicKey);
      console.log("Bonding curve after create and buy", boundingCurveAccount);
      printSPLBalance(connection, mint.publicKey, testAccount.publicKey);
    }
  } else {
    console.log("boundingCurveAccount", boundingCurveAccount);
    console.log("Success:", `https://happypump.io/${mint.publicKey.toBase58()}`);
    printSPLBalance(connection, mint.publicKey, testAccount.publicKey);
  }

  if (boundingCurveAccount) {
    // buy 0.0001 SOL worth of tokens
    const buyResults = await sdk.buy(
      testAccount,
      mint.publicKey,
      BigInt(0.0001 * LAMPORTS_PER_SOL),
      SLIPPAGE_BASIS_POINTS,
      undefined,
      {
        unitLimit: 250000,
        unitPrice: 250000,
      },
    );

    if (buyResults.success) {
      printSPLBalance(connection, mint.publicKey, testAccount.publicKey);
      console.log("Bonding curve after buy", await sdk.getBondingCurveAccount(mint.publicKey));
    } else {
      console.log("Buy failed");
    }

    //sell all tokens
    const currentSPLBalance = await getSPLBalance(
      connection,
      mint.publicKey,
      testAccount.publicKey
    );
    console.log("currentSPLBalance", currentSPLBalance);

    if (currentSPLBalance) {
      let sellResults = await sdk.sell(
        testAccount,
        mint.publicKey,
        BigInt(currentSPLBalance * Math.pow(10, DEFAULT_DECIMALS)),
        SLIPPAGE_BASIS_POINTS,
        {
          unitLimit: 250000,
          unitPrice: 250000,
        },
      );
      if (sellResults.success) {
        await printSOLBalance(
          connection,
          testAccount.publicKey,
          "Test Account keypair"
        );

        printSPLBalance(connection, mint.publicKey, testAccount.publicKey, "After SPL sell all");
        console.log("Bonding curve after sell", await sdk.getBondingCurveAccount(mint.publicKey));
      } else {
        console.log("Sell failed");
      }
    }
  }
};

main();