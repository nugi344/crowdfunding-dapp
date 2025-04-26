import React, { useState, useEffect } from "react";
import { Alchemy, Network } from "alchemy-sdk";
import { ethers } from "ethers";
import CrowdfundingABI from "./artifacts/Crowdfunding.json";
import "./App.css";

const CONTRACT_ADDRESS = "0x8AF78d7f6A41666BbE56B458cE0e69B42f55374D";
const ALCHEMY_API_KEY = "zzSjioVesL9pCx05zoTo9it5IbKP84qp";

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("");
  const [donationAmount, setDonationAmount] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Define fetchCampaigns in component scope
  const fetchCampaigns = async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const count = await contract.campaignCount();
      const campaignsArray = [];
      for (let i = 1; i <= count; i++) {
        const campaign = await contract.campaigns(i);
        campaignsArray.push({
          id: i,
          creator: campaign.creator,
          goal: ethers.formatEther(campaign.goal),
          raised: ethers.formatEther(campaign.raised),
          deadline: new Date(Number(campaign.deadline) * 1000).toLocaleString(),
          completed: campaign.completed,
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
    const init = async () => {
      if (!window.ethereum) {
        setError("MetaMask is not installed");
        return;
      }

      setLoading(true);
      try {
        const alchemy = new Alchemy({
          apiKey: ALCHEMY_API_KEY,
          network: Network.ETH_SEPOLIA,
        });

        // Check if already connected
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });

        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          // Request connection if not connected
          try {
            await window.ethereum.request({
              method: "eth_requestAccounts",
            });
            const newAccounts = await window.ethereum.request({
              method: "eth_accounts",
            });
            setAccount(newAccounts[0]);
          } catch (err) {
            if (err.code === -32002) {
              setError("MetaMask connection request already pending. Please check MetaMask.");
            } else {
              setError("Failed to connect MetaMask");
            }
            return;
          }
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          CONTRACT_ADDRESS,
          CrowdfundingABI.abi,
          signer
        );
        setContract(contract);
        await fetchCampaigns();
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to initialize contract");
      } finally {
        setLoading(false);
      }
    };

    init();

    // Listen for account or network changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        setAccount(accounts[0] || null);
        if (contract) fetchCampaigns();
      });
      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }

    // Cleanup listeners
    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners("accountsChanged");
        window.ethereum.removeAllListeners("chainChanged");
      }
    };
  }, [contract]);

  const createCampaign = async () => {
    if (!contract || !goal || !duration) return;
    setLoading(true);
    try {
      const tx = await contract.createCampaign(
        ethers.parseEther(goal),
        duration
      );
      await tx.wait();
      alert("Campaign created!");
      setGoal("");
      setDuration("");
      await fetchCampaigns();
    } catch (err) {
      console.error(err);
      setError("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  const donate = async () => {
    if (!contract || !campaignId || !donationAmount) return;
    setLoading(true);
    try {
      const tx = await contract.donate(campaignId, {
        value: ethers.parseEther(donationAmount),
      });
      await tx.wait();
      alert("Donation successful!");
      setDonationAmount("");
      setCampaignId("");
      await fetchCampaigns();
    } catch (err) {
      console.error(err);
      setError("Failed to donate");
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
      setError("Failed to disburse funds");
    } finally {
      setLoading(false);
    }
  };

  const refund = async (id) => {
    if (!contract) return;
    setLoading(true);
    try {
      const tx = await contract.refund(id);
      await tx.wait();
      alert("Refund successful!");
      await fetchCampaigns();
    } catch (err) {
      console.error(err);
      setError("Failed to refund");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Crowdfunding DApp</h1>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {account ? (
        <p>Connected Account: {account}</p>
      ) : (
        <p>Please connect MetaMask</p>
      )}

      <h2>Create Campaign</h2>
      <input
        type="text"
        placeholder="Goal (ETH)"
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
      <button onClick={createCampaign} disabled={loading}>
        Create Campaign
      </button>

      <h2>Donate to Campaign</h2>
      <input
        type="text"
        placeholder="Campaign ID"
        value={campaignId}
        onChange={(e) => setCampaignId(e.target.value)}
        disabled={loading}
      />
      <input
        type="text"
        placeholder="Amount (ETH)"
        value={donationAmount}
        onChange={(e) => setDonationAmount(e.target.value)}
        disabled={loading}
      />
      <button onClick={donate} disabled={loading}>
        Donate
      </button>

      <h2>Campaigns</h2>
      {campaigns.length === 0 && <p>No campaigns available</p>}
      {campaigns.map((campaign) => (
        <div key={campaign.id} className="campaign">
          <p>ID: {campaign.id}</p>
          <p>Creator: {campaign.creator}</p>
          <p>Goal: {campaign.goal} ETH</p>
          <p>Raised: {campaign.raised} ETH</p>
          <p>Deadline: {campaign.deadline}</p>
          <p>Status: {campaign.completed ? "Completed" : "Active"}</p>
          {!campaign.completed && (
            <>
              <button
                onClick={() => disburseFunds(campaign.id)}
                disabled={loading}
              >
                Disburse Funds
              </button>
              <button
                onClick={() => refund(campaign.id)}
                disabled={loading}
              >
                Refund
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default App;