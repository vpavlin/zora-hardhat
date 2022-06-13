// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";



contract DummyERC721 is ERC721 {

    uint256 public totalSupply;
    constructor() ERC721("Dummy ERC721", "DMY") {}

    function mint() external {
        _mint(msg.sender, totalSupply);
        ++totalSupply;
    }
}