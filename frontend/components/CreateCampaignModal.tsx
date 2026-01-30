// components/CreateCampaignModal.tsx
import { useState } from 'react';
import { useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import type { Address, Abi } from 'viem';
import { useCrowdfundFactory } from '@/hooks/UseCrowdfundFactory';

interface Milestone {
  description: string;
  amount: string;
}

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DurationUnit = 'minutes' | 'hours' | 'days';

export default function CreateCampaignModal({ 
  isOpen, 
  onClose, 

}: CreateCampaignModalProps) {
  const {factoryAbi, factoryAddress} = useCrowdfundFactory();
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [beneficiary, setBeneficiary] = useState<string>(useAccount().address || '');
  const [duration, setDuration] = useState<string>('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [fundingCap, setFundingCap] = useState<string>('');
  
  // Milestones
  const [useMilestones, setUseMilestones] = useState<boolean>(false);
  const [milestones, setMilestones] = useState<Milestone[]>([
    { description: '', amount: '' }
  ]);
  
  // Options
  const [enableNFT, setEnableNFT] = useState<boolean>(true);
  const [enableGovernance, setEnableGovernance] = useState<boolean>(false);
  
  const [isCreating, setIsCreating] = useState<boolean>(false);
  
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const convertDurationToSeconds = (): number => {
    const num = parseFloat(duration);
    if (durationUnit === 'minutes') return num * 60;
    if (durationUnit === 'hours') return num * 3600;
    if (durationUnit === 'days') return num * 86400;
    return num * 86400;
  };

  const addMilestone = (): void => {
    setMilestones([...milestones, { description: '', amount: '' }]);
  };

  const removeMilestone = (index: number): void => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: string): void => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const validateStep1 = (): boolean => {
    return !!(name && beneficiary && duration && fundingCap && parseFloat(fundingCap) > 0);
  };

  const validateStep2 = (): boolean => {
    if (!useMilestones) return true;
    
    const allValid = milestones.every(m => m.description && m.amount && parseFloat(m.amount) > 0);
    if (!allValid) return false;
    
    const totalMilestones = milestones.reduce((sum, m) => sum + parseFloat(m.amount), 0);
    return totalMilestones <= parseFloat(fundingCap);
  };

  const getTotalMilestoneAmount = (): number => {
    return milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
  };

  const handleCreate = async (): Promise<void> => {
    setIsCreating(true);
    try {
      if (!publicClient || !walletClient || !address) {
        alert('Please connect your wallet');
        return;
      }

      // FIXED: Prepare milestone data properly - always return a valid array
      let milestoneData: Array<{ description: string; amount: bigint }> = [];
      
      if (useMilestones && milestones && milestones.length > 0) {
        milestoneData = milestones
          .filter(m => {
            // Filter out empty or invalid milestones
            return m.description && 
                   m.description.trim() !== '' && 
                   m.amount && 
                   !isNaN(Number(m.amount)) && 
                   Number(m.amount) > 0;
          })
          .map(m => ({
            description: m.description.trim(),
            amount: parseEther(m.amount),
          }));
      }

      // Set beneficiary to user if empty
      const beneficiaryAddress = (beneficiary || address) as Address;

      // Debug logging
      console.log('Creating campaign with parameters:', {
        factoryAbi
      });

      const { request } = await publicClient.simulateContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: 'createCampaign',
        args: [
          name,
          beneficiaryAddress,
          BigInt(convertDurationToSeconds()),
          parseEther(fundingCap),
          milestoneData, // This is now guaranteed to be a valid array
          enableNFT,
          enableGovernance
        ],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      
      await publicClient.waitForTransactionReceipt({ hash });
      
      alert('✅ Campaign created successfully!');
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error creating campaign:', error);
      
      // Detailed error information
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      // Show user-friendly error
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Parse common errors
        if (errorMessage.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (errorMessage.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for gas';
        } else if (errorMessage.includes('length')) {
          errorMessage = 'Invalid milestone data. Please check your milestone inputs.';
        }
      }
      
      alert('Failed to create campaign: ' + errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">
            Create Campaign - Step {step} of 3
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project Name"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Beneficiary Address 
                </label>
                <input
                  type="text"
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duration
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="30"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Unit
                  </label>
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Funding Goal (ETH) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={fundingCap}
                  onChange={(e) => setFundingCap(e.target.value)}
                  placeholder="10"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!validateStep1()}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
              >
                Next: Milestones
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMilestones}
                    onChange={(e) => setUseMilestones(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-white">Use milestone-based fund release</span>
                </label>
              </div>

              {useMilestones && (
                <>
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-sm text-blue-300">
                    💡 Milestones allow you to release funds incrementally as you complete project phases.
                    Total milestone amounts must not exceed funding goal.
                  </div>

                  {milestones.map((milestone, index) => (
                    <div key={index} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-white font-semibold">Milestone {index + 1}</h4>
                        {milestones.length > 1 && (
                          <button
                            onClick={() => removeMilestone(index)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={milestone.description}
                          onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                          placeholder="e.g., Phase 1: Planning and Design"
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={milestone.amount}
                          onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                          placeholder="Amount in ETH"
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addMilestone}
                    className="w-full px-4 py-2 border-2 border-dashed border-gray-600 hover:border-blue-500 text-gray-400 hover:text-blue-400 rounded-lg transition-colors"
                  >
                    + Add Another Milestone
                  </button>

                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Milestones:</span>
                      <span className="text-white font-semibold">
                        {getTotalMilestoneAmount().toFixed(2)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-400">Funding Goal:</span>
                      <span className="text-white font-semibold">
                        {fundingCap} ETH
                      </span>
                    </div>
                    {getTotalMilestoneAmount() > parseFloat(fundingCap) && (
                      <p className="text-red-400 text-sm mt-2">
                        ⚠️ Total exceeds funding goal!
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!validateStep2()}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Next: Options
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Campaign Features</h3>
                
                <div className="mb-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableNFT}
                      onChange={(e) => setEnableNFT(e.target.checked)}
                      className="mt-1 w-5 h-5"
                    />
                    <div>
                      <div className="text-white font-semibold">🎨 NFT Rewards</div>
                      <p className="text-sm text-gray-400 mt-1">
                        Automatically mint proof-of-contribution NFTs to all contributors when campaign succeeds.
                        Contributors receive unique, on-chain NFTs showing their support.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="mb-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableGovernance}
                      onChange={(e) => setEnableGovernance(e.target.checked)}
                      className="mt-1 w-5 h-5"
                    />
                    <div>
                      <div className="text-white font-semibold">🗳️ Contributor Governance</div>
                      <p className="text-sm text-gray-400 mt-1">
                        Enable democratic voting on milestone completion. Contributors vote (weighted by contribution) 
                        to approve milestones before funds are released. Requires 60% approval.
                      </p>
                      {useMilestones && enableGovernance && (
                        <p className="text-sm text-green-400 mt-2">
                          ✓ Governance will apply to all {milestones.length} milestone{milestones.length !== 1 ? 's' : ''}
                        </p>
                      )}
                      {!useMilestones && enableGovernance && (
                        <p className="text-sm text-yellow-400 mt-2">
                          ⚠️ Governance requires milestones. Enable milestones in Step 2 to use this feature.
                        </p>
                      )}
                    </div>
                  </label>
                </div>

                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                  <div className="text-blue-300 font-semibold mb-2">📢 Campaign Updates (Always Enabled)</div>
                  <p className="text-sm text-blue-200">
                    You'll be able to post progress updates with IPFS links throughout the campaign.
                    Updates are timestamped on-chain and can be linked to specific milestones.
                  </p>
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Campaign Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Campaign Name:</span>
                    <span className="text-white">{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Funding Goal:</span>
                    <span className="text-white">{fundingCap} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duration:</span>
                    <span className="text-white">{duration} {durationUnit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Milestones:</span>
                    <span className="text-white">{useMilestones ? milestones.length : 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">NFT Rewards:</span>
                    <span className="text-white">{enableNFT ? '✓ Enabled' : '✗ Disabled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Governance:</span>
                    <span className="text-white">{enableGovernance && useMilestones ? '✓ Enabled' : '✗ Disabled'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isCreating || (enableGovernance && !useMilestones)}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}