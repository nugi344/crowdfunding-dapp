// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Crowdfunding {
    struct Campaign {
        address creator;
        uint256 goal;
        uint256 deadline;
        uint256 raised;
        bool completed;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    uint256 public campaignCount;

    event CampaignCreated(uint256 campaignId, address creator, uint256 goal, uint256 deadline);
    event Donated(uint256 campaignId, address donor, uint256 amount);
    event FundsDisbursed(uint256 campaignId, uint256 amount);
    event Refunded(uint256 campaignId, address donor, uint256 amount);

    function createCampaign(uint256 _goal, uint256 _duration) public {
        require(_goal > 0, "Goal must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");

        campaignCount++;
        campaigns[campaignCount] = Campaign(msg.sender, _goal, block.timestamp + _duration, 0, false);
        emit CampaignCreated(campaignCount, msg.sender, _goal, block.timestamp + _duration);
    }

    function donate(uint256 _campaignId) public payable {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp < campaign.deadline, "Campaign has ended");
        require(!campaign.completed, "Campaign is completed");
        require(msg.value > 0, "Donation must be greater than 0");

        campaign.raised += msg.value;
        contributions[_campaignId][msg.sender] += msg.value;
        emit Donated(_campaignId, msg.sender, msg.value);
    }

    function disburseFunds(uint256 _campaignId) public {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "Only creator can disburse");
        require(block.timestamp >= campaign.deadline, "Campaign is still active");
        require(campaign.raised >= campaign.goal, "Goal not reached");
        require(!campaign.completed, "Funds already disbursed");

        campaign.completed = true;
        payable(campaign.creator).transfer(campaign.raised);
        emit FundsDisbursed(_campaignId, campaign.raised);
    }

    function refund(uint256 _campaignId) public {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp >= campaign.deadline, "Campaign is still active");
        require(campaign.raised < campaign.goal, "Goal was reached");
        require(contributions[_campaignId][msg.sender] > 0, "No contribution found");

        uint256 amount = contributions[_campaignId][msg.sender];
        contributions[_campaignId][msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Refunded(_campaignId, msg.sender, amount);
    }
}