// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import "../src/IBT.sol";

contract DeployIBT is Script {
    function run() external {
        // This will get whichever private key is provided from Foundry's CLI
        vm.startBroadcast();
        
        // Deploy the contract
        IBT ibt = new IBT();
        
        vm.stopBroadcast();
    }
}