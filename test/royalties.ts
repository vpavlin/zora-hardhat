import { expect } from "chai";
import { ethers } from "hardhat";

import { deployTokens, Tokens } from "../scripts/deployTokens"
import { deployZora, Contracts } from "../scripts/deploy"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Royalties", function () {
  let tokens:Tokens;
  let zora:Contracts;

  let addr1:SignerWithAddress;
  let addr2:SignerWithAddress;
  let royalty1:SignerWithAddress;
  let royalty2:SignerWithAddress;
  let owner:SignerWithAddress;
  let addrs:SignerWithAddress[]
  beforeEach(async () => {
    [owner, addr1, addr2, royalty1, royalty2, ...addrs] = await ethers.getSigners()
    tokens = await deployTokens()
    zora = await deployZora()

    await zora.ZoraModuleManager.setBatchApprovalForModules(
      [
        zora.AsksFP.address,
        zora.AsksFP1155.address,
        zora.ReserveAuctionBuyNowERC20.address,
        zora.ReserveAuctionBuyNowERC20ERC1155.address,
      ], true)
    await zora.ZoraModuleManager.connect(addr1).setBatchApprovalForModules([
      zora.AsksFP.address,
      zora.AsksFP1155.address,
      zora.ReserveAuctionBuyNowERC20.address,
      zora.ReserveAuctionBuyNowERC20ERC1155.address,
    ], true)

    await zora.ZoraModuleManager.connect(addr2).setBatchApprovalForModules([
      zora.AsksFP.address,
      zora.AsksFP1155.address,
      zora.ReserveAuctionBuyNowERC20.address,
      zora.ReserveAuctionBuyNowERC20ERC1155.address,
    ], true)

    await zora.FloorPrice.setFloorPrice(tokens.ERC1155.address, tokens.ERC20.address, ethers.utils.parseEther("10"))
    await zora.FloorPrice.setFloorPrice(tokens.ERC1155.address, ethers.constants.AddressZero, ethers.utils.parseEther("1"))
  })
  it("Should show registered modules", async () => {
    expect(
      await zora.ZoraModuleManager.moduleRegistered(zora.ReserveAuctionBuyNowERC20ERC1155.address)
    ).to.be.true
    expect(
      await zora.ZoraModuleManager.moduleRegistered(zora.AsksFP.address)
    )
  });

  it("Should allow setting royalties for 721", async () => {
    const amount = ethers.utils.parseEther("10");
    const amount2 = ethers.utils.parseEther("20");

    await zora.Royalties.setBeneficiary(royalty1.address, tokens.ERC721.address, 0, 5000)

    //Module approvals set in before each!!

    await tokens.ERC721.connect(addr1).mint();

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await zora.ReserveAuctionBuyNowERC20.connect(addr1).createAuction(
        tokens.ERC721.address,
        0,
        60 * 60,
        amount,
        amount.mul(3),
        addr1.address,
        latestBlock.timestamp + 1,
        ethers.constants.AddressZero
    );

    const seller = addr1.address;

    await zora.ReserveAuctionBuyNowERC20.connect(addr2).createBid(
      tokens.ERC721.address,
      0,
      amount2,
      {
        value: amount2
      }
    )

    const preSettle = await ethers.provider.getBalance(addr1.address)
    let auction = await zora.ReserveAuctionBuyNowERC20.auctionForNFT(tokens.ERC721.address, 0)
    expect(
      auction.highestBidder
    ).to.be.equal(addr2.address)

    const royaltyBeneficiaryPreSettle = await ethers.provider.getBalance(royalty1.address);

    const tx = await zora.ReserveAuctionBuyNowERC20.connect(owner).buyNowAuction(
      tokens.ERC721.address,
      0,
      amount.mul(3),
      {
        value: amount.mul(3)
      }
    )

    const receipt = await tx.wait()

    expect(
      await tokens.ERC721.ownerOf(0)
    ).to.be.equal(owner.address)

    ///expect(
    ///  receipt.events![3].args!.auction.highestBidder
    ///).to.be.equal(owner.address)

    expect(
      await ethers.provider.getBalance(royalty1.address)
    ).to.be.equal(royaltyBeneficiaryPreSettle.add(amount.mul(3).div(2)))
  });

  it("Should allow put up and settle asks", async () => {
    const amount = ethers.utils.parseEther("10");

    await zora.Royalties.setBeneficiary(royalty1.address, tokens.ERC721.address, 0, 1000)
    await zora.Royalties.setBeneficiary(royalty2.address, tokens.ERC721.address, 0, 500)

    console.log(
      royalty2.address, " has ", await ethers.provider.getBalance(royalty2.address)
    )

    //Module approvals set in before each!!

    await tokens.ERC721.connect(addr1).mint();

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await zora.AsksFP.connect(addr1).createAsk(
      tokens.ERC721.address,
      0,
      amount,
      tokens.ERC20.address,
      addr1.address,
      0
    )

    // console.log(await zora.AsksFP.askForNFT(tokens.ERC721.address, 0))

    const preFill = await tokens.ERC20.balanceOf(addr1.address)

    await tokens.ERC20.approve(zora.ERC20TransferHelper.address, amount);
    await zora.AsksFP.fillAsk(tokens.ERC721.address, 0, tokens.ERC20.address, amount, ethers.constants.AddressZero)

    expect(
      await tokens.ERC721.ownerOf(0)
    ).to.be.equal(owner.address)

    expect(
      (await tokens.ERC20.balanceOf(addr1.address)).sub(preFill)
    ).to.be.equal(amount.mul(85).div(100))

    console.log(
      royalty1.address, "=>", await tokens.ERC20.balanceOf(royalty1.address)
    )

    console.log(
      royalty2.address, "=>", await tokens.ERC20.balanceOf(royalty2.address)
    )

  })

  it("Should allow setting royalty for all tokens in collection", async () => {
    const amount = ethers.utils.parseEther("10");

    await zora.Royalties.setBeneficiary(royalty1.address, tokens.ERC721.address, ethers.constants.MaxUint256, 1000)
    await zora.Royalties.setBeneficiary(royalty2.address, tokens.ERC721.address, ethers.constants.MaxUint256, 500)

    console.log(
      royalty2.address, " has ", await ethers.provider.getBalance(royalty2.address)
    )

    //Module approvals set in before each!!

    await tokens.ERC721.connect(addr1).mint();

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await zora.AsksFP.connect(addr1).createAsk(
      tokens.ERC721.address,
      0,
      amount,
      tokens.ERC20.address,
      addr1.address,
      0
    )

    // console.log(await zora.AsksFP.askForNFT(tokens.ERC721.address, 0))

    let preFill = await tokens.ERC20.balanceOf(addr1.address)

    await tokens.ERC20.approve(zora.ERC20TransferHelper.address, amount);
    await zora.AsksFP.fillAsk(tokens.ERC721.address, 0, tokens.ERC20.address, amount, ethers.constants.AddressZero)

    await tokens.ERC721.connect(addr1).mint();

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)
    latestBlock = await ethers.provider.getBlock("latest")  

    await zora.AsksFP.connect(addr1).createAsk(
      tokens.ERC721.address,
      1,
      amount,
      tokens.ERC20.address,
      addr1.address,
      0
    )

    // console.log(await zora.AsksFP.askForNFT(tokens.ERC721.address, 0))

    preFill = await tokens.ERC20.balanceOf(addr1.address)

    await tokens.ERC20.approve(zora.ERC20TransferHelper.address, amount);
    await zora.AsksFP.fillAsk(tokens.ERC721.address, 1, tokens.ERC20.address, amount, ethers.constants.AddressZero)


    console.log(
      royalty1.address, "=>", await tokens.ERC20.balanceOf(royalty1.address)
    )

    console.log(
      royalty2.address, "=>", await tokens.ERC20.balanceOf(royalty2.address)
    )

    await zora.Royalties.setBeneficiary(royalty1.address, tokens.ERC721.address, ethers.constants.MaxUint256, 0)
    const x = await zora.Royalties.getRoyalty(tokens.ERC721.address, ethers.constants.MaxUint256, amount)
    expect(
      x[0].length
    ).to.be.equal(1)

  })
});
