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
import { OffersV1 } from "../typechain/OffersV1"
import { ReserveAuctionBuyNowErc20 } from "../typechain/ReserveAuctionBuyNowErc20"
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
  OffersV1: OffersV1
  ReserveAuctionBuyNowERC20: ReserveAuctionBuyNowErc20
  FloorPrice: FloorPrice
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
  const zmm:ZoraModuleManager = await (await ethers.getContractFactory("ZoraModuleManager")).deploy(registrar.address, feeSettings.address) as ZoraModuleManager

  await feeSettings.init(zmm.address, ethers.constants.AddressZero)

  
  const erc20TH:ERC20TransferHelper = await (await ethers.getContractFactory("ERC20TransferHelper")).deploy(zmm.address) as ERC20TransferHelper
  const erc721TH:ERC721TransferHelper = await (await ethers.getContractFactory("ERC721TransferHelper")).deploy(zmm.address) as ERC721TransferHelper
  const erc1155TH:ERC1155TransferHelper = await (await ethers.getContractFactory("ERC1155TransferHelper")).deploy(zmm.address) as ERC1155TransferHelper
  const floorPrice:FloorPrice = await (await ethers.getContractFactory("FloorPrice")).deploy(zmm.address) as FloorPrice

  const asksFloorPrice:AsksFloorPrice = await (await ethers.getContractFactory("AsksFloorPrice")).deploy(
    erc20TH.address,
    erc721TH.address,
    ethers.constants.AddressZero,
    feeSettings.address,
    wbnb,
    floorPrice.address
  ) as AsksFloorPrice
  const offersv1:OffersV1 = await (await ethers.getContractFactory("OffersV1")).deploy(erc20TH.address, erc721TH.address, ethers.constants.AddressZero, feeSettings.address, wbnb) as OffersV1


  const auctionBuyNowErc20:ReserveAuctionBuyNowErc20 = await (
    await ethers.getContractFactory("ReserveAuctionBuyNowErc20")).deploy(
      erc20TH.address,
      erc721TH.address,
      ethers.constants.AddressZero,
      feeSettings.address,
      wbnb,
      floorPrice.address
    ) as ReserveAuctionBuyNowErc20


  await zmm.registerModule(asksFloorPrice.address)
  await zmm.registerModule(offersv1.address)
  await zmm.registerModule(auctionBuyNowErc20.address)





  const contracts:Contracts = {
    WETH: wbnb,
    Registrar: registrar.address,
    ZoraProtocolFeeSettings: feeSettings,
    ZoraModuleManager: zmm,
    ERC20TransferHelper: erc20TH,
    ERC721TransferHelper: erc721TH,
    ERC1155TransferHelper: erc1155TH,
    AsksFP: asksFloorPrice,
    OffersV1: offersv1,
    ReserveAuctionBuyNowERC20: auctionBuyNowErc20,
    FloorPrice: floorPrice,
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
