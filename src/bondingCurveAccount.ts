import { BorshCoder } from "@coral-xyz/anchor";
import { struct, bool, u64, publicKey, option } from "@coral-xyz/borsh";
import { PublicKey } from "@solana/web3.js";



export class BondingCurveAccount {
  public discriminator: bigint;
  public virtualSolReserves: bigint;
  public virtualTokenReserves: bigint;
  public realSolReserves: bigint;
  public realTokenReserves: bigint;
  public tokenTotalSupply: bigint;
  public active: boolean;
  public creator: PublicKey;
  public tradeAuthority: PublicKey | null;
  public complete: boolean;
  
  constructor(
    discriminator: bigint,
    virtualSolReserves: bigint,
    virtualTokenReserves: bigint,
    realSolReserves: bigint,
    realTokenReserves: bigint,
    tokenTotalSupply: bigint,
    active: boolean,
    creator: PublicKey,
    tradeAuthority: PublicKey | null,
    complete: boolean,
  ) {
    this.discriminator = discriminator;
    this.virtualSolReserves = virtualSolReserves;
    this.virtualTokenReserves = virtualTokenReserves;
    this.realSolReserves = realSolReserves;
    this.realTokenReserves = realTokenReserves;
    this.tokenTotalSupply = tokenTotalSupply;
    this.active = active;
    this.creator = creator;
    this.tradeAuthority = tradeAuthority;
    this.complete = complete;
  }

  getBuyPrice(amount: bigint): bigint {
    if (this.complete) {
      throw new Error("Curve is complete");
    }

    if (amount <= 0n) {
      return 0n;
    }

    // Calculate the product of virtual reserves
    let n = this.virtualSolReserves * this.virtualTokenReserves;

    // Calculate the new virtual sol reserves after the purchase
    let i = this.virtualSolReserves + amount;

    // Calculate the new virtual token reserves after the purchase
    let r = n / i + 1n;

    // Calculate the amount of tokens to be purchased
    let s = this.virtualTokenReserves - r;

    // Return the minimum of the calculated tokens and real token reserves
    return s < this.realTokenReserves ? s : this.realTokenReserves;
  }

  getSellPrice(amount: bigint, feeBasisPoints: bigint): bigint {
    if (this.complete) {
      throw new Error("Curve is complete");
    }

    if (amount <= 0n) {
      return 0n;
    }

    // Calculate the proportional amount of virtual sol reserves to be received
    let n =
      (amount * this.virtualSolReserves) / (this.virtualTokenReserves + amount);

    // Calculate the fee amount in the same units
    let a = (n * feeBasisPoints) / 10000n;

    // Return the net amount after deducting the fee
    return n - a;
  }

  getMarketCapSOL(): bigint {
    if (this.virtualTokenReserves === 0n) {
      return 0n;
    }

    return (
      (this.tokenTotalSupply * this.virtualSolReserves) /
      this.virtualTokenReserves
    );
  }

  getFinalMarketCapSOL(feeBasisPoints: bigint): bigint {
    let totalSellValue = this.getBuyOutPrice(
      this.realTokenReserves,
      feeBasisPoints
    );
    let totalVirtualValue = this.virtualSolReserves + totalSellValue;
    let totalVirtualTokens = this.virtualTokenReserves - this.realTokenReserves;

    if (totalVirtualTokens === 0n) {
      return 0n;
    }

    return (this.tokenTotalSupply * totalVirtualValue) / totalVirtualTokens;
  }

  getBuyOutPrice(amount: bigint, feeBasisPoints: bigint): bigint {
    let solTokens =
      amount < this.realSolReserves ? this.realSolReserves : amount;
    let totalSellValue =
      (solTokens * this.virtualSolReserves) /
        (this.virtualTokenReserves - solTokens) +
      1n;
    let fee = (totalSellValue * feeBasisPoints) / 10000n;
    return totalSellValue + fee;
  }

  public static fromBuffer(buffer: Buffer): BondingCurveAccount {  
    const discriminator = buffer.subarray(0, 8).readBigInt64LE();

    const layout = struct([
      u64("virtualSolReserves"),
      u64("virtualTokenReserves"),
      u64("realSolReserves"),
      u64("realTokenReserves"),
      u64("tokenTotalSupply"),
      bool("active"),
      publicKey("creator"),
      option(publicKey(), "tradeAuthority"),
      bool("complete"),
    ]);

    const value = layout.decode(buffer.subarray(8));

    return new BondingCurveAccount(
      BigInt(discriminator),
      BigInt(value.virtualSolReserves),
      BigInt(value.virtualTokenReserves),
      BigInt(value.realSolReserves),
      BigInt(value.realTokenReserves),
      BigInt(value.tokenTotalSupply),
      value.active,
      value.creator,
      value.tradeAuthority,
      value.complete,
    );
  }
}