import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  MessageCircle,
  AlertCircle,
  ArrowLeft,
  HelpCircle,
  Bike
} from 'lucide-react';
import { referralService } from '../../../services/authService';
import CaptainBottomNav from '../components/CaptainBottomNav';

const CaptainReferral = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [codeData, setCodeData] = useState({
    referralCode: '',
    referralLink: '',
    enabled: true,
    rewardAmount: 100,
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
        referralService.getCaptainCode(),
        referralService.getCaptainReferrals(),
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
      console.error('Error fetching captain referral data:', err.message);
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

  const fullReferralLink = `${BASE_DOMAIN}/captain/register?ref=${codeData.referralCode || ''}`;

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleCopyCode = async () => {
    if (!codeData.referralCode) return;
    try {
      await navigator.clipboard.writeText(codeData.referralCode);
      setCopiedCode(true);
      showToast('Referral code copied!');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullReferralLink);
      setCopiedLink(true);
      showToast('Referral link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleNativeShare = async () => {
    const shareText = `Join Sathi Seller as a Captain & earn extra daily income delivering orders! Register using my referral code ${codeData.referralCode}: ${fullReferralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Sathi Seller as a Captain',
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
      `Hey! Start earning as a Delivery Captain on Sathi Seller. Fast onboarding & reliable daily payouts! Register using my link:\n\n${fullReferralLink}\n\nReferral Code: *${codeData.referralCode}*`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Rewarded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={11} /> Rewarded
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
            <CheckCircle2 size={11} /> Approved
          </span>
        );
      case 'Registered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
            <Clock size={11} /> Registered
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
            <AlertCircle size={11} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            <Clock size={11} /> {status || 'Pending'}
          </span>
        );
    }
  };

  const getTriggerText = (trigger) => {
    switch (trigger) {
      case 'registration':
        return 'instant bonus upon captain signup';
      case 'admin_approval':
        return 'credited after admin verifies & approves your referred captain';
      case 'first_order':
        return 'credited once referred captain completes their 1st delivery';
      default:
        return 'credited after verification';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#002625] text-white px-4 py-2.5 rounded-full shadow-2xl border border-white/20 text-xs font-bold flex items-center gap-2">
          <Sparkles size={14} className="text-[#ff5500]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Mobile Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/captain/profile')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border-none"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 m-0">Refer & Earn</h1>
            <p className="text-[11px] text-slate-500 m-0">Captain Referral Program</p>
          </div>
        </div>
        <button
          onClick={fetchReferralData}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border-none"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin text-[#ff5500]' : ''} />
        </button>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Referral Program Status Banner if Disabled */}
        {!codeData.enabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center gap-2.5 text-amber-900 text-xs font-medium">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>Captain referral rewards are temporarily paused by administration.</span>
          </div>
        )}

        {/* Hero Card */}
        <div className="bg-gradient-to-br from-[#002625] via-[#0b3d3b] to-[#002625] text-white rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 bg-[#ff5500] text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider shadow-sm">
              <Gift size={12} />
              Captain Bonus
            </span>
            <Bike size={24} className="text-[#ff5500]/80" />
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-tight text-white m-0">
              Earn ₹{codeData.rewardAmount || 100} Cash
            </h2>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Invite your friends to drive for Sathi Seller. You get ₹{codeData.rewardAmount || 100} bonus deposited into your Captain Wallet ({getTriggerText(codeData.rewardTrigger)}).
            </p>
          </div>

          {/* Referral Code Box */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 space-y-2">
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">
              Your Referral Code
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xl font-black tracking-wider text-white select-all">
                {codeData.referralCode || 'GENERATING...'}
              </span>
              <button
                onClick={handleCopyCode}
                className="px-3.5 py-1.5 bg-[#ff5500] hover:bg-[#e64d00] text-white font-extrabold text-xs rounded-xl cursor-pointer transition-transform active:scale-95 border-none shadow-sm flex items-center gap-1"
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                {copiedCode ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Action Sharing Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleWhatsAppShare}
              className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-md flex items-center justify-center gap-1.5 border-none"
            >
              <MessageCircle size={15} />
              WhatsApp
            </button>
            <button
              onClick={handleNativeShare}
              className="py-3 px-3 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl cursor-pointer transition-all border border-white/20 flex items-center justify-center gap-1.5"
            >
              <Share2 size={15} />
              Share Link
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Referrals */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Referrals</span>
              <Users size={14} />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {referralsData.stats.total || 0}
            </div>
            <span className="text-[10px] text-slate-400">Invited friends</span>
          </div>

          {/* Successful */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-600 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Successful</span>
              <CheckCircle2 size={14} />
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {referralsData.stats.successful || 0}
            </div>
            <span className="text-[10px] text-emerald-600/80">Approved</span>
          </div>

          {/* Pending */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-amber-600 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
              <Clock size={14} />
            </div>
            <div className="text-2xl font-black text-amber-600">
              {referralsData.stats.pending || 0}
            </div>
            <span className="text-[10px] text-amber-600/80">In verification</span>
          </div>

          {/* Total Earned */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-[#ff5500] mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Earned</span>
              <IndianRupee size={14} />
            </div>
            <div className="text-2xl font-black text-[#ff5500]">
              ₹{referralsData.stats.totalEarned || 0}
            </div>
            <span className="text-[10px] text-slate-400">Bonus received</span>
          </div>
        </div>

        {/* How It Works Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 m-0 flex items-center gap-2">
            <HelpCircle size={16} className="text-[#ff5500]" />
            How to Earn
          </h3>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-orange-100 text-[#ff5500] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <p className="m-0 leading-snug">Share your invite link with potential delivery drivers.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-orange-100 text-[#ff5500] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <p className="m-0 leading-snug">They register and submit their vehicle & KYC documents.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-orange-100 text-[#ff5500] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <p className="m-0 leading-snug">Once verified, ₹{codeData.rewardAmount || 100} is instantly credited to your wallet balance!</p>
            </div>
          </div>
        </div>

        {/* Referral History List */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 m-0">Referral History</h3>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {referralsData.referrals.length} Total
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-[#ff5500]" />
                <span>Loading activity...</span>
              </div>
            ) : referralsData.referrals.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs space-y-1">
                <Gift size={28} className="mx-auto text-slate-300" />
                <p className="font-bold text-slate-700 m-0">No referrals yet</p>
                <p className="text-[11px] text-slate-400 m-0">
                  Share your code to start earning referral income!
                </p>
              </div>
            ) : (
              referralsData.referrals.map((item) => (
                <div key={item._id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-slate-900">
                      {item.referredName || 'Captain'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short'
                      }) : '—'} • {item.referredPhone ? `••••••${item.referredPhone.slice(-4)}` : 'App'}
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="font-black text-xs text-slate-900">
                      ₹{item.rewardAmount || codeData.rewardAmount || 0}
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <CaptainBottomNav />
    </div>
  );
};

export default CaptainReferral;
