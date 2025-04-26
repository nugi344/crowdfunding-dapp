// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract Crowdfunding {
    struct Campaign {
        address creator;
        uint256 goal;
        uint256 raised;
        uint256 deadline;
        bool completed;
        string email;
        string description;
        string details;
        mapping(address => uint256) contributions; // ETH contributions
        mapping(address => mapping(address => uint256)) tokenContributions; // Token contributions
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => address) public campaignTokens; // Track token address per campaign

    event CampaignCreated(uint256 id, address creator, uint256 goal, uint256 deadline, string email, string description, string details, address token);
    event Donated(uint256 id, address donor, uint256 amount, address token);
    event FundsDisbursed(uint256 id, uint256 amount, address token);
    event Refunded(uint256 id, address donor, uint256 amount, address token);

    function createCampaign(uint256 _goal, uint256 _duration, string memory _email, string memory _description, string memory _details, address _token) public {
        require(_goal > 0, "Goal must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");

        campaignCount++;
        Campaign storage campaign = campaigns[campaignCount];
        campaign.creator = msg.sender;
        campaign.goal = _goal;
        campaign.deadline = block.timestamp + _duration;
        campaign.email = _email;
        campaign.description = _description;
        campaign.details = _details;
        campaignTokens[campaignCount] = _token; // Store token address (0x0 for ETH)

        emit CampaignCreated(campaignCount, msg.sender, _goal, campaign.deadline, _email, _description, _details, _token);
    }

    function donate(uint256 _id, uint256 _amount, address _token) public payable {
        Campaign storage campaign = campaigns[_id];
        require(_id > 0 && _id <= campaignCount, "Invalid campaign ID");
        require(block.timestamp <= campaign.deadline, "Campaign has ended");
        require(!campaign.completed, "Campaign is completed");
        require(_amount > 0, "Donation must be greater than 0");

        if (_token == address(0)) {
            require(msg.value == _amount, "Incorrect ETH amount");
            campaign.raised += msg.value;
            campaign.contributions[msg.sender] += msg.value;
        } else {
            require(_token == campaignTokens[_id], "Invalid token for campaign");
            IERC20 token = IERC20(_token);
            require(token.transferFrom(msg.sender, address(this), _amount), "Token transfer failed");
            campaign.tokenContributions[_token][msg.sender] += _amount;
            campaign.raised += _amount; // Note: Assumes token has same decimals as ETH for simplicity
        }

        emit Donated(_id, msg.sender, _amount, _token);
    }

    function disburseFunds(uint256 _id) public {
        Campaign storage campaign = campaigns[_id];
        require(_id > 0 && _id <= campaignCount, "Invalid campaign ID");
        require(msg.sender == campaign.creator, "Only creator can disburse");
        require(block.timestamp > campaign.deadline, "Campaign is still active");
        require(!campaign.completed, "Campaign is completed");
        require(campaign.raised >= campaign.goal, "Goal not reached");

        campaign.completed = true;
        address tokenAddr = campaignTokens[_id];
        uint256 amount = campaign.raised;
        campaign.raised = 0;

        if (tokenAddr == address(0)) {
            payable(campaign.creator).transfer(amount);
        } else {
            IERC20 token = IERC20(tokenAddr);
            require(token.transfer(campaign.creator, amount), "Token transfer failed");
        }

        emit FundsDisbursed(_id, amount, tokenAddr);
    }

    function refund(uint256 _id, address _token) public {
        Campaign storage campaign = campaigns[_id];
        require(_id > 0 && _id <= campaignCount, "Invalid campaign ID");
        require(block.timestamp > campaign.deadline, "Campaign is still active");
        require(!campaign.completed, "Campaign is completed");
        require(campaign.raised < campaign.goal, "Goal was reached");

        uint256 amount;
        if (_token == address(0)) {
            amount = campaign.contributions[msg.sender];
            require(amount > 0, "No ETH contribution to refund");
            campaign.contributions[msg.sender] = 0;
            campaign.raised -= amount;
            payable(msg.sender).transfer(amount);
        } else {
            amount = campaign.tokenContributions[_token][msg.sender];
            require(amount > 0, "No token contribution to refund");
            campaign.tokenContributions[_token][msg.sender] = 0;
            campaign.raised -= amount;
            IERC20 token = IERC20(_token);
            require(token.transfer(msg.sender, amount), "Token transfer failed");
        }

        emit Refunded(_id, msg.sender, amount, _token);
    }

    function autoRefund(uint256 _id) public {
        Campaign storage campaign = campaigns[_id];
        require(_id > 0 && _id <= campaignCount, "Invalid campaign ID");
        require(block.timestamp > campaign.deadline, "Campaign is still active");
        require(!campaign.completed, "Campaign is completed");
        require(campaign.raised < campaign.goal, "Goal was reached");

        campaign.completed = true;
        // Note: Auto-refunded requires off-chain or manual triggering per donor
        // For simplicity, mark as completed to prevent further donations
    }
}