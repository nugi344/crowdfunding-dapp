import React, { useState, useEffect } from "react";
import { Web3ReactProvider, useWeb3React } from "@web3-react/core";
import { InjectedConnector } from "@web3-react/injected-connector";
import { WalletConnectConnector } from "@web3-react/walletconnect-connector";
import { CoinbaseWallet } from "@web3-react/coinbase-wallet";
import { Alchemy, Network } from "alchemy-sdk";
import { ethers } from "ethers";
import CrowdfundingABI from "./artifacts/Crowdfunding.json";
import "./App.css";

const CONTRACT_ADDRESS = "0xNewAddress";
const ALCHEMY_API_KEY = "zzSjioVesL9pCx05zoTo9it5IbKP84qp";
const TOKENS = [
  { name: "ETH", address: "0x0000000000000000000000000000000000000000" },
  { name: "USDT", address: "0xaA8E23FB1079EA71e0a56F48a2aA51851D8433D0" },
];

const injected = new InjectedConnector({ supportedChainIds: [11155111] }); // Sepolia
const walletconnect = new WalletConnectConnector({
  rpc: { 11155111: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}` },
  qrcode: true,
});
const coinbaseWallet = new CoinbaseWallet({
  appName: "Crowdfunding DApp",
  url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  chainId: 11155111,
});

function getLibrary(provider) {
  return new ethers.BrowserProvider(provider);
}

function AppContent() {
  const { active, account, activate, deactivate, library } = useWeb3React();
  const [contract, setContract] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [donationAmount, setDonationAmount] = useState("");
  const [selectedCampaignToken, setSelectedCampaignToken] = useState(TOKENS[0].address);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const fetchCampaigns = async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const count = await contract.campaignCount();
      const campaignsArray = [];
      const now = Math.floor(Date.now() / 1000);
      for (let i = 1; i <= count; i++) {
        const campaign = await contract.campaigns(i);
        const tokenAddr = await contract.campaignTokens(i);
        const deadline = Number(campaign.deadline);
        campaignsArray.push({
          id: i,
          creator: campaign.creator,
          goal: ethers.formatEther(campaign.goal),
          raised: ethers.formatEther(campaign.raised),
          deadline: new Date(deadline * 1000).toLocaleString(),
          completed: campaign.completed,
          isActive: deadline > now && !campaign.completed,
          email: campaign.email,
          description: campaign.description,
          details: campaign.details,
          token: tokenAddr,
        });
      }
      setCampaigns(campaignsArray);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active && library) {
      const initContract = async () => {
        try {
          const signer = await library.getSigner();
          const newContract = new ethers.Contract(CONTRACT_ADDRESS, CrowdfundingABI.abi, signer);
          setContract(newContract);
        } catch (err) {
          setError(err.reason || "Failed to initialize contract");
        }
      };
      initContract();
    }
  }, [active, library]);

  useEffect(() => {
    if (contract) {
      fetchCampaigns();
      const interval = setInterval(async () => {
        const now = Math.floor(Date.now() / 1000);
        for (const campaign of campaigns) {
          if (campaign.isActive && Number(campaign.deadline) / 1000 < now && !campaign.completed && campaign.raised < campaign.goal) {
            try {
              const tx = await contract.autoRefund(campaign.id);
              await tx.wait();
              await fetchCampaigns();
            } catch (err) {
              console.error(err);
            }
          }
        }
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [contract, campaigns]);

  const connectWallet = async (connector) => {
    setConnecting(true);
    try {
      await activate(connector);
    } catch (err) {
      setError("Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  const createCampaign = async () => {
    if (!contract || !goal || !duration || !email || !description || !details) return;
    setLoading(true);
    try {
      const tx = await contract.createCampaign(
        ethers.parseEther(goal),
        duration,
        email,
        description,
        details,
        selectedCampaignToken
      );
      await tx.wait();
      alert("Campaign created!");
      setGoal("");
      setDuration("");
      setEmail("");
      setDescription("");
      setDetails("");
      setSelectedCampaignToken(TOKENS[0].address);
      await fetchCampaigns();
    } catch (err) {
      console.error(err);
      setError(err.reason || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const donate = async (campaignId, tokenAddr) => {
    if (!contract || !donationAmount) return;
    setLoading(true);
    try {
      let tx;
      if (tokenAddr === "0x0000000000000000000000000000000000000000") {
        tx = await contract.donate(campaignId, ethers.parseUnits(donationAmount, 18), tokenAddr, {
          value: ethers.parseEther(donationAmount),
        });
      } else {
        tx = await contract.donate(campaignId, ethers.parseUnits(donationAmount, 6), tokenAddr);
      }
      await tx.wait();
      alert("Donation successful!");
      setDonationAmount("");
      await fetchCampaigns();
    } catch (err) {
      console.error(err);
      setError(err.reason || "Failed to donate");
    } finally {
      setLoading(false);
    }
  };

  const disburseFunds = async (id) => {
    if (!contract) return;
    setLoading(true);
    try {
      const tx = await contract.disburseFunds(id);
      await tx.wait();
      alert("Funds disbursed!");
      await fetchCampaigns();
    } catch (err) {
      console.error(err);
      setError(err.reason || "Failed to disburse funds");
    } finally {
      setLoading(false);
    }
  };

  const refund = async (id, tokenAddr) => {
    if (!contract) return;
    setLoading(true);
    try {
      const tx = await contract.refund(id, tokenAddr);
      await tx.wait();
      alert("Refund successful!");
      await fetchCampaigns();
    } catch (err) {
      console.error(err);
      setError(err.reason || "Failed to refund");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="header">
        <h1>Crowdfunding DApp</h1>
        {active ? (
          <div>
            <p className="account">Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
            <button className="connect-btn" onClick={deactivate}>Disconnect</button>
          </div>
        ) : (
          <div className="wallet-options">
            <button
              className="connect-btn"
              onClick={() => connectWallet(injected)}
              disabled={connecting}
            >
              MetaMask
            </button>
            <button
              className="connect-btn"
              onClick={() => connectWallet(walletconnect)}
              disabled={connecting}
            >
              WalletConnect
            </button>
            <button
              className="connect-btn"
              onClick={() => connectWallet(coinbaseWallet)}
              disabled={connecting}
            >
              Coinbase Wallet
            </button>
          </div>
        )}
      </header>
      {loading && <p className="loading">Loading...</p>}
      {error && <p className="error">{error}</p>}

      <section className="create-campaign">
        <h2>Create Campaign</h2>
        <div className="form-group">
          <input
            type="text"
            placeholder="Goal (in selected token)"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={loading}
          />
          <input
            type="text"
            placeholder="Duration (seconds)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={loading}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
          <textarea
            placeholder="Project Details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            disabled={loading}
          />
          <select
            value={selectedCampaignToken}
            onChange={(e) => setSelectedCampaignToken(e.target.value)}
            disabled={loading}
          >
            {TOKENS.map((token) => (
              <option key={token.address} value={token.address}>
                {token.name}
              </option>
            ))}
          </select>
          <button className="action-btn" onClick={createCampaign} disabled={loading}>
            Create Campaign
          </button>
        </div>
      </section>

      <section className="campaigns">
        <h2>Campaigns</h2>
        {campaigns.length === 0 && <p>No campaigns available</p>}
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="campaign-card">
            <h3>Campaign #{campaign.id}</h3>
            <p><strong>Creator:</strong> {campaign.creator}</p>
            <p><strong>Email:</strong> {campaign.email}</p>
            <p><strong>Goal:</strong> {campaign.goal} {TOKENS.find((t) => t.address === campaign.token)?.name}</p>
            <p><strong>Raised:</strong> {campaign.raised} {TOKENS.find((t) => t.address === campaign.token)?.name}</p>
            <p><strong>Deadline:</strong> {campaign.deadline}</p>
            <p><strong>Status:</strong> {campaign.completed ? "Completed" : campaign.isActive ? "Active" : "Inactive"}</p>
            <p><strong>Description:</strong> {campaign.description}</p>
            <p><strong>Details:</strong> {campaign.details}</p>
            {!campaign.completed && (
              <div className="donation-section">
                <input
                  type="text"
                  placeholder={`Donation Amount (${TOKENS.find((t) => t.address === campaign.token)?.name})`}
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  disabled={loading || !campaign.isActive}
                />
                <button
                  className="action-btn"
                  onClick={() => donate(campaign.id, campaign.token)}
                  disabled={loading || !campaign.isActive}
                  title={campaign.isActive ? "" : "Campaign is not active"}
                >
                  Donate
                </button>
                <button
                  className="action-btn"
                  onClick={() => disburseFunds(campaign.id)}
                  disabled={loading || campaign.isActive}
                  title={campaign.isActive ? "Campaign is still active" : ""}
                >
                  Disburse Funds
                </button>
                <button
                  className="action-btn"
                  onClick={() => refund(campaign.id, campaign.token)}
                  disabled={loading || campaign.isActive}
                  title={campaign.isActive ? "Campaign is still active" : ""}
                >
                  Refund
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function App() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <AppContent />
    </Web3ReactProvider>
  );
}

export default App;