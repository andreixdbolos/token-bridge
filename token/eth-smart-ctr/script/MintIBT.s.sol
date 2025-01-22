// scripts/IBT.s.sol
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/IBT.sol";

// MintIBT.s.sol
contract MintIBTScript is Script {
    function run() external {
        vm.startBroadcast();
        IBT ibt = IBT(0x5FbDB2315678afecb367f032d93F642f64180aa3);
        ibt.mint(msg.sender, 100 * 10**18);
        vm.stopBroadcast();
    }
}