import { BN } from "bn.js";
import { Program, Provider } from "@coral-xyz/anchor";
import { createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { Commitment, Connection, Finality, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { calculateWithSlippageBuy, calculateWithSlippageSell, DEFAULT_COMMITMENT, DEFAULT_FINALITY, sendTx } from "./util.js";
import { CreateTokenMetadata, PriorityFee, TransactionResult } from "./types.js";
import { BondingCurveAccount } from "./bondingCurveAccount.js";
import { GlobalAccount } from "./globalAccount.js";
import { HappyPumpEventHandlers, HappyPumpEventType, toCompleteEvent, toCreateEvent, toSetGlobalCfgEvent, toTradeEvent } from "./events.js";
import { HappyPumpProgram, IDL } from "./IDL/index.js";


// const MPL_TOKEN_METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

export const GLOBAL_ACCOUNT_SEED = "global";
export const MINT_AUTHORITY_SEED = "mint-authority";
export const BONDING_CURVE_SEED = "bonding-curve";
export const METADATA_SEED = "metadata";

export const DEFAULT_DECIMALS = 6;


export class HappyPumpSDK {
    public program: Program<HappyPumpProgram>;
    public connection: Connection;
    
    constructor(provider?: Provider) {
        this.program = new Program<HappyPumpProgram>(IDL as HappyPumpProgram, provider);
        this.connection = this.program.provider.connection;
    }

    async create(
        creator: Keypair,
        mint: Keypair,
        createTokenMetadata: CreateTokenMetadata,
        tradeAuthority?: PublicKey,
        priorityFees?: PriorityFee,
        commitment: Commitment = DEFAULT_COMMITMENT,
        finality: Finality = DEFAULT_FINALITY,
    ) {
        const globalAccount = await this.getGlobalAccount(commitment);

        const tokenMetadata = await this.createTokenMetadata(createTokenMetadata);

        const instructions = await this.getCreateInstructions(
            creator.publicKey,
            mint,
            createTokenMetadata.name,
            createTokenMetadata.symbol,
            tokenMetadata.uri,
            globalAccount.feeRecipient,
            tradeAuthority,
        );

        return await sendTx(
            this.connection,
            instructions,
            creator.publicKey,
            [creator, mint],
            priorityFees,
            commitment,
            finality,
        );
    }

    async createAndBuy(
        creator: Keypair,
        mint: Keypair,
        createTokenMetadata: CreateTokenMetadata,
        buyAmountSol: bigint,
        slippageBasisPoints: bigint = BigInt(500),
        tradeAuthority?: Keypair,
        priorityFees?: PriorityFee,
        commitment: Commitment = DEFAULT_COMMITMENT,
        finality: Finality = DEFAULT_FINALITY,
    ) {
        const globalAccount = await this.getGlobalAccount(commitment);

        const instructions: TransactionInstruction[] = [];

        const tokenMetadata = await this.createTokenMetadata(createTokenMetadata);

        const createIxs = await this.getCreateInstructions(
            creator.publicKey,
            mint,
            createTokenMetadata.name,
            createTokenMetadata.symbol,
            tokenMetadata.uri,
            globalAccount.feeRecipient,
            tradeAuthority?.publicKey,
        );

        instructions.push(...createIxs);

        if (buyAmountSol > 0) {
            const globalAccount = await this.getGlobalAccount(commitment);
            const buyAmount = globalAccount.getInitialBuyPrice(buyAmountSol);
            const buyAmountWithSlippage = calculateWithSlippageBuy(
                buyAmountSol,
                slippageBasisPoints,
            );

            const buyIxs = await this.getBuyInstructions(
                creator.publicKey,
                mint.publicKey,
                globalAccount.feeRecipient,
                creator.publicKey,
                buyAmount,
                buyAmountWithSlippage,
                tradeAuthority?.publicKey,
                commitment,
            );

            instructions.push(...buyIxs);
        }

        const signers = [creator, mint];
        if (!!tradeAuthority) {
            signers.push(tradeAuthority);
        } 

        return await sendTx(
            this.connection,
            instructions,
            creator.publicKey,
            signers,
            priorityFees,
            commitment,
            finality,
        );
    }

    async setBondingCurveCfg(
        user: Keypair,
        mint: PublicKey, 
        tradeAuthority?: PublicKey, 
        priorityFees?: PriorityFee,
        commitment: Commitment = DEFAULT_COMMITMENT,
        finality: Finality = DEFAULT_FINALITY,
    ) {
       const instructions = await this.getSetBondingCurveCfgInstructions(
            user.publicKey,
            mint,
            tradeAuthority,
       );

        return await sendTx(
            this.connection,
            instructions,
            user.publicKey,
            [user],
            priorityFees,
            commitment,
            finality,
        );
    }

    async buy(
        buyer: Keypair,
        mint: PublicKey, 
        buyAmountSol: bigint,
        slippageBasisPoints: bigint = BigInt(500),
        tradeAuthority?: Keypair, 
        priorityFees?: PriorityFee,
        commitment: Commitment = DEFAULT_COMMITMENT,
        finality: Finality = DEFAULT_FINALITY,
    ) {
        const instructions = await this.getBuyInstructionsBySolAmount(
            buyer.publicKey,
            mint,
            buyAmountSol,
            slippageBasisPoints,
            tradeAuthority?.publicKey,
            commitment,
        );

        const signers = [buyer];
        if (!!tradeAuthority) {
            signers.push(tradeAuthority);
        }


        return await sendTx(
            this.connection,
            instructions,
            buyer.publicKey,
            signers,
            priorityFees,
            commitment,
            finality,
        );
    }

    async sell(
        seller: Keypair,
        mint: PublicKey,
        sellTokenAmount: bigint,
        slippageBasisPoints: bigint = 500n,
        priorityFees?: PriorityFee,
        commitment: Commitment = DEFAULT_COMMITMENT,
        finality: Finality = DEFAULT_FINALITY,
    ): Promise<TransactionResult> {
        const sellIxs = await this.getSellInstructionsByTokenAmount(
            seller.publicKey,
            mint,
            sellTokenAmount,
            slippageBasisPoints,
            commitment,
        );

        return await sendTx(
            this.connection,
            sellIxs,
            seller.publicKey,
            [seller],
            priorityFees,
            commitment,
            finality,
        );
    }

    async getCreateInstructions(
        creator: PublicKey,
        mint: Keypair,
        name: string,
        symbol: string,
        uri: string,
        feeRecipient: PublicKey,
        tradeAuthority?: PublicKey,
    ) {
        /*
        const mplTokenMetadata = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);
        const [metadataPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from(METADATA_SEED), 
                mplTokenMetadata.toBuffer(), 
                mint.publicKey.toBuffer(),
            ],
            mplTokenMetadata,
        );
        */
            
        const createIx = await this.program.methods
            .create({ 
                name, 
                symbol, 
                uri,
                // @ts-ignore
                tradeAuthority: tradeAuthority ?? null,
                creator,
            })
            .accounts({
                program: this.program.programId,
                mint: mint.publicKey,
                creator,
                feeRecipient,             
            }).instruction();

        return [createIx];
    }

    async getBuyInstructionsBySolAmount(
        buyer: PublicKey,
        mint: PublicKey,
        buyAmountSol: bigint,
        slippageBasisPoints: bigint = 500n,
        tradeAuthority?: PublicKey,
        commitment: Commitment = DEFAULT_COMMITMENT,
    ) {
        const globalAccount = await this.getGlobalAccount(commitment);        
      
        const bondingCurveAccount = await this.getBondingCurveAccount(
            mint,
            commitment
        );

        if (!bondingCurveAccount) {
            throw new Error(`Bonding curve account not found: ${mint.toBase58()}`);
        }
      
        const totalFeeBasisPoints = globalAccount.systemFeeBasisPoints + globalAccount.creatorFeeBasisPoints;
        const effectiveBuyAmountSol = buyAmountSol - (buyAmountSol * totalFeeBasisPoints) / 10000n;

        const buyAmount = bondingCurveAccount.getBuyPrice(effectiveBuyAmountSol);
        const buyAmountWithSlippage = calculateWithSlippageBuy(
            buyAmountSol,
            slippageBasisPoints,
        );
        console.log(`buyAmountSol: ${buyAmountSol}, effectiveBuyAmountSol: ${effectiveBuyAmountSol}, buyAmount: ${buyAmount}, buyAmountWithSlippage: ${buyAmountWithSlippage}`);

        return await this.getBuyInstructions(
            buyer,
            mint,
            globalAccount.feeRecipient,
            bondingCurveAccount.creator,
            buyAmount,
            buyAmountWithSlippage,
            tradeAuthority,
            commitment,
        );
    }

    async getBuyInstructions(
        buyer: PublicKey,
        mint: PublicKey,
        feeRecipient: PublicKey,
        creatorFeeRecipient: PublicKey,
        amount: bigint,
        solAmount: bigint,
        tradeAuthority?: PublicKey,
        commitment: Commitment = DEFAULT_COMMITMENT,
    ) {
        const instructions: TransactionInstruction[] = [];

        const associatedUser = await getAssociatedTokenAddress(mint, buyer, false);
      
        try {
            await getAccount(this.connection, associatedUser, commitment);
        } catch (e) {
            // console.log('catch createAssociatedTokenAccountInstruction: ', e);
            instructions.push(
                createAssociatedTokenAccountInstruction(
                    buyer,
                    associatedUser,
                    buyer,
                    mint,
                )
            );
        }

        console.log("amount: ", amount);
        console.log("solAmount: ", solAmount);

        instructions.push(
            await this.program.methods.buy({
                tokenAmount: new BN(amount.toString()), 
                maxSolCost: new BN(solAmount.toString()),
             }).accounts({
                user: buyer,
                mint,
                feeRecipient,
                creatorFeeRecipient, // 换掉报错否
                // @ts-ignore
                tradeAuthority: tradeAuthority ?? null,
            }).instruction(),
        );

        return instructions;
    }

    // sell
    async getSellInstructionsByTokenAmount(
        seller: PublicKey,
        mint: PublicKey,
        sellTokenAmount: bigint,
        slippageBasisPoints: bigint = 500n,
        commitment: Commitment = DEFAULT_COMMITMENT
    ) {
        const bondingCurveAccount = await this.getBondingCurveAccount(
            mint,
            commitment
        );
    
        if (!bondingCurveAccount) {
            throw new Error(`Bonding curve account not found: ${mint.toBase58()}`);
        }

        const globalAccount = await this.getGlobalAccount(commitment);

        const minSolOutput = bondingCurveAccount.getSellPrice(
            sellTokenAmount,
            globalAccount.systemFeeBasisPoints + globalAccount.creatorFeeBasisPoints,
        );

        const sellAmountWithSlippage = calculateWithSlippageSell(
            minSolOutput,
            slippageBasisPoints
        );

        console.log(`minSolOutput: ${minSolOutput}, sellTokenAmount: ${sellTokenAmount}`);

        return await this.getSellInstructions(
            seller,
            mint,
            globalAccount.feeRecipient,
            bondingCurveAccount.creator,
            sellTokenAmount,
            sellAmountWithSlippage
        );
    }

    async getSellInstructions(
        seller: PublicKey,
        mint: PublicKey,
        feeRecipient: PublicKey,
        creatorFeeRecipient: PublicKey,
        amount: bigint,
        minSolOutput: bigint
    ) {
        const instructions: TransactionInstruction[] = [];
        instructions.push(
            await this.program.methods
                .sell({
                    tokenAmount: new BN(amount.toString()), 
                    minSolOutput: new BN(minSolOutput.toString()),
                })
                .accounts({
                    program: this.program.programId,
                    user: seller,
                    mint,
                    feeRecipient,
                    creatorFeeRecipient,
                })
                .instruction()
        );

        return instructions;
    }

    async getSetBondingCurveCfgInstructions(
        user: PublicKey,
        mint: PublicKey, 
        tradeAuthority?: PublicKey,
    ) {
        const setBondingCurveCfgIx = await this.program.methods.setBondingCurveCfg({
            tradeAuthority,
        }).accounts({
            user,
            mint,
        }).instruction();
    
        return [setBondingCurveCfgIx];
    }

    async getGlobalAccount(commitment: Commitment = DEFAULT_COMMITMENT): Promise<GlobalAccount> {
        const [globalAccountPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from(GLOBAL_ACCOUNT_SEED)],
            this.program.programId
        );

        /*
        const tokenAccount = await this.connection.getAccountInfo(
            globalAccountPDA,
            commitment,
        );
        */

        const res = await this.program.account.global.fetch(globalAccountPDA, commitment);

        return GlobalAccount.fromObject(res);
    }

    getBondingCurvePDA(mint: PublicKey) {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("bonding-curve"), mint.toBuffer()],
            this.program.programId
        )[0];
    }

    async getBondingCurveAccount(
        mint: PublicKey,
        commitment: Commitment = DEFAULT_COMMITMENT,
    ): Promise<BondingCurveAccount | undefined> {
        const tokenAccount = await this.connection.getAccountInfo(
            this.getBondingCurvePDA(mint),
            commitment
        );

        if (!tokenAccount) {
            return undefined;
        }

        return BondingCurveAccount.fromBuffer(tokenAccount.data);
    }

    async createTokenMetadata(create: CreateTokenMetadata) {
        // Validate file
        if (!(create.file instanceof Blob)) {
            throw new Error('File must be a Blob or File object');
        }
    
        let formData = new FormData();
        formData.append("file", create.file, 'image.png'); // Add filename
        formData.append("name", create.name);
        formData.append("symbol", create.symbol);
        formData.append("description", create.description);
        formData.append("twitter", create.twitter || "");
        formData.append("telegram", create.telegram || "");
        formData.append("website", create.website || "");
        formData.append("showName", "true");
    
        try {
            const request = await fetch("https://happypump.io/api/ipfs", {
                method: "POST",
                headers: {
                    'Accept': 'application/json',
                },
                body: formData,
                credentials: 'same-origin'
            });
    
            if (request.status === 500) {
                // Try to get more error details
                const errorText = await request.text();
                throw new Error(`Server error (500): ${errorText || 'No error details available'}`);
            }
    
            if (!request.ok) {
                throw new Error(`HTTP error! status: ${request.status}`);
            }
    
            const responseText = await request.text();
            if (!responseText) {
                throw new Error('Empty response received from server');
            }
    
            try {
                return JSON.parse(responseText);
            } catch (e) {
                throw new Error(`Invalid JSON response: ${responseText}`);
            }
        } catch (error) {
            console.error('Error in createTokenMetadata:', error);
            // throw error;
            return {
                uri: "http://www.foo.com",
            };
        }
    }

    // events
    addEventListener<T extends HappyPumpEventType>(
        eventType: T, 
        callback: (
            event: HappyPumpEventHandlers[T],
            slot: number,
            signature: string,
        ) => void
    ) {
        return this.program.addEventListener(
            eventType,
            (event: any, slot: number, signature: string) => {                
                let processedEvent;
                switch (eventType) {
                    case "createEvent":
                        processedEvent = toCreateEvent(event);
                        callback(
                            processedEvent,
                            slot,
                            signature,
                        );
                        break;
                    case "tradeEvent":
                        processedEvent = toTradeEvent(event);
                        callback(
                            processedEvent,
                            slot,
                            signature,
                        );
                        break;
                    case "completeEvent":
                        processedEvent = toCompleteEvent(event);
                        callback(
                            processedEvent,
                            slot,
                            signature,
                        );
                        break;
                    case "setGlobalCfgEvent":
                        processedEvent = toSetGlobalCfgEvent(event);
                        callback(
                            processedEvent,
                            slot,
                            signature,
                        );
                        break;
                    default:
                        console.error(`Unhandled event type: ${eventType}`);
                        break;
                }                
            }
        );
    }

    removeEventListener(eventId: number) {
        this.program.removeEventListener(eventId);
    }
}