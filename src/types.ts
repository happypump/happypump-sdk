import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";


export type CreateTokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  file: Blob;
  twitter?: string;
  telegram?: string;
  website?: string;
};

export type PriorityFee = {
    unitLimit: number;
    unitPrice: number;
};


export type TransactionResult = {
    signature?: string;
    error?: unknown;
    results?: VersionedTransactionResponse;
    success: boolean;
};


export type CreateEvent = {
    name: string;
    symbol: string;
    uri: string;
    mint: PublicKey;
    bondingCurve: PublicKey;
    user: PublicKey;
    tradeAuthority?: PublicKey;
    timestamp: number;
    virtualTokenReserves: bigint;
    virtualSolReserves: bigint;
    realTokenReserves: bigint;
    realSolReserves: bigint;
  };

export type CompleteEvent = {
    user: PublicKey;
    mint: PublicKey;
    bondingCurve: PublicKey;
    timestamp: number;
};

export type TradeEvent = {
    mint: PublicKey;
    solAmount: bigint;
    tokenAmount: bigint;
    isBuy: boolean;
    user: PublicKey;
    timestamp: number;
    virtualSolReserves: bigint;
    virtualTokenReserves: bigint;
    realSolReserves: bigint;
    realTokenReserves: bigint;
  };



  export type SetGlobalCfgEvent = {
    feeRecipient: PublicKey;
    mintFee: bigint;
    creatorFeeBasisPoints: bigint;
    systemFeeBasisPoints: bigint;
    initialVirtualTokenReserves: bigint;
    initialVirtualSolReserves: bigint;
    initialRealTokenReserves: bigint;
    initialRealSolReserves: bigint;
    initialTokenSupply: bigint;
    timestamp: number;
  };