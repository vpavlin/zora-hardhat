import { expect } from "chai";
import { ethers } from "hardhat";

import { deployTokens, Tokens } from "../scripts/deployTokens"
import { deployZora, Contracts } from "../scripts/deploy"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("1155", function () {
  let tokens:Tokens;
  let zora:Contracts;

  let addr1:SignerWithAddress;
  let addr2:SignerWithAddress;
  let owner:SignerWithAddress;
  let addrs:SignerWithAddress[]
  beforeEach(async () => {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners()
    tokens = await deployTokens()
    zora = await deployZora()

    await zora.ZoraModuleManager.setBatchApprovalForModules(
      [
        zora.AsksFP1155.address,
        zora.ReserveAuctionBuyNowERC20ERC1155.address,
      ], true)
    await zora.ZoraModuleManager.connect(addr1).setBatchApprovalForModules([
      zora.AsksFP1155.address,
      zora.ReserveAuctionBuyNowERC20ERC1155.address,
    ], true)

    await zora.ZoraModuleManager.connect(addr2).setBatchApprovalForModules([
      zora.AsksFP1155.address,
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

  it("Should fail to bid if the seller no longer has the tokens", async () => {
    const amount = ethers.utils.parseEther("10");
    const amount2 = ethers.utils.parseEther("20");

    //Module approvals set in before each!!

    await tokens.ERC1155.connect(addr1).mint();

    await tokens.ERC1155.connect(addr1).setApprovalForAll(zora.ERC1155TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await zora.ReserveAuctionBuyNowERC20ERC1155.connect(addr1).createAuction(
        tokens.ERC1155.address,
        0,
        5,
        60 * 60,
        amount,
        amount.mul(3),
        addr1.address,
        latestBlock.timestamp + 1,
        ethers.constants.AddressZero
    );

    const seller = addr1.address;

    await tokens.ERC1155.connect(addr1).safeTransferFrom(addr1.address, addr2.address, 0, 6, [])

    await expect(
      zora.ReserveAuctionBuyNowERC20ERC1155.connect(addr1).createBid(
      tokens.ERC1155.address,
      0,
      1,
      amount,
      {
        value: amount.sub(1000)
      }
    )).to.be.revertedWith("ERC1155: insufficient balance for transfer")
  });

  it("Should allow posting and buying now the auction", async () => {
    const amount = ethers.utils.parseEther("10");
    const amount2 = ethers.utils.parseEther("20");

    //Module approvals set in before each!!

    await tokens.ERC1155.connect(addr1).mint();

    await tokens.ERC1155.connect(addr1).setApprovalForAll(zora.ERC1155TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await expect(
      zora.ReserveAuctionBuyNowERC20ERC1155.connect(addr1).createAuction(
          tokens.ERC1155.address,
          0,
          5,
          60 * 60,
          ethers.utils.parseEther("0.5"),
          amount.mul(3),
          addr1.address,
          latestBlock.timestamp + 1,
          ethers.constants.AddressZero
      )
    ).to.be.revertedWith("PRICE_TOO_LOW")

    await expect(
      zora.ReserveAuctionBuyNowERC20ERC1155.connect(addr1).createAuction(
          tokens.ERC1155.address,
          0,
          12,
          60 * 60,
          amount,
          amount.mul(3),
          addr1.address,
          latestBlock.timestamp + 1,
          ethers.constants.AddressZero
      )
    ).to.be.revertedWith("NOT_ENOUGH_TOKENS")

    const seller = addr1.address;

    await zora.ReserveAuctionBuyNowERC20ERC1155.connect(addr1).createAuction(
        tokens.ERC1155.address,
        0,
        5,
        60 * 60,
        amount,
        amount.mul(3),
        addr1.address,
        latestBlock.timestamp + 1,
        ethers.constants.AddressZero
    );

    await zora.ReserveAuctionBuyNowERC20ERC1155.connect(addr1).createAuction(
        tokens.ERC1155.address,
        0,
        4,
        60 * 60,
        amount,
        amount.mul(3),
        addr1.address,
        latestBlock.timestamp + 1,
        ethers.constants.AddressZero
    );

    expect(
      (await zora.ReserveAuctionBuyNowERC20ERC1155.getAuctionsPerUser(tokens.ERC1155.address, 0, addr1.address)).length
    ).to.be.eq(2)

    // console.log(await zora.ReserveAuctionBuyNowERC20ERC1155.auctionsForNFT(
    //   tokens.ERC1155.address,
    //   0,
    //   1
    //   )
    // )

    await zora.ReserveAuctionBuyNowERC20ERC1155.connect(addr2).createBid(
      tokens.ERC1155.address,
      0,
      1,
      amount2,
      {
        value: amount2
      }
    )

    await expect(
      zora.ReserveAuctionBuyNowERC20ERC1155.connect(addr1).createBid(
      tokens.ERC1155.address,
      0,
      1,
      amount2,
      {
        value: amount.sub(1000)
      }
    )).to.be.revertedWith("MINIMUM_BID_NOT_MET")

    const preSettle = await ethers.provider.getBalance(addr1.address)
    let auction = await zora.ReserveAuctionBuyNowERC20ERC1155.auctionsForNFT(tokens.ERC1155.address, 0, 1)
    expect(
      auction.highestBidder
    ).to.be.equal(addr2.address)

    const tx = await zora.ReserveAuctionBuyNowERC20ERC1155.connect(owner).buyNowAuction(
      tokens.ERC1155.address,
      0,
      1,
      amount.mul(3),
      {
        value: amount.mul(3)
      }
    )

    const receipt = await tx.wait()

    expect(
      await tokens.ERC1155.balanceOf(owner.address, 0)
    ).to.be.equal(auction.amount)

    //receipt.events!.map((args:any, i:number) => {console.log(i, " :", args)})
    expect(
      receipt.events![2].args!.auction.highestBidder
    ).to.be.equal(owner.address)
  })

  it("Should allow posting ask and filling it", async () => {
    const amount = ethers.utils.parseEther("10");

    //Module approvals set in before each!!

    await tokens.ERC1155.connect(addr1).mint();

    await tokens.ERC1155.connect(addr1).setApprovalForAll(zora.ERC1155TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await expect(
      zora.AsksFP1155.connect(addr1).createAsk(
          tokens.ERC1155.address,
          0,
          5,
          ethers.utils.parseEther("0.5"),
          ethers.constants.AddressZero,
          addr1.address,
          0
      )
    ).to.be.revertedWith("PRICE_TOO_LOW")

    await zora.AsksFP1155.connect(addr1).createAsk(
      tokens.ERC1155.address,
      0,
      5,
      amount,
      tokens.ERC20.address,
      addr1.address,
      0
    )

    await zora.AsksFP1155.connect(addr1).createAsk(
      tokens.ERC1155.address,
      0,
      4,
      amount,
      tokens.ERC20.address,
      addr1.address,
      0
    )

    await zora.AsksFP1155.connect(addr1).createAsk(
      tokens.ERC1155.address,
      0,
      1,
      amount,
      tokens.ERC20.address,
      addr1.address,
      0
    )

    await expect(
      zora.AsksFP1155.connect(addr1).createAsk(
          tokens.ERC1155.address,
          0,
          1,
          ethers.utils.parseEther("10"),
          ethers.constants.AddressZero,
          addr1.address,
          0
      )
    ).to.be.revertedWith("NOT_ENOUGH_TOKENS")

    // console.log(await zora.AsksFP1155.askForNFT(tokens.ERC1155.address, 0, 1))
    // console.log(await zora.AsksFP1155.askForNFT(tokens.ERC1155.address, 0, 2))


    await tokens.ERC20.approve(zora.ERC20TransferHelper.address, amount);
    await zora.AsksFP1155.fillAsk(tokens.ERC1155.address, 0, 1, tokens.ERC20.address, amount, ethers.constants.AddressZero)

    expect(
      await tokens.ERC1155.balanceOf(owner.address, 0)
    ).to.be.equal(5)

    expect(
      await tokens.ERC20.balanceOf(addr1.address)
    ).to.be.equal(amount)

    await zora.AsksFP1155.connect(addr1).cancelAsk(tokens.ERC1155.address, 0, 3); 

    await zora.AsksFP1155.connect(addr1).createAsk(
      tokens.ERC1155.address,
      0,
      1,
      amount,
      tokens.ERC20.address,
      addr1.address,
      0
    )
  })

});
