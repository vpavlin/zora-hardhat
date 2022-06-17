// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import { DummyERC20 } from "../typechain/DummyERC20"
import { DummyERC721 } from "../typechain/DummyERC721"
import { DummyERC1155 } from "../typechain/DummyERC1155"
import { ERC20 } from "../typechain/ERC20"

type Deployed = {
  ERC721: string
  ERC20: string
  ERC1155: string
}

export type Tokens = {
  ERC20: ERC20
  ERC721: DummyERC721
  ERC1155: DummyERC1155
}

export const deployTokens = async (print?:Boolean) => {

  const dummy20:DummyERC20 = await (await ethers.getContractFactory("DummyERC20")).deploy() as DummyERC20
  const dummy721:DummyERC721 = await (await ethers.getContractFactory("DummyERC721")).deploy() as DummyERC721
  const dummy1155:DummyERC1155 = await (await ethers.getContractFactory("DummyERC1155")).deploy() as DummyERC1155

  const deployed:Deployed = {
    ERC20: dummy20.address,
    ERC721: dummy721.address,
    ERC1155: dummy1155.address,
  } 

  const tokens:Tokens = {
    ERC20: dummy20,
    ERC721: dummy721,
    ERC1155: dummy1155,
  }

  if (print) {
    console.log(deployed)
  }
  return tokens
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.

if (!module.parent) {
  deployTokens(true).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  // we were require()d from somewhere else
}

