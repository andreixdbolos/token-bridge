module 0x0::token {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin, CoinMetadata, TreasuryCap};
    use std::option;
    use sui::url;
    use sui::event;

    /// The type identifier of TOKEN coin - One-time witness type 
    public struct TOKEN has drop {}

    /// Capability that grants permission to mint and burn TOKEN coins
    public struct MinterCap has key, store {
        id: UID
    }

    /// Event emitted when tokens are minted
    public struct MintEvent has copy, drop {
        amount: u64,
        recipient: address
    }

    /// Event emitted when tokens are burned
    public struct BurnEvent has copy, drop {
        amount: u64, 
        sender: address
    }

    // ======== Functions ========     

    /// Initialize a new TOKEN coin type and create capabilities
    fun init(witness: TOKEN, ctx: &mut TxContext) {
        // Create coin metadata
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9, // decimals
            b"IBT", // symbol
            b"Inter-Blockchain Token", // name
            b"A bridgeable token between Ethereum and Sui", // description
            option::some(url::new_unsafe_from_bytes(b"https://example.com/ibt.png")), // icon url
            ctx
        );

        // Create minter capability
        let minter_cap = MinterCap {
            id: object::new(ctx)
        };

        // Transfer the capabilities to the deployer
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
        transfer::public_transfer(metadata, tx_context::sender(ctx));
        transfer::public_transfer(minter_cap, tx_context::sender(ctx));
    }

    /// Mint new TOKEN coins
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<TOKEN>,
        _minter_cap: &MinterCap,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        // Create new coins with balance
        let coin = coin::mint(treasury_cap, amount, ctx);
        
        // Transfer the coins to recipient
        transfer::public_transfer(coin, recipient);

        // Emit mint event
        event::emit(MintEvent {
            amount,
            recipient
        });
    }

    /// Burn TOKEN coins
    public entry fun burn(
        treasury_cap: &mut TreasuryCap<TOKEN>,
        _minter_cap: &MinterCap, 
        coin: Coin<TOKEN>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&coin);

        // Burn the coins
        coin::burn(treasury_cap, coin);

        // Emit burn event
        event::emit(BurnEvent {
            amount,
            sender: tx_context::sender(ctx) 
        });
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(TOKEN {}, ctx)
    }
}