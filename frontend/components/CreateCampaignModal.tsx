'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';

interface Milestone {
  description: string;
  amount: string;
}

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    beneficiary: string;
    duration: number;
    fundingCap: string;
    milestones?: Milestone[];
  }) => Promise<void>;
}

type DurationUnit = 'minutes' | 'hours' | 'days';

export default function CreateCampaignModal({ isOpen, onClose, onSubmit }: CreateCampaignModalProps) {
    const [name, setName] = useState('test');
    const [beneficiary, setBeneficiary] = useState('');
    const [durationValue, setDurationValue] = useState('1');
    const [durationUnit, setDurationUnit] = useState<DurationUnit>('hours');
    const [fundingCap, setFundingCap] = useState('0.02');
    const [useMilestones, setUseMilestones] = useState(false);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { address, isConnected } = useAccount();

    if (!isOpen) return null;

    const addMilestone = () => {
        setMilestones([...milestones, { description: '', amount: '' }]);
    };

    const removeMilestone = (index: number) => {
        setMilestones(milestones.filter((_, i) => i !== index));
    };

    const updateMilestone = (index: number, field: 'description' | 'amount', value: string) => {
        const updated = [...milestones];
        updated[index][field] = value;
        setMilestones(updated);
    };


    // Convert duration to seconds based on unit
    const getDurationInSeconds = (): number => {
        const value = parseInt(durationValue);
        switch (durationUnit) {
        case 'minutes':
            return value * 60;
        case 'hours':
            return value * 60 * 60;
        case 'days':
            return value * 24 * 60 * 60;
        default:
            return value * 24 * 60 * 60;
        }
    };


    // Get human-readable duration
    const getReadableDuration = (): string => {
        const value = parseInt(durationValue);
        if (isNaN(value) || value <= 0) return '';
        
        const seconds = getDurationInSeconds();
        const days = Math.floor(seconds / (24 * 60 * 60));
        const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((seconds % (60 * 60)) / 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        
        return parts.join(', ');
    };

    const validateForm = (): boolean => {
        setError(null);
        if (!isConnected) {
            setError('Please connect your wallet first');
            return false;
        }

        if (!name.trim()){
            setError('Campaign name is required');
            return false;
        }

        if (!beneficiary.trim()){
            setError('Beneficiary address is required');
            return false;
        }   

        if (!beneficiary.startsWith('0x') || beneficiary.length !== 42) {
            setError('Invalid beneficiary address format');
            return false;
        }

        if (!fundingCap || parseFloat(fundingCap) <= 0) {
            setError('Funding goal must be a positive number');
            return false;
        }

        if (!durationValue || parseInt(durationValue) <= 0) {
            setError('Duration must be set at least one day');
            return false;
        }

        // Minimum duration check (at least 1 minute)
        const durationSeconds = getDurationInSeconds();
            if (durationSeconds < 60) {
            setError('Duration must be at least 1 minute');
            return false;
        }

        if (useMilestones && milestones.length > 0) {
            let totalMilestoneAmount = 0;

            for (let i = 0; i < milestones.length; i++) {
                const milestone = milestones[i];

                if (!milestone.description.trim()) {
                setError(`Milestone ${i + 1}: Description is required`);
                return false;
                }

                if (!milestone.amount || parseFloat(milestone.amount) <= 0) {
                setError(`Milestone ${i + 1}: Amount must be greater than 0`);
                return false;
                }

                totalMilestoneAmount += parseFloat(milestone.amount);
            }

            // Check if total milestone amount doesn't exceed funding cap
            if (totalMilestoneAmount > parseFloat(fundingCap)) {
                setError(`Total milestone amount (${totalMilestoneAmount} ETH) exceeds funding goal (${fundingCap} ETH)`);
                return false;
            }
        }
        return true;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);
            const durationInSeconds = getDurationInSeconds();

            await onSubmit({
                name: name.trim(),
                beneficiary: beneficiary.trim(),
                duration: durationInSeconds,
                fundingCap,
                milestones: useMilestones && milestones.length > 0 ? milestones : [],
            });

            // Reset form
            setName('');
            setBeneficiary('');
            setDurationValue('7');
            setDurationUnit('days');
            setFundingCap('');
            setMilestones([]);
            setUseMilestones(false);
        } catch (error) {
            console.error('Submit error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const fillMyAddress = () => {
        if (address) {
            setBeneficiary(address);
        }
    };
    
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-slate-900/95 to-slate-950/95 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-white/10">
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Launch Campaign
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white flex items-center justify-center text-2xl transition-all"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Wallet Connection Warning */}
          {!isConnected && (
            <div className="px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
              ⚠️ Please connect your wallet to create a campaign
            </div>
          )}

          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-semibold text-white/90 uppercase tracking-wide mb-2">
              Campaign Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Build Community Center"
              required
              disabled={!isConnected}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Beneficiary Address */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-white/90 uppercase tracking-wide">
                Beneficiary Address <span className="text-red-400">*</span>
              </label>
              {isConnected && address && (
                <button
                  type="button"
                  onClick={fillMyAddress}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Use my address
                </button>
              )}
            </div>
            <input
              type="text"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder="0x..."
              required
              disabled={!isConnected}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-2 text-xs text-white/40">
              Address that will receive funds when campaign succeeds
            </p>
          </div>

        {/* Funding Goal */}
          <div>
            <div>
              <label className="block text-sm font-semibold text-white/90 uppercase tracking-wide mb-2">
                Funding Goal (ETH) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={fundingCap}
                onChange={(e) => setFundingCap(e.target.value)}
                placeholder="10"
                required
                disabled={!isConnected}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            

            <div>
              <label className="block text-sm font-semibold text-white/90 uppercase tracking-wide mb-2">
                Duration <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                  placeholder="7"
                  required
                  disabled={!isConnected}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                  disabled={!isConnected}
                  className="px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
              {durationValue && parseInt(durationValue) > 0 && (
                <p className="mt-2 text-xs text-indigo-400">
                  Duration: {getReadableDuration()}
                </p>
              )}
            </div>
          </div>

          {/* Milestone Toggle */}
          <div className="px-5 py-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useMilestones}
                onChange={(e) => setUseMilestones(e.target.checked)}
                disabled={!isConnected}
                className="w-5 h-5 rounded cursor-pointer accent-indigo-500 disabled:cursor-not-allowed"
              />
              <span className="font-semibold text-white/90">
                Use Milestone-Based Escrow
              </span>
            </label>
            <p className="mt-2 text-xs text-white/40 ml-8">
              Release funds progressively as milestones are completed
            </p>
          </div>

          {/* Milestones Section */}
          {useMilestones && (
            <div className="px-6 py-5 bg-white/[0.02] border border-white/5 rounded-xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wide">
                  Milestones
                </h3>
                <button
                  type="button"
                  onClick={addMilestone}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-indigo-500/15 border border-indigo-500/30 rounded-lg text-indigo-300 text-sm font-semibold hover:bg-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Milestone
                </button>
              </div>

              {milestones.length === 0 && (
                <p className="text-center text-white/40 text-sm py-4">
                  No milestones added yet. Click "Add Milestone" to get started.
                </p>
              )}

              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl"
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={milestone.description}
                      onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                      placeholder="Milestone description"
                      className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={milestone.amount}
                      onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                      placeholder="Amount (ETH)"
                      className="w-full sm:w-32 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 font-mono text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMilestone(index)}
                    className="w-7 h-7 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center text-xl hover:bg-red-500/25 transition-all flex-shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-4 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/80 font-semibold hover:bg-white/8 hover:border-white/20 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isConnected}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}