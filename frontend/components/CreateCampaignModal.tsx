'use client';

import { useState } from 'react';

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

export default function CreateCampaignModal({ isOpen, onClose, onSubmit }: CreateCampaignModalProps) {
  const [name, setName] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [fundingCap, setFundingCap] = useState('');
  const [useMilestones, setUseMilestones] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !beneficiary || !fundingCap || !durationDays) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const duration = parseInt(durationDays) * 24 * 60 * 60;

      await onSubmit({
        name,
        beneficiary,
        duration,
        fundingCap,
        milestones: useMilestones && milestones.length > 0 ? milestones : undefined,
      });

      // Reset form
      setName('');
      setBeneficiary('');
      setDurationDays('7');
      setFundingCap('');
      setMilestones([]);
      setUseMilestones(false);
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
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
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          {/* Beneficiary Address */}
          <div>
            <label className="block text-sm font-semibold text-white/90 uppercase tracking-wide mb-2">
              Beneficiary Address <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder="0x..."
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all"
            />
            <p className="mt-2 text-xs text-white/40">
              Address that will receive funds
            </p>
          </div>

          {/* Funding Goal and Duration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-white/90 uppercase tracking-wide mb-2">
                Funding Goal (ETH) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={fundingCap}
                onChange={(e) => setFundingCap(e.target.value)}
                placeholder="10"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white/90 uppercase tracking-wide mb-2">
                Duration (Days) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="7"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 font-mono focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 focus:ring-3 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>

          {/* Milestone Toggle */}
          <div className="px-5 py-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useMilestones}
                onChange={(e) => setUseMilestones(e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer accent-indigo-500"
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
                  className="px-4 py-2 bg-indigo-500/15 border border-indigo-500/30 rounded-lg text-indigo-300 text-sm font-semibold hover:bg-indigo-500/25 transition-all"
                >
                  + Add Milestone
                </button>
              </div>

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
              disabled={isSubmitting}
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