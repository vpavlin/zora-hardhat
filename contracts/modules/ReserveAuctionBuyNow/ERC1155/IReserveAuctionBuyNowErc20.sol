// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

/// @title IReserveAuctionBuyNowErc20
/// @author vpavlin
/// @notice Interface for Reserve Auction with Buy Now feature ERC-20
interface IReserveAuctionBuyNowErc20Erc1155 {
    /// @notice Creates an auction for a given NFT
    /// @param _tokenContract The address of the ERC-721 token
    /// @param _tokenId The id of the ERC-721 token
    /// @param _duration The length of time the auction should run after the first bid
    /// @param _reservePrice The minimum bid amount to start the auction
    /// @param _buyNowPrice The price which, when paid, immediately settles the auction
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
    ) external;

    /// @notice Updates the auction reserve price for a given NFT
    /// @param _tokenContract The address of the ERC-721 token
    /// @param _tokenId The id of the ERC-721 token
    /// @param _buyNowPrice The new reserve price
    function setAuctionBuyNowPrice(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _auctionId,
        uint256 _buyNowPrice
    ) external;

        /// @notice Updates the auction reserve price for a given NFT
    /// @param _tokenContract The address of the ERC-721 token
    /// @param _tokenId The id of the ERC-721 token
    /// @param _reservePrice The new reserve price
    function setAuctionReservePrice(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _auctionId,
        uint256 _reservePrice
    ) external;

    /// @notice Cancels the auction for a given NFT
    /// @param _tokenContract The address of the ERC-721 token
    /// @param _tokenId The id of the ERC-721 token
    function cancelAuction(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _auctionId
    ) external;

    /// @notice Places a bid on the auction for a given NFT
    /// @param _tokenContract The address of the ERC-721 token
    /// @param _tokenId The id of the ERC-721 token
    /// @param _amount The amount to bid
    function createBid(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _auctionId,
        uint256 _amount
    ) external payable;

    /// @notice Ends the auction for a given NFT
    /// @param _tokenContract The address of the ERC-721 token
    /// @param _tokenId The id of the ERC-721 token
    function settleAuction(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _auctionId
    ) external;

}
