// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Royalties is Ownable, ReentrancyGuard {

    uint256 constant DEFAULT_TOKEN_ID = type(uint256).max;

    ///beneficiary -> contract -> tokenId (actual tokenId or DEFAULT_TOKEN_ID for contract wide setting) -> bps
    mapping(address => mapping(address => mapping(uint256 => uint256))) public userTokenRoyalties;
    ///contract -> list of beneficiaries
    mapping(address => address[]) public royaltyBeneficiaries;

    /// @notice Calculates royalty payment for all beneficiaries based on token address and id
    /// @param _tokenContract token address to calculate the royalties for
    /// @param _tokenId token id
    /// @param _amount the cost base of the NFT
    /// @return recipients list of recipients of the royalties
    /// @return amounts list of amounts to be distributed
    function getRoyalty(
        address _tokenContract,
        uint256 _tokenId,
        uint256 _amount
    ) external view returns (
        address[] memory recipients,
        uint256[] memory amounts
    ) {
        recipients = royaltyBeneficiaries[_tokenContract];
        uint256 length = recipients.length;
        amounts = new uint256[](length);
        for(uint256 i = 0; i < length;) {
            uint256 royalty = userTokenRoyalties[recipients[i]][_tokenContract][_tokenId];

            /// If the royalty is not set for particular token, check the default for contract
            if (royalty == 0) {
                royalty = userTokenRoyalties[recipients[i]][_tokenContract][DEFAULT_TOKEN_ID];
            }
            amounts[i] = _amount * royalty / 10000;
            unchecked {
                 ++i;
            }
        }
    }

    /// @notice Sets royalty for beneficiary
    /// @param _beneficiary Beneficiary address
    /// @param _tokenContract Token contract to be configured
    /// @param _tokenId Token ID to be configured (use type(uint256).max for global contract configuration)
    /// @param _royalty Royalty value in basis points (BPS)
    function setBeneficiary(
        address _beneficiary,
        address _tokenContract,
        uint256 _tokenId,
        uint256 _royalty
    ) external onlyOwner {
        require(_royalty <= 10000, "Royalty too high");

        if (!beneficiarySet(_tokenContract, _beneficiary)) {
            royaltyBeneficiaries[_tokenContract].push(_beneficiary);
        } else if (_royalty == 0) {
            removeBeneficiary(_tokenContract, _beneficiary);
            delete userTokenRoyalties[_beneficiary][_tokenContract][_tokenId];
            return;
        }
        
        userTokenRoyalties[_beneficiary][_tokenContract][_tokenId] = _royalty;

    }

    /// @notice Checks whether the beneficiary has been configured before
    /// @param _tokenContract token contract to check
    /// @param _beneficiary beneficiary to be checked
    function beneficiarySet(address _tokenContract, address _beneficiary) internal returns (bool) {
        address[] memory beneficiaries = royaltyBeneficiaries[_tokenContract];
        uint256 length = beneficiaries.length;
        for(uint256 i = 0; i < length;) {
            if (beneficiaries[i] == _beneficiary) {
                return true;
            }
            unchecked {
                 ++i;
            }
        }

        return false;
    }

    /// @notice Removes beneficiary from tracking list
    /// @param _tokenContract token contract to configure
    /// @param _beneficiary beneficiary to be removed
    function removeBeneficiary(address _tokenContract, address _beneficiary) internal {
        address[] memory beneficiaries = royaltyBeneficiaries[_tokenContract];
        uint256 length = beneficiaries.length;
        for(uint256 i = 0; i < length;) {
            if (beneficiaries[i] == _beneficiary) {
                royaltyBeneficiaries[_tokenContract][i] = beneficiaries[beneficiaries.length - 1];
                royaltyBeneficiaries[_tokenContract].pop();
                break;
            }
            unchecked {
                 ++i;
            }
        }
    }
}