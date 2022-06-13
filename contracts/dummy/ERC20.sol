// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";



contract DummyERC20 is ERC20 {
    constructor() ERC20("Dummy ERC721", "DMY") {
        _mint(msg.sender, 1_000_000 ether);
    }
}