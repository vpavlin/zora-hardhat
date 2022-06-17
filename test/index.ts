import { expect } from "chai";
import { ethers } from "hardhat";

import { deployTokens, Tokens } from "../scripts/deployTokens"
import { deployZora, Contracts } from "../scripts/deploy"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Zora", function () {
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
        zora.OffersV1.address,
        zora.AsksFP.address,
        zora.ReserveAuctionBuyNowERC20.address,
      ], true)
    await zora.ZoraModuleManager.connect(addr1).setBatchApprovalForModules([
      zora.OffersV1.address,
      zora.AsksFP.address,
      zora.ReserveAuctionBuyNowERC20.address,
    ], true)

    await zora.ZoraModuleManager.connect(addr2).setBatchApprovalForModules([
      zora.OffersV1.address,
      zora.AsksFP.address,
      zora.ReserveAuctionBuyNowERC20.address,
    ], true)

    await zora.FloorPrice.setFloorPrice(tokens.ERC721.address, tokens.ERC20.address, ethers.utils.parseEther("10"))
    await zora.FloorPrice.setFloorPrice(tokens.ERC721.address, ethers.constants.AddressZero, ethers.utils.parseEther("1"))
  })
  it("Should show registered modules", async () => {
    expect(
      await zora.ZoraModuleManager.moduleRegistered(zora.OffersV1.address)
    ).to.be.true
    expect(
      await zora.ZoraModuleManager.moduleRegistered(zora.AsksFP.address)
    )
  });
  it("Should allow posting offer for an NFT and filling it", async () => {
    const amount = ethers.utils.parseEther("10");

    //Module approvals set in before each!!

    await tokens.ERC20.approve(zora.ERC20TransferHelper.address, amount)
    await tokens.ERC721.connect(addr1).mint();
    await zora.OffersV1.createOffer(
        tokens.ERC721.address,
        0,
        tokens.ERC20.address,
        amount,
        0
    );
    console.log(await zora.OffersV1.offerCount())
    console.log(await zora.OffersV1.offers(tokens.ERC721.address, 0, 1))

    await tokens.ERC721.connect(addr1).approve(zora.ERC721TransferHelper.address, 0)

    await zora.OffersV1.connect(addr1).fillOffer(
      tokens.ERC721.address,
      0,
      1,
      tokens.ERC20.address,
      amount,
      ethers.constants.AddressZero
    )

    expect(
      await tokens.ERC721.ownerOf(0)
    ).to.be.equal(owner.address)

    expect(
      await tokens.ERC20.balanceOf(addr1.address)
    ).to.be.equal(amount)
  })

  it("Should allow posting and bidding in auction", async () => {
    const amount = ethers.utils.parseEther("10");
    const amount2 = ethers.utils.parseEther("20");


    //Module approvals set in before each!!


    await tokens.ERC721.connect(addr1).mint();

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await expect(
      zora.ReserveAuctionBuyNowERC20.connect(addr1).createAuction(
          tokens.ERC721.address,
          0,
          60 * 60,
          ethers.utils.parseEther("5"),
          0,
          addr1.address,
          latestBlock.timestamp + 1,
          tokens.ERC20.address,
      )
    ).to.be.revertedWith("PRICE_TOO_LOW")

    await zora.ReserveAuctionBuyNowERC20.connect(addr1).createAuction(
        tokens.ERC721.address,
        0,
        60 * 60,
        amount,
        0,
        addr1.address,
        latestBlock.timestamp + 1,
        tokens.ERC20.address,
    );
    console.log(await zora.ReserveAuctionBuyNowERC20.auctionForNFT(tokens.ERC721.address, 0))


    await tokens.ERC20.approve(zora.ERC20TransferHelper.address, amount)
    await zora.ReserveAuctionBuyNowERC20.createBid(
        tokens.ERC721.address,
        0,
        amount
    )

    let auction = await zora.ReserveAuctionBuyNowERC20.auctionForNFT(tokens.ERC721.address, 0)
    expect(
      auction.highestBidder
    ).to.be.equal(owner.address)

    await tokens.ERC20.transfer(addr2.address, amount2);
    await tokens.ERC20.connect(addr2).approve(zora.ERC20TransferHelper.address, amount2)

    await expect(
      zora.ReserveAuctionBuyNowERC20.buyNowAuction(
        tokens.ERC721.address,
        0,
        0
        )
    ).to.be.revertedWith("BUY_NOW_NOT_ACTIVE")

    await expect(
      zora.ReserveAuctionBuyNowERC20.buyNowAuction(
        tokens.ERC721.address,
        0,
        amount
        )
    ).to.be.revertedWith("BUY_NOW_NOT_ACTIVE")

    await zora.ReserveAuctionBuyNowERC20.connect(addr2).createBid(
      tokens.ERC721.address,
      0,
      amount2
    )

    auction = await zora.ReserveAuctionBuyNowERC20.auctionForNFT(tokens.ERC721.address, 0)
    expect(
      auction.highestBidder
    ).to.be.equal(addr2.address)

    await ethers.provider.send('evm_setNextBlockTimestamp', [latestBlock.timestamp + 60 *60 + 10]);
    await ethers.provider.send('evm_mine', []);

    await zora.ReserveAuctionBuyNowERC20.settleAuction(tokens.ERC721.address, 0)

    expect(
      await tokens.ERC721.ownerOf(0)
    ).to.be.equal(addr2.address)

    expect(
      await tokens.ERC20.balanceOf(addr1.address)
    ).to.be.equal(amount2)

  })

  it("Should allow posting and bidding in auction from 0", async () => {
    const amount = ethers.utils.parseEther("0.0001");
    const amount2 = ethers.utils.parseEther("20");

    //Module approvals set in before each!!

    await zora.FloorPrice.setFloorPrice(tokens.ERC721.address, tokens.ERC20.address, 0)


    await tokens.ERC721.connect(addr1).mint();

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")

    await zora.ReserveAuctionBuyNowERC20.connect(addr1).createAuction(
        tokens.ERC721.address,
        0,
        60 * 60,
        0,
        0,
        addr1.address,
        latestBlock.timestamp + 1,
        tokens.ERC20.address,
    );
    console.log(await zora.ReserveAuctionBuyNowERC20.auctionForNFT(tokens.ERC721.address, 0))

    console.log("Has balance: ", await tokens.ERC721.balanceOf(zora.ReserveAuctionBuyNowERC20.address))
    console.log("Is owner: ", await tokens.ERC721.ownerOf(0))

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, false)


    await expect(
      zora.ReserveAuctionBuyNowERC20.buyNowAuction(
        tokens.ERC721.address,
        0,
        0
        )
    ).to.be.revertedWith("BUY_NOW_NOT_ACTIVE")


    await expect(
      zora.ReserveAuctionBuyNowERC20.createBid(
        tokens.ERC721.address,
        0,
        amount
      )
    ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved")

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)

    await tokens.ERC20.approve(zora.ERC20TransferHelper.address, amount)
    await zora.ReserveAuctionBuyNowERC20.createBid(
        tokens.ERC721.address,
        0,
        amount
    )

    let auction = await zora.ReserveAuctionBuyNowERC20.auctionForNFT(tokens.ERC721.address, 0)
    expect(
      auction.highestBidder
    ).to.be.equal(owner.address)

    await tokens.ERC20.transfer(addr2.address, amount2);
    await tokens.ERC20.connect(addr2).approve(zora.ERC20TransferHelper.address, amount2)

    await expect(
      zora.ReserveAuctionBuyNowERC20.buyNowAuction(
        tokens.ERC721.address,
        0,
        amount
        )
    ).to.be.revertedWith("BUY_NOW_NOT_ACTIVE")

    await zora.ReserveAuctionBuyNowERC20.connect(addr2).createBid(
      tokens.ERC721.address,
      0,
      amount2
    )

    auction = await zora.ReserveAuctionBuyNowERC20.auctionForNFT(tokens.ERC721.address, 0)
    expect(
      auction.highestBidder
    ).to.be.equal(addr2.address)

    await ethers.provider.send('evm_setNextBlockTimestamp', [latestBlock.timestamp + 60 *60 + 10]);
    await ethers.provider.send('evm_mine', []);

    await zora.ReserveAuctionBuyNowERC20.settleAuction(tokens.ERC721.address, 0)

    expect(
      await tokens.ERC721.ownerOf(0)
    ).to.be.equal(addr2.address)

    expect(
      await tokens.ERC20.balanceOf(addr1.address)
    ).to.be.equal(amount2)

  })

  it("Should allow posting and buying now the auction", async () => {
    const amount = ethers.utils.parseEther("10");
    const amount2 = ethers.utils.parseEther("20");

    //Module approvals set in before each!!

    await tokens.ERC721.connect(addr1).mint();

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await expect(
      zora.ReserveAuctionBuyNowERC20.connect(addr1).createAuction(
          tokens.ERC721.address,
          0,
          60 * 60,
          ethers.utils.parseEther("0.5"),
          amount.mul(3),
          addr1.address,
          latestBlock.timestamp + 1,
          ethers.constants.AddressZero
      )
    ).to.be.revertedWith("PRICE_TOO_LOW")

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

    expect(
      receipt.events![3].args!.auction.highestBidder
    ).to.be.equal(owner.address)
  })

  it("Should allow put up and settle asks", async () => {
    const amount = ethers.utils.parseEther("10");

    //Module approvals set in before each!!

    await tokens.ERC721.connect(addr1).mint();

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await expect(
      zora.AsksFP.connect(addr1).createAsk(
          tokens.ERC721.address,
          0,
          ethers.utils.parseEther("0.5"),
          ethers.constants.AddressZero,
          addr1.address,
          0
      )
    ).to.be.revertedWith("PRICE_TOO_LOW")

    await zora.AsksFP.connect(addr1).createAsk(
      tokens.ERC721.address,
      0,
      amount,
      tokens.ERC20.address,
      addr1.address,
      0
    )

    console.log(await zora.AsksFP.askForNFT(tokens.ERC721.address, 0))

    await tokens.ERC20.approve(zora.ERC20TransferHelper.address, amount);
    await zora.AsksFP.fillAsk(tokens.ERC721.address, 0, tokens.ERC20.address, amount, ethers.constants.AddressZero)

    expect(
      await tokens.ERC721.ownerOf(0)
    ).to.be.equal(owner.address)

    expect(
      await tokens.ERC20.balanceOf(addr1.address)
    ).to.be.equal(amount)

  })

  it("Should take platform fees", async () => {
    const amount = ethers.utils.parseEther("10");

    await zora.ZoraProtocolFeeSettings.setFeeParams(zora.AsksFP.address, addr2.address, 5000);

    //Module approvals set in before each!!

    await tokens.ERC721.connect(addr1).mint();

    await tokens.ERC721.connect(addr1).setApprovalForAll(zora.ERC721TransferHelper.address, true)
    let latestBlock = await ethers.provider.getBlock("latest")  

    await expect(
      zora.AsksFP.connect(addr1).createAsk(
          tokens.ERC721.address,
          0,
          ethers.utils.parseEther("0.5"),
          ethers.constants.AddressZero,
          addr1.address,
          0
      )
    ).to.be.revertedWith("PRICE_TOO_LOW")

    await zora.AsksFP.connect(addr1).createAsk(
      tokens.ERC721.address,
      0,
      amount,
      tokens.ERC20.address,
      addr1.address,
      0
    )

    console.log(await zora.AsksFP.askForNFT(tokens.ERC721.address, 0))

    await tokens.ERC20.approve(zora.ERC20TransferHelper.address, amount);
    await zora.AsksFP.fillAsk(tokens.ERC721.address, 0, tokens.ERC20.address, amount, ethers.constants.AddressZero)

    expect(
      await tokens.ERC721.ownerOf(0)
    ).to.be.equal(owner.address)

    expect(
      await tokens.ERC20.balanceOf(addr2.address)
    ).to.be.equal(amount.div(2))

  })
});
