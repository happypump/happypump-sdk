import { PublicKey } from "@solana/web3.js";
import { struct, bool, u64, publicKey } from "@coral-xyz/borsh";



export class GlobalAccount {
  // public discriminator: bigint;
  public initialized: boolean = false;
  public authority: PublicKey;
  public feeRecipient: PublicKey;
  public initialVirtualTokenReserves: bigint;
  public initialVirtualSolReserves: bigint;
  public initialRealTokenReserves: bigint;
  public initialTokenSupply: bigint;
  public mintFee: bigint;
  public systemFeeBasisPoints: bigint;
  public creatorFeeBasisPoints: bigint;

  constructor(
    // discriminator: bigint,
    initialized: boolean,
    authority: PublicKey,
    feeRecipient: PublicKey,
    initialVirtualTokenReserves: bigint,
    initialVirtualSolReserves: bigint,
    initialRealTokenReserves: bigint,
    initialTokenSupply: bigint,
    mintFee: bigint,
    systemFeeBasisPoints: bigint,
    creatorFeeBasisPoints: bigint,
  ) {
    // this.discriminator = discriminator;
    this.initialized = initialized;
    this.authority = authority;
    this.feeRecipient = feeRecipient;
    this.initialVirtualTokenReserves = initialVirtualTokenReserves;
    this.initialVirtualSolReserves = initialVirtualSolReserves;
    this.initialRealTokenReserves = initialRealTokenReserves;
    this.initialTokenSupply = initialTokenSupply;
    this.mintFee = mintFee;
    this.systemFeeBasisPoints = systemFeeBasisPoints;
    this.creatorFeeBasisPoints = creatorFeeBasisPoints;
  }

  getInitialBuyPrice(amount: bigint): bigint {
    if (amount <= 0n) {
      return 0n;
    }

    let n = this.initialVirtualSolReserves * this.initialVirtualTokenReserves;
    let i = this.initialVirtualSolReserves + amount;
    let r = n / i + 1n;
    let s = this.initialVirtualTokenReserves - r;
    return s < this.initialRealTokenReserves
      ? s
      : this.initialRealTokenReserves;
  }

  public static fromObject(obj: Record<string, any>): GlobalAccount {    
    return new GlobalAccount(
      // BigInt(obj.discriminator),
      obj.initialized,
      obj.authority as PublicKey,
      obj.feeRecipient as PublicKey,
      BigInt(obj.initialVirtualTokenReserves),
      BigInt(obj.initialVirtualSolReserves),
      BigInt(obj.initialRealTokenReserves),
      BigInt(obj.initialTokenSupply),
      BigInt(obj.mintFee),
      BigInt(obj.systemFeeBasisPoints),  
      BigInt(obj.creatorFeeBasisPoints),
    );
  }

  public static fromBuffer(buffer: Buffer): GlobalAccount {
    const structure/*: Layout<GlobalAccount>*/ = struct([
      u64("discriminator"),
      bool("initialized"),
      publicKey("authority"),
      publicKey("feeRecipient"),
      u64("initialVirtualTokenReserves"),
      u64("initialVirtualSolReserves"),
      u64("initialRealTokenReserves"),
      u64("tokenTotalSupply"),
      u64("mintFee"),
      u64("systemFeeBasisPoints"),
      u64("creatorFeeBasisPoints"),
    ]);

    let value = structure.decode(buffer);
    return new GlobalAccount(
      // BigInt(value.discriminator),
      value.initialized,
      value.authority,
      value.feeRecipient,
      BigInt(value.initialVirtualTokenReserves),
      BigInt(value.initialVirtualSolReserves),
      BigInt(value.initialRealTokenReserves),
      BigInt(value.tokenTotalSupply),
      BigInt(value.mintFee),
      BigInt(value.systemFeeBasisPoints),
      BigInt(value.creatorFeeBasisPoints),
    );
  }
}