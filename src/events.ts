import { PublicKey } from "@solana/web3.js";

import {
  CompleteEvent,
  CreateEvent,
  SetGlobalCfgEvent,
  TradeEvent,
} from "./types.js";

export function toCreateEvent(event): CreateEvent {
  return {
    name: event.name,
    symbol: event.symbol,
    uri: event.uri,
    mint: new PublicKey(event.mint),
    tradeAuthority: event.tradeAuthority ? new PublicKey(event.tradeAuthority) : undefined,
    bondingCurve: new PublicKey(event.bondingCurve),
    user: new PublicKey(event.user),
    timestamp: Number(event.ts),
    virtualTokenReserves: BigInt(event.virtualTokenReserves),
    virtualSolReserves: BigInt(event.virtualSolReserves),
    realTokenReserves: BigInt(event.realTokenReserves),
    realSolReserves: BigInt(event.realSolReserves),
  };
}

export function toTradeEvent(event): TradeEvent {
  return {
    mint: new PublicKey(event.mint),
    solAmount: BigInt(event.solAmount),
    tokenAmount: BigInt(event.tokenAmount),
    isBuy: event.isBuy,
    user: new PublicKey(event.user),
    timestamp: Number(event.timestamp),
    virtualSolReserves: BigInt(event.virtualSolReserves),
    virtualTokenReserves: BigInt(event.virtualTokenReserves),
    realSolReserves: BigInt(event.realSolReserves),
    realTokenReserves: BigInt(event.realTokenReserves),
  };
}

export function toCompleteEvent(event): CompleteEvent {
  return {
    user: new PublicKey(event.user),
    mint: new PublicKey(event.mint),
    bondingCurve: new PublicKey(event.bondingCurve),
    timestamp: Number(event.timestamp),
  };
}


export function toSetGlobalCfgEvent(event): SetGlobalCfgEvent {
  return {
    feeRecipient: new PublicKey(event.feeRecipient),
    mintFee: event.mintFee,
    creatorFeeBasisPoints: event.creatorFeeBasisPoints,
    systemFeeBasisPoints: event.systemFeeBasisPoints,
    initialVirtualTokenReserves: BigInt(event.initialVirtualTokenReserves),
    initialVirtualSolReserves: BigInt(event.initialVirtualSolReserves),
    initialRealTokenReserves: BigInt(event.initialRealTokenReserves),
    initialRealSolReserves: BigInt(event.initialRealSolReserves),
    initialTokenSupply: BigInt(event.initialTokenSupply),
    timestamp: Number(event.timestamp),
  };
}



export interface HappyPumpEventHandlers {
  createEvent: CreateEvent;
  tradeEvent: TradeEvent;
  completeEvent: CompleteEvent;
  setGlobalCfgEvent: SetGlobalCfgEvent;
}

export type HappyPumpEventType = keyof HappyPumpEventHandlers;

