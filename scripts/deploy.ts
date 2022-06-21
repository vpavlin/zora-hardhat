// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import { ZoraModuleManager } from "../typechain/ZoraModuleManager"
import { ZoraProtocolFeeSettings } from "../typechain/ZoraProtocolFeeSettings"
import { ERC20TransferHelper } from "../typechain/ERC20TransferHelper"
import { ERC721TransferHelper } from "../typechain/ERC721TransferHelper"
import { ERC1155TransferHelper } from "../typechain/ERC1155TransferHelper"
import { AsksFloorPrice } from "../typechain/AsksFloorPrice"
import { Royalties } from "../typechain/Royalties"
import { AsksFloorPriceErc1155 } from "../typechain/AsksFloorPriceErc1155"
import { ReserveAuctionBuyNowErc20 } from "../typechain/ReserveAuctionBuyNowErc20"
import { ReserveAuctionBuyNowErc20Erc1155 } from "../typechain/ReserveAuctionBuyNowErc20Erc1155"

import { FloorPrice } from "../typechain/FloorPrice"


export type Contracts = {
  WETH: string
  Registrar: string
  ZoraProtocolFeeSettings: ZoraProtocolFeeSettings
  ZoraModuleManager: ZoraModuleManager
  ERC20TransferHelper: ERC20TransferHelper
  ERC721TransferHelper: ERC721TransferHelper
  ERC1155TransferHelper: ERC1155TransferHelper
  AsksFP: AsksFloorPrice
  AsksFP1155: AsksFloorPriceErc1155
  ReserveAuctionBuyNowERC20: ReserveAuctionBuyNowErc20
  ReserveAuctionBuyNowERC20ERC1155: ReserveAuctionBuyNowErc20Erc1155
  FloorPrice: FloorPrice
  Royalties: Royalties
}

const deployed = (contracts:Contracts) => {
  let i=0;
  let result:any = {};
  for(let item of Object.values(contracts)) {
    result[Object.keys(contracts)[i]] = typeof(item) == "string" ? item : item.address;
    i++;
  }

  return JSON.stringify(result, null, 2)
}

export const deployZora = async (print?:Boolean) => {
  const wbnb = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const registrar = (await ethers.getSigners())[0];
  const feeSettings:ZoraProtocolFeeSettings = await (await ethers.getContractFactory("ZoraProtocolFeeSettings")).deploy() as ZoraProtocolFeeSettings
  await feeSettings.deployed()

  const royalties:Royalties = await (await ethers.getContractFactory("Royalties")).deploy() as Royalties
  const zmm:ZoraModuleManager = await (await ethers.getContractFactory("ZoraModuleManager")).deploy(registrar.address, feeSettings.address) as ZoraModuleManager

  await feeSettings.init(zmm.address, ethers.constants.AddressZero)

  
  const erc20TH:ERC20TransferHelper = await (await ethers.getContractFactory("ERC20TransferHelper")).deploy(zmm.address) as ERC20TransferHelper
  const erc721TH:ERC721TransferHelper = await (await ethers.getContractFactory("ERC721TransferHelper")).deploy(zmm.address) as ERC721TransferHelper
  const erc1155TH:ERC1155TransferHelper = await (await ethers.getContractFactory("ERC1155TransferHelper")).deploy(zmm.address) as ERC1155TransferHelper
  const floorPrice:FloorPrice = await (await ethers.getContractFactory("FloorPrice")).deploy(zmm.address) as FloorPrice

  const asksFloorPrice1155:AsksFloorPriceErc1155 = await (await ethers.getContractFactory("AsksFloorPriceErc1155")).deploy(
    erc20TH.address,
    erc1155TH.address,
    royalties.address,
    feeSettings.address,
    wbnb,
    floorPrice.address
  ) as AsksFloorPriceErc1155

  const asksFloorPrice:AsksFloorPrice = await (await ethers.getContractFactory("AsksFloorPrice")).deploy(
    erc20TH.address,
    erc721TH.address,
    royalties.address,
    feeSettings.address,
    wbnb,
    floorPrice.address
  ) as AsksFloorPrice

  const auctionBuyNowErc20:ReserveAuctionBuyNowErc20 = await (
    await ethers.getContractFactory("ReserveAuctionBuyNowErc20")).deploy(
      erc20TH.address,
      erc721TH.address,
      royalties.address,
      feeSettings.address,
      wbnb,
      floorPrice.address
    ) as ReserveAuctionBuyNowErc20

  const auctionBuyNowErc20Erc1155:ReserveAuctionBuyNowErc20Erc1155 = await (
    await ethers.getContractFactory("ReserveAuctionBuyNowErc20Erc1155")).deploy(
      erc20TH.address,
      erc1155TH.address,
      royalties.address,
      feeSettings.address,
      wbnb,
      floorPrice.address
    ) as ReserveAuctionBuyNowErc20Erc1155


  await zmm.registerModule(asksFloorPrice.address)
  await zmm.registerModule(asksFloorPrice1155.address)
  await zmm.registerModule(auctionBuyNowErc20.address)
  await zmm.registerModule(auctionBuyNowErc20Erc1155.address)


  const contracts:Contracts = {
    WETH: wbnb,
    Registrar: registrar.address,
    ZoraProtocolFeeSettings: feeSettings,
    ZoraModuleManager: zmm,
    ERC20TransferHelper: erc20TH,
    ERC721TransferHelper: erc721TH,
    ERC1155TransferHelper: erc1155TH,
    AsksFP: asksFloorPrice,
    AsksFP1155: asksFloorPrice1155,
    ReserveAuctionBuyNowERC20: auctionBuyNowErc20,
    ReserveAuctionBuyNowERC20ERC1155: auctionBuyNowErc20Erc1155,
    FloorPrice: floorPrice,
    Royalties: royalties,
  }

  if (print) {
    console.log(deployed(contracts))
  }

  return contracts

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.


if (!module.parent) {
  deployZora(true).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
