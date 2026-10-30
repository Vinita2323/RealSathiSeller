import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  Copy, 
  Check, 
  Share2, 
  Users, 
  CheckCircle2, 
  Clock, 
  IndianRupee, 
  RefreshCw, 
  Sparkles, 
  ExternalLink, 
  MessageCircle,
  AlertCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { referralService } from '../../../services/authService';

const SellerReferral = () => {
  const [loading, setLoading] = useState(true);
  const [codeData, setCodeData] = useState({
    referralCode: '',
    referralLink: '',
    enabled: true,
    rewardAmount: 200,
    rewardTrigger: 'admin_approval',
  });
  const [referralsData, setReferralsData] = useState({
    referrals: [],
    stats: {
      total: 0,
      successful: 0,
      pending: 0,
      rejected: 0,
      totalEarned: 0,
    },
  });

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const [codeRes, historyRes] = await Promise.all([
        referralService.getSellerCode(),
        referralService.getSellerReferrals(),
      ]);

      if (codeRes && codeRes.success) {
        setCodeData(codeRes);
      }
      if (historyRes && historyRes.success) {
        setReferralsData({
          referrals: historyRes.referrals || [],
          stats: historyRes.stats || {
            total: 0,
            successful: 0,
            pending: 0,
            rejected: 0,
            totalEarned: 0,
          },
        });
      }
    } catch (err) {
      console.error('Error fetching seller referral data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, []);

  const BASE_DOMAIN = (typeof window !== 'undefined' && window.location.origin.includes('sathiseller.in'))
    ? window.location.origin
    : 'https://sathiseller.in';

  const fullReferralLink = `${BASE_DOMAIN}/seller/register?ref=${codeData.referralCode || ''}`;

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleCopyCode = async () => {
    if (!codeData.referralCode) return;
    try {
      await navigator.clipboard.writeText(codeData.referralCode);
      setCopiedCode(true);
      showToast('Referral code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullReferralLink);
      setCopiedLink(true);
      showToast('Referral link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleNativeShare = async () => {
    const shareText = `Join Sathi Seller as a Seller using my referral code ${codeData.referralCode} and start expanding your store business! Sign up here: ${fullReferralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Sathi Seller as a Seller',
          text: shareText,
          url: fullReferralLink,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hello! Grow your local business on Sathi Seller. Register using my invite link:\n\n${fullReferralLink}\n\nReferral Code: *${codeData.referralCode}*`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Rewarded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={12} /> Rewarded
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'Qualified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
            <Sparkles size={12} /> Qualified
          </span>
        );
      case 'Registered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock size={12} /> Registered
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <AlertCircle size={12} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            <Clock size={12} /> {status || 'Pending'}
          </span>
        );
    }
  };

  const getRewardBadge = (status, item = {}) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'credited' || normalized === 'paid' || normalized === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          ✓ Credited
        </span>
      );
    }
    if (normalized === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          ✕ Failed
        </span>
      );
    }
    // Pending — show why (trigger) so it does not look like a stuck credit (#76)
    const triggerHint =
      item.rewardTrigger === 'admin_approval' || codeData.rewardTrigger === 'admin_approval'
        ? 'Awaiting admin approval'
        : item.rewardTrigger === 'first_order' || codeData.rewardTrigger === 'first_order'
          ? 'Awaiting first order'
          : 'Pending credit';
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
        title={getTriggerDescription(item.rewardTrigger || codeData.rewardTrigger)}
      >
        ⏳ {triggerHint}
      </span>
    );
  };

  const getTriggerDescription = (trigger) => {
    switch (trigger) {
      case 'registration':
        return 'instant credit upon registrant signup';
      case 'admin_approval':
        return 'credited once the referred seller is approved by admin';
      case 'first_order':
        return 'credited after the referred seller completes their first order';
      default:
        return 'credited upon verification';
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-[#002625] text-white px-4 py-2.5 rounded-2xl shadow-xl border border-white/20 text-xs font-bold animate-in fade-in slide-in-from-top-3 flex items-center gap-2">
          <Sparkles size={16} className="text-[#ff5500]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-100 text-[#ff5500] rounded-xl">
              <Gift size={22} />
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Refer & Earn</h1>
          </div>
          <p className="text-xs font-normal text-slate-500 mt-1">
            Invite fellow sellers to Sathi Seller and earn reward bonuses straight into your wallet balance.
          </p>
        </div>
        <button
          onClick={fetchReferralData}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer shadow-xs flex items-center gap-1.5 self-start sm:self-auto transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Referral Program Status Banner if Disabled */}
      {!codeData.enabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-xs font-medium">
          <AlertCircle size={18} className="text-amber-600 shrink-0" />
          <span>The referral program is currently paused by the platform administrator. New referrals will not accrue rewards until reactivated.</span>
        </div>
      )}

      {/* Hero Card & Code Sharing Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Main Gradient Card */}
        <div className="lg:col-span-2 bg-gradient-to-r from-[#ff5500] via-[#ff6814] to-[#e65507] rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              <Sparkles size={13} />
              Seller Referral Program
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight pt-1">
              Earn ₹{codeData.rewardAmount || 200} for Every New Seller!
            </h2>
            <p className="text-xs text-white/90 max-w-xl leading-relaxed">
              Share your personal invite code or link with business owners. You receive ₹{codeData.rewardAmount || 200} bonus into your Sathi Seller wallet ({getTriggerDescription(codeData.rewardTrigger)}).
            </p>
          </div>

          {/* Referral Code Display Box */}
          <div className="relative z-10 mt-6 pt-5 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-black/25 backdrop-blur-md rounded-2xl p-3.5 border border-white/20">
              <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider block mb-1">
                Your Referral Code
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xl font-black tracking-wider text-white select-all">
                  {codeData.referralCode || 'GENERATING...'}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-[#ff5500] font-extrabold text-xs rounded-xl cursor-pointer transition-transform active:scale-95 shadow-sm flex items-center gap-1"
                >
                  {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                  {copiedCode ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2">
              <button
                onClick={handleWhatsAppShare}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                Share on WhatsApp
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 py-2 px-3 bg-white/20 hover:bg-white/30 text-white font-semibold text-xs rounded-xl cursor-pointer transition-all border border-white/30 flex items-center justify-center gap-1.5"
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  {copiedLink ? 'Link Copied' : 'Copy Link'}
                </button>
                <button
                  onClick={handleNativeShare}
                  className="py-2 px-3 bg-white/20 hover:bg-white/30 text-white font-semibold text-xs rounded-xl cursor-pointer transition-all border border-white/30 flex items-center justify-center"
                  title="Share"
                >
                  <Share2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
              <HelpCircle size={18} className="text-[#ff5500]" />
              How It Works
            </h3>
            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-[#ff5500] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-bold text-slate-800 m-0">Send Invite</p>
                  <p className="text-[11px] text-slate-500 m-0">Share your link or code with other store owners.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-[#ff5500] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-bold text-slate-800 m-0">They Register</p>
                  <p className="text-[11px] text-slate-500 m-0">The new seller completes signup using your referral code.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-[#ff5500] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-bold text-slate-800 m-0">Earn ₹{codeData.rewardAmount || 200}</p>
                  <p className="text-[11px] text-slate-500 m-0">Reward bonus is automatically credited directly to your wallet.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            Terms: Self-referrals and duplicate accounts are strictly disqualified.
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Referrals */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Referrals</span>
            <Users size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {referralsData.stats.total || 0}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Invites generated</span>
        </div>

        {/* Successful Referrals */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Successful</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
            {referralsData.stats.successful || 0}
          </div>
          <span className="text-[11px] text-emerald-600/80 font-medium">Approved & rewarded</span>
        </div>

        {/* Pending Referrals */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
            {referralsData.stats.pending || 0}
          </div>
          <span className="text-[11px] text-amber-600/80 font-medium">Awaiting verification</span>
        </div>

        {/* Total Earned */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-[#ff5500] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Earned</span>
            <IndianRupee size={16} className="text-[#ff5500]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#ff5500] tracking-tight">
            ₹{referralsData.stats.totalEarned || 0}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Credited to wallet</span>
        </div>
      </div>

      {/* Referral History Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight m-0">Referral History</h3>
            <p className="text-xs text-slate-500 m-0 mt-0.5">Track everyone who joined using your referral code</p>
          </div>
          <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
            {referralsData.referrals.length} Total Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Referred Seller</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reward</th>
                <th className="py-3 px-4">Reward Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#ff5500]" />
                    <span>Loading referral activity...</span>
                  </td>
                </tr>
              ) : referralsData.referrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Gift size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600 m-0">No referrals yet</p>
                    <p className="text-[11px] text-slate-400 m-0 mt-1 max-w-sm mx-auto">
                      Share your referral code <span className="font-mono font-bold text-slate-700">{codeData.referralCode}</span> with other business owners to start earning wallet rewards!
                    </p>
                  </td>
                </tr>
              ) : (
                referralsData.referrals.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {item.referredName && item.referredName !== 'Seller' 
                          ? item.referredName 
                          : (item.referredId?.businessName || item.referredId?.ownerName || item.referredName || 'Seller Store')}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.referredPhone 
                          ? `••••••${item.referredPhone.slice(-4)}` 
                          : (item.referredId?.phone ? `••••••${String(item.referredId.phone).slice(-4)}` : '—')}
                      </div>
                    </td>
                    <td className="py-3 px-4 capitalize font-medium text-slate-600">
                      {item.referredRole || 'seller'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{item.rewardAmount || codeData.rewardAmount || 0}
                    </td>
                    <td className="py-3 px-4">
                      {getRewardBadge(item.rewardStatus, item)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SellerReferral;
