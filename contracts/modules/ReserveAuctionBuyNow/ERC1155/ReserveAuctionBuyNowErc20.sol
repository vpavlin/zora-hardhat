// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import {ReentrancyGuard} from "@rari-capital/solmate/src/utils/ReentrancyGuard.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import {IncomingTransferSupportV1} from "../../../contracts/common/IncomingTransferSupport/V1/IncomingTransferSupportV1.sol";
import {ERC1155TransferHelper} from "../../../contracts/transferHelpers/ERC1155TransferHelper.sol";
import {FeePayoutSupportV1} from "../../../contracts/common/FeePayoutSupport/FeePayoutSupportV1.sol";
import {ModuleNamingSupportV1} from "../../../contracts/common/ModuleNamingSupport/ModuleNamingSupportV1.sol";
import {IReserveAuctionBuyNowErc20Erc1155} from "./IReserveAuctionBuyNowErc20.sol";
import {FloorPrice} from "../../../common/FloorPrice/FloorPrice.sol";


/// @title Reserve Auction Core ERC-20
/// @author kulkarohan
/// @notice Module for minimal ERC-20 timed reserve auctions for ERC-1155 tokens
contract ReserveAuctionBuyNowErc20Erc1155 is IReserveAuctionBuyNowErc20Erc1155, IERC1155Receiver, ReentrancyGuard, IncomingTransferSupportV1, FeePayoutSupportV1, ModuleNamingSupportV1 {
    /// @notice The minimum amount of time left in an auction after a new bid is created
    uint16 timeBuffer = 15 minutes;

    /// @notice The minimum percentage difference between two bids
    uint8 minBidIncrementPercentage = 10;

    /// @notice The ZORA ERC-1155 Transfer Helper
    ERC1155TransferHelper public immutable erc1155TransferHelper;

    FloorPrice public immutable floorPrice;

    /// @notice The ask for a given NFT, if one exists
    /// @dev ERC-1155 token contract => ERC-1155 token ID => Auction Id => Auction
    mapping(address => mapping(uint256 => mapping(uint256 => Auction))) public auctionsForNFT;

    /// @dev ERC-1155 token contract => ERC-1155 token ID => Seller Address => List of Auction ID
    mapping(address => mapping(uint256 => mapping(address => uint256[]))) public auctionsPerUser;

    uint256 public auctionsCount;


    /// @notice The metadata for a given auction
    /// @param seller The address of the seller
    /// @param reservePrice The reserve price to start the auction
    /// @param sellerFundsRecipient The address where funds are sent after the auction
    /// @param highestBid The highest bid of the auction
    /// @param highestBidder The address of the highest bidder
    /// @param duration The length of time that the auction runs after the first bid is placed
    /// @param startTime The time that the first bid can be placed
    /// @param currency The address of the ERC-20 token, or address(0) for ETH, required to place a bid
    /// @param firstBidTime The time that the first bid is placed
    struct Auction {
        address seller;
        uint96 reservePrice;
        uint96 amount;
        uint160 buyNowPrice;
        address sellerFundsRecipient;
        uint96 highestBid;
        address highestBidder;
        uint48 duration;
        uint48 startTime;
        address currency;
        uint96 firstBidTime;
    }

    /// @notice Emitted when an auction is created
    /// @param tokenContract The ERC-1155 token address of the created auction
    /// @param tokenId The ERC-1155 token id of the created auction
    /// @param auction The metadata of the created auction
    event AuctionCreated(address indexed tokenContract, uint256 indexed tokenId, Auction auction);

    /// @notice Emitted when a reserve price is updated
    /// @param tokenContract The ERC-1155 token address of the updated auction
    /// @param tokenId The ERC-1155 token id of the updated auction
    /// @param auction The metadata of the updated auction
    event AuctionReservePriceUpdated(address indexed tokenContract, uint256 indexed tokenId, Auction auction);

    /// @notice Emitted when a boy now price is updated
    /// @param tokenContract The ERC-1155 token address of the updated auction
    /// @param tokenId The ERC-1155 token id of the updated auction
    /// @param auction The metadata of the updated auction
    event AuctionBuyNowPriceUpdated(address indexed tokenContract, uint256 indexed tokenId, Auction auction);

    /// @notice Emitted when an auction is canceled
    /// @param tokenContract The ERC-1155 token address of the canceled auction
    /// @param tokenId The ERC-1155 token id of the canceled auction
    /// @param auction The metadata of the canceled auction
    event AuctionCanceled(address indexed tokenContract, uint256 indexed tokenId, Auction auction);

    /// @notice Emitted when a bid is placed
    /// @param tokenContract The ERC-1155 token address of the auction
    /// @param tokenId The ERC-1155 token id of the auction
    /// @param firstBid If the bid started the auction
    /// @param extended If the bid extended the auction
    /// @param auction The metadata of the auction
    event AuctionBid(address indexed tokenContract, uint256 indexed tokenId, bool firstBid, bool extended, Auction auction);

    /// @notice Emitted when an auction has ended
    /// @param tokenContract The ERC-1155 token address of the auction
    /// @param tokenId The ERC-1155 token id of the auction
    /// @param auction The metadata of the settled auction
    event AuctionEnded(address indexed tokenContract, uint256 indexed tokenId, Auction auction);

    /// @param _erc20TransferHelper The ZORA ERC-20 Transfer Helper address
    /// @param _erc1155TransferHelper The ZORA ERC-1155 Transfer Helper address
    /// @param _royaltyEngine The Manifold Royalty Engine address
    /// @param _protocolFeeSettings The ZORA Protocol Fee Settings address
    /// @param _weth The WETH token address
    constructor(
        address _erc20TransferHelper,
        address _erc1155TransferHelper,
        address _royaltyEngine,
        address _protocolFeeSettings,
        address _weth,
        address _floorPrice
    )
        IncomingTransferSupportV1(_erc20TransferHelper)
        FeePayoutSupportV1(_royaltyEngine, _protocolFeeSettings, _weth, ERC1155TransferHelper(_erc1155TransferHelper).ZMM().registrar())
        ModuleNamingSupportV1("Reserve Auction Core ERC-20 ERC1155")
    {
        erc1155TransferHelper = ERC1155TransferHelper(_erc1155TransferHelper);
        floorPrice = FloorPrice(_floorPrice);
    }

    /// @notice Implements EIP-165 for standard interface detection
    /// @dev `0x01ffc9a7` is the IERC165 interface id
    /// @param _interfaceId The identifier of a given interface
    /// @return If the given interface is supported
    function supportsInterface(bytes4 _interfaceId) external pure returns (bool) {
        return _interfaceId == type(IReserveAuctionBuyNowErc20Erc1155).interfaceId 
                || _interfaceId == 0x01ffc9a7
                || _interfaceId == type(IERC1155Receiver).interfaceId;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4) {
        return 0xf23a6e61;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4) {
        return 0xbc197c81;
    }

    //     ,-.
    //     `-'
    //     /|\
    //      |             ,-----------------------.
    //     / \            |ReserveAuctionCoreErc20|
    //   Caller           `-----------+-----------'
    //     |     createAuction()      |
    //     | ------------------------>|
    //     |                          |
    //     |                          ----.
    //     |                              | store auction metadata
    //     |                          <---'
    //     |                          |
    //     |                          ----.
    //     |                              | emit AuctionCreated()
    //     |                          <---'
    //   Caller           ,-----------+-----------.
    //     ,-.            |ReserveAuctionCoreErc20|
    //     `-'            `-----------------------'
    //     /|\
    //      |
    //     / \
    /// @notice Creates an auction for a given NFT
    /// @param _tokenContract The address of the ERC-1155 token
    /// @param _tokenId The id of the ERC-1155 token
    /// @param _duration The length of time the auction should run after the first bid
    /// @param _reservePrice The minimum bid amount to start the auction
    /// @param _sellerFundsRecipient The address to send funds to once the auction is complete
    /// @param _startTime The time that users can begin placing bids
    /// @param _bidCurrency The address of the ERC-20 token, or address(0) for ETH, that users must bid with
    function createAuction(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _amount,
        uint256 _duration,
        uint256 _reservePrice,
        uint256 _buyNowPrice,
        address _sellerFundsRecipient,
        uint256 _startTime,
        address _bidCurrency
    ) external nonReentrant {
        // Get balance of sender
        uint256 balance = IERC1155(_tokenContract).balanceOf(msg.sender, _tokenId);

        uint256 spokenForAmount = amountInAuctions(_tokenContract, _tokenId, msg.sender);
        // Ensure the caller has enough tokens
        require(balance - spokenForAmount >= _amount, "NOT_ENOUGH_TOKENS");

        // Ensure the reserve price can be downcasted to 96 bits for this module
        // For a higher reserve price, use the supporting module
        require(_reservePrice <= type(uint96).max, "INVALID_RESERVE_PRICE");

        // Ensure the funds recipient is specified
        require(_sellerFundsRecipient != address(0), "INVALID_FUNDS_RECIPIENT");

        // Ensure the buy now price is higher than reserve price
        require(_buyNowPrice == 0 || _buyNowPrice > _reservePrice, "BUY_NOW_TOO_LOW");

        require(floorPrice.priceAboveFloor(_tokenContract, _bidCurrency, _reservePrice / _amount), "PRICE_TOO_LOW");

        ++auctionsCount;

        Auction memory auction = Auction({
            seller: msg.sender,
            reservePrice: uint96(_reservePrice),
            amount: uint96(_amount),
            buyNowPrice: uint160(_buyNowPrice),
            sellerFundsRecipient: _sellerFundsRecipient,
            duration: uint48(_duration),
            startTime: uint48(_startTime),
            currency: _bidCurrency,
            firstBidTime: 0,
            highestBid: 0,
            highestBidder: address(0)
        });

        auctionsForNFT[_tokenContract][_tokenId][auctionsCount] = auction;
        auctionsPerUser[_tokenContract][_tokenId][msg.sender].push(auctionsCount);


        emit AuctionCreated(_tokenContract, _tokenId, auction);
    }

    //     ,-.
    //     `-'
    //     /|\
    //      |             ,-----------------------.
    //     / \            |ReserveAuctionCoreErc20|
    //   Caller           `-----------+-----------'
    //     | setAuctionReservePrice() |
    //     | ------------------------>|
    //     |                          |
    //     |                          ----.
    //     |                              | update reserve price
    //     |                          <---'
    //     |                          |
    //     |                          ----.
    //     |                              | emit AuctionReservePriceUpdated()
    //     |                          <---'
    //   Caller           ,-----------+-----------.
    //     ,-.            |ReserveAuctionCoreErc20|
    //     `-'            `-----------------------'
    //     /|\
    //      |
    //     / \
    /// @notice Updates the reserve price for a given auction
    /// @param _tokenContract The address of the ERC-1155 token
    /// @param _tokenId The id of the ERC-1155 token
    /// @param _reservePrice The new reserve price
    function setAuctionReservePrice(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _auctionId,
        uint256 _reservePrice
    ) external nonReentrant {
        // Get the auction for the specified token
        Auction storage auction = auctionsForNFT[_tokenContract][_tokenId][_auctionId];

        // Ensure the auction has not started
        require(auction.firstBidTime == 0, "AUCTION_STARTED");

        // Ensure the caller is the seller
        require(msg.sender == auction.seller, "ONLY_SELLER");

        // Ensure the reserve price can be downcasted to 96 bits
        require(_reservePrice <= type(uint96).max, "INVALID_RESERVE_PRICE");

        // Update the reserve price
        auction.reservePrice = uint96(_reservePrice);

        emit AuctionReservePriceUpdated(_tokenContract, _tokenId, auction);
    }

    /// @notice Updates the auction reserve price for a given NFT
    /// @param _tokenContract The address of the ERC-1155 token
    /// @param _tokenId The id of the ERC-1155 token
    /// @param _buyNowPrice The new reserve price
    function setAuctionBuyNowPrice(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _auctionId,
        uint256 _buyNowPrice
    ) external nonReentrant {
        // Get the auction for the specified token
        Auction storage auction = auctionsForNFT[_tokenContract][_tokenId][_auctionId];

        // Ensure the auction has not started
        require(auction.firstBidTime == 0, "AUCTION_STARTED");

        // Ensure the caller is the seller
        require(msg.sender == auction.seller, "ONLY_SELLER");

        // Update the reserve price
        auction.buyNowPrice = uint96(_buyNowPrice);

        emit AuctionBuyNowPriceUpdated(_tokenContract, _tokenId, auction);
    }

    //     ,-.
    //     `-'
    //     /|\
    //      |             ,-----------------------.
    //     / \            |ReserveAuctionCoreErc20|
    //   Caller           `-----------+-----------'
    //     |     cancelAuction()      |
    //     | ------------------------>|
    //     |                          |
    //     |                          ----.
    //     |                              | emit AuctionCanceled()
    //     |                          <---'
    //     |                          |
    //     |                          ----.
    //     |                              | delete auction
    //     |                          <---'
    //   Caller           ,-----------+-----------.
    //     ,-.            |ReserveAuctionCoreErc20|
    //     `-'            `-----------------------'
    //     /|\
    //      |
    //     / \
    /// @notice Cancels the auction for a given NFT
    /// @param _tokenContract The address of the ERC-1155 token
    /// @param _tokenId The id of the ERC-1155 token
    function cancelAuction(address _tokenContract, uint256 _tokenId, uint256 _auctionId) public nonReentrant {
        // Get the auction for the specified token
        Auction memory auction = auctionsForNFT[_tokenContract][_tokenId][_auctionId];

        // Ensure the auction has not started
        require(auction.firstBidTime == 0, "AUCTION_STARTED");

        // Ensure the caller is the seller or a new owner of the token
        require(msg.sender == auction.seller, "ONLY_SELLER");

        _cancelAuction(_tokenContract, _tokenId, _auctionId);
    }

    //     ,-.
    //     `-'
    //     /|\
    //      |             ,-----------------------.          ,--------------------.                  ,-------------------.
    //     / \            |ReserveAuctionCoreErc20|          |ERC721TransferHelper|                  |ERC20TransferHelper|
    //   Caller           `-----------+-----------'          `---------+----------'                  `---------+---------'
    //     |       createBid()        |                                |                                       |
    //     | ------------------------>|                                |                                       |
    //     |                          |                                |                                       |
    //     |                          |                                |                                       |
    //     |    ___________________________________________________________________________________________________________________________________
    //     |    ! ALT  /  First bid?  |                                |                                       |                                   !
    //     |    !_____/               |                                |                                       |                                   !
    //     |    !                     ----.                            |                                       |                                   !
    //     |    !                         | start auction              |                                       |                                   !
    //     |    !                     <---'                            |                                       |                                   !
    //     |    !                     |                                |                                       |                                   !
    //     |    !                     |        transferFrom()          |                                       |                                   !
    //     |    !                     |------------------------------->|                                       |                                   !
    //     |    !                     |                                |                                       |                                   !
    //     |    !                     |                                |----.                                                                      !
    //     |    !                     |                                |    | transfer NFT from seller to escrow                                   !
    //     |    !                     |                                |<---'                                                                      !
    //     |    !~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~!
    //     |    ! [refund previous bidder]                             |                                       |                                   !
    //     |    !                     |                        handle outgoing refund                          |                                   !
    //     |    !                     |----------------------------------------------------------------------->|                                   !
    //     |    !                     |                                |                                       |                                   !
    //     |    !                     |                                |                                       |----.                              !
    //     |    !                     |                                |                                       |    | transfer tokens to bidder    !
    //     |    !                     |                                |                                       |<---'                              !
    //     |    !~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~!
    //     |                          |                                |                                       |
    //     |                          |                          handle incoming bid                           |
    //     |                          |----------------------------------------------------------------------->|
    //     |                          |                                |                                       |
    //     |                          |                                |                                       |----.
    //     |                          |                                |                                       |    | transfer tokens to escrow
    //     |                          |                                |                                       |<---'
    //     |                          |                                |                                       |
    //     |                          |                                |                                       |
    //     |    ______________________________________________         |                                       |
    //     |    ! ALT  /  Bid placed within 15 min of end?    !        |                                       |
    //     |    !_____/               |                       !        |                                       |
    //     |    !                     ----.                   !        |                                       |
    //     |    !                         | extend auction    !        |                                       |
    //     |    !                     <---'                   !        |                                       |
    //     |    !~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~!        |                                       |
    //     |    !~[noop]~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~!        |                                       |
    //     |                          |                                |                                       |
    //     |                          ----.                            |                                       |
    //     |                              | emit AuctionBid()          |                                       |
    //     |                          <---'                            |                                       |
    //   Caller           ,-----------+-----------.          ,---------+----------.                  ,---------+---------.
    //     ,-.            |ReserveAuctionCoreErc20|          |ERC721TransferHelper|                  |ERC20TransferHelper|
    //     `-'            `-----------------------'          `--------------------'                  `-------------------'
    //     /|\
    //      |
    //     / \
    /// @notice Places a bid on the auction for a given NFT
    /// @param _tokenContract The address of the ERC-1155 token
    /// @param _tokenId The id of the ERC-1155 token
    /// @param _amount The amount to bid
    function createBid(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _auctionId,
        uint256 _amount
    ) public payable nonReentrant {
        // Get the auction for the specified token
        Auction storage auction = auctionsForNFT[_tokenContract][_tokenId][_auctionId];

        address seller = auction.seller;

        // Ensure the auction exists
        require(seller != address(0), "AUCTION_DOES_NOT_EXIST");

        // Check the seller
        require(seller == auction.seller, "SELLER_NOT_MATCHING");

        // Ensure the auction has started or is valid to start
        require(block.timestamp >= auction.startTime, "AUCTION_NOT_STARTED");

        // Ensure the bid can be downcasted to 96 bits for this module
        // For a higher bid, use the supporting module
        require(_amount <= type(uint96).max, "INVALID_BID");

        // Cache more auction metadata
        uint256 firstBidTime = auction.firstBidTime;
        uint256 duration = auction.duration;
        address currency = auction.currency;

        // Used to emit whether the bid started the auction
        bool firstBid;

        // If this is the first bid, start the auction
        if (firstBidTime == 0) {
            // Ensure the bid meets the reserve price
            require(_amount >= auction.reservePrice, "RESERVE_PRICE_NOT_MET");

            // Store the current time as the first bid time
            auction.firstBidTime = uint96(block.timestamp);

            // Mark this bid as the first
            firstBid = true;

            // Transfer the NFT from the seller into escrow for the duration of the auction
            // Reverts if the seller did not approve the ERC1155TransferHelper or no longer owns the token
            erc1155TransferHelper.safeTransferFrom(_tokenContract, seller, address(this), _tokenId, auction.amount, "");

            // Else this is a subsequent bid, so refund the previous bidder
        } else {
            // Ensure the auction has not ended
            require(block.timestamp < firstBidTime + duration, "AUCTION_OVER");

            // Cache the highest bid
            uint256 highestBid = auction.highestBid;

            // Used to store the minimum bid required to outbid the highest bidder
            uint256 minValidBid;

            // Calculate the minimum bid required (10% higher than the highest bid)
            // Cannot overflow as `minValidBid` cannot be greater than 104 bits
            unchecked {
                minValidBid = highestBid + ((highestBid * minBidIncrementPercentage) / 100);
            }

            // Ensure the result can be downcasted to 96 bits
            require(minValidBid <= type(uint96).max, "MAX_BID_PLACED");

            // Ensure the incoming bid meets the minimum
            require(_amount >= minValidBid, "MINIMUM_BID_NOT_MET");

            // Refund the previous bidder
            _handleOutgoingTransfer(auction.highestBidder, highestBid, currency, 50000);
        }

        // Retrieve the bid from the bidder
        // If ETH, this reverts if the bidder did not attach enough
        // If ERC-20, this reverts if the bidder did not approve the ERC20TransferHelper or does not own the specified amount
        _handleIncomingTransfer(_amount, currency);

        // Store the amount as the highest bid
        auction.highestBid = uint96(_amount);

        // Store the caller as the highest bidder
        auction.highestBidder = msg.sender;

        // Used to emit whether the bid extended the auction
        bool extended;

        // Used to store the auction time remaining
        uint256 timeRemaining;

        // Get the auction time remaining
        // Cannot underflow as `firstBidTime + duration` is ensured to be greater than `block.timestamp`
        unchecked {
            timeRemaining = firstBidTime + duration - block.timestamp;
        }

        // If the bid is placed within 15 minutes of the auction end, extend the auction
        if (timeRemaining < timeBuffer) {
            // Add (15 minutes - remaining time) to the duration so that 15 minutes remain
            // Cannot underflow as `timeRemaining` is ensured to be less than `timeBuffer`
            unchecked {
                auction.duration += uint48(timeBuffer - timeRemaining);
            }

            // Mark the bid as one that extended the auction
            extended = true;
        }

        emit AuctionBid(_tokenContract, _tokenId, firstBid, extended, auction);
    }

    //     ,-.
    //     `-'
    //     /|\
    //      |             ,-----------------------.
    //     / \            |ReserveAuctionCoreErc20|
    //   Caller           `-----------+-----------'
    //     |     settleAuction()      |
    //     | ------------------------>|
    //     |                          |
    //     |                          ----.
    //     |                              | validate auction ended
    //     |                          <---'
    //     |                          |
    //     |                          ----.
    //     |                              | handle royalty payouts
    //     |                          <---'
    //     |                          |
    //     |                          ----.
    //     |                              | handle seller funds recipient payout
    //     |                          <---'
    //     |                          |
    //     |                          ----.
    //     |                              | transfer NFT from escrow to winning bidder
    //     |                          <---'
    //     |                          |
    //     |                          ----.
    //     |                              | emit AuctionEnded()
    //     |                          <---'
    //     |                          |
    //     |                          ----.
    //     |                              | delete auction from contract
    //     |                          <---'
    //   Caller           ,-----------+-----------.
    //     ,-.            |ReserveAuctionCoreErc20|
    //     `-'            `-----------------------'
    //     /|\
    //      |
    //     / \
    /// @notice Ends the auction for a given NFT
    /// @param _tokenContract The address of the ERC-1155 token
    /// @param _tokenId The id of the ERC-1155 token
    function settleAuction(address _tokenContract, uint256 _tokenId, uint256 _auctionId) public nonReentrant {
        // Get the auction for the specified token
        Auction memory auction = auctionsForNFT[_tokenContract][_tokenId][_auctionId];

        address seller = auction.seller;

        require(seller != address(0), "AUCTION_NOT_EXISTENT");

        // Cache the time of the first bid
        uint256 firstBidTime = auction.firstBidTime;

        // Ensure the auction had started
        require(firstBidTime != 0, "AUCTION_NOT_STARTED");

        // Ensure the auction has ended
        require(block.timestamp >= (firstBidTime + auction.duration), "AUCTION_NOT_OVER");

        // Cache the auction currency
        address currency = auction.currency;

        // Payout associated token royalties, if any
        (uint256 remainingProfit, ) = _handleRoyaltyPayout(_tokenContract, _tokenId, auction.highestBid, currency, 300000);

        // Payout the module fee, if configured by the owner
        remainingProfit = _handleProtocolFeePayout(remainingProfit, currency);

        // Transfer the remaining profit to the funds recipient
        _handleOutgoingTransfer(auction.sellerFundsRecipient, remainingProfit, currency, 50000);

        // Transfer the NFT to the winning bidder
        IERC1155(_tokenContract).safeTransferFrom(address(this), auction.highestBidder, _tokenId, auction.amount, "");

        emit AuctionEnded(_tokenContract, _tokenId, auction);

        removeAmountFromUser(_tokenContract, _tokenId, _auctionId, msg.sender);

        // Remove the auction from storage
        delete auctionsForNFT[_tokenContract][_tokenId][_auctionId];
    }

    function buyNowAuction(address _tokenContract, uint256 _tokenId, uint256 _auctionId, uint256 _amount) payable external {
        // Get the auction for the specified token
        Auction storage auction = auctionsForNFT[_tokenContract][_tokenId][_auctionId];

        // Ensure the auction exists
        require(auction.seller != address(0), "AUCTION_NOT_EXISTENT");

        // Ensure the auction has started or is valid to start
        require(block.timestamp >= auction.startTime, "AUCTION_NOT_STARTED");

        require(auction.buyNowPrice > 0, "BUY_NOW_NOT_ACTIVE");

        require(_amount == auction.buyNowPrice, "BUY_NOW_PRICE_NOT_MET");

        uint8 resetMinBid = minBidIncrementPercentage;
        minBidIncrementPercentage = 0;

        createBid(_tokenContract, _tokenId, _auctionId, _amount);

        minBidIncrementPercentage = resetMinBid;
        auction.duration = 0;

        settleAuction(_tokenContract, _tokenId, _auctionId);
    }

    function setMinBidIncrementPercentage(uint8 newIncrement) external {
        require(msg.sender == erc1155TransferHelper.ZMM().registrar(), "NOT_ALLOWED");

        minBidIncrementPercentage = newIncrement;
    }

    function setTimeBuffer(uint16 newBuffer) external {
        require(msg.sender == erc1155TransferHelper.ZMM().registrar(), "NOT_ALLOWED");

        timeBuffer = newBuffer;
    }

    function getAuctionsPerUser(address _tokenContract, uint256 _tokenId, address account) external view returns (uint256[] memory) {
        return auctionsPerUser[_tokenContract][_tokenId][account];
    }

    function _cancelAuction(address _tokenContract, uint256 _tokenId, uint256 _auctionId) internal {
        emit AuctionCanceled(_tokenContract, _tokenId, auctionsForNFT[_tokenContract][_tokenId][_auctionId]);

        // Remove the auction from storage
        delete auctionsForNFT[_tokenContract][_tokenId][_auctionId];
    }

    function amountInAuctions(address _tokenContract, uint256 _tokenId, address account) internal returns (uint256) {
        uint256[] memory existingAuctions = auctionsPerUser[_tokenContract][_tokenId][account];
        uint256 length = existingAuctions.length;

        uint256 result;
        for(uint256 i=0;i<length;) {
            Auction storage a = auctionsForNFT[_tokenContract][_tokenId][existingAuctions[i]];

            result += a.amount;

            unchecked {
                ++i;
            }
        }

        return result;
    }

    function removeAmountFromUser(address _tokenContract, uint256 _tokenId, uint256 _auctionId, address account) internal {
        uint256[] memory existingAuctions = auctionsPerUser[_tokenContract][_tokenId][account];
        uint256 length = existingAuctions.length;

        for(uint256 i=0;i<length;) {
            if (existingAuctions[i] == _auctionId) {
                auctionsPerUser[_tokenContract][_tokenId][account][i] = existingAuctions[length - 1];
                auctionsPerUser[_tokenContract][_tokenId][account].pop();
                break;
            }

            unchecked {
                ++i;
            }
        }
    }
}
