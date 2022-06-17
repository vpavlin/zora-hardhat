// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";



contract DummyERC1155 is ERC1155 {

    uint256 public totalSupply;
    constructor() ERC1155("") {}

    function mint() external {
        _mint(msg.sender, totalSupply, 10, "");
        ++totalSupply;
    }
}