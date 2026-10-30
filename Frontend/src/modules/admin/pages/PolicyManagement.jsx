import React, { useState, useEffect } from 'react';
import { 
  FileText, ShieldCheck, Plus, Trash2, Save, RefreshCw, 
  CheckCircle2, AlertCircle, Users, Store, Bike
} from 'lucide-react';
import { policyService } from '../../../services/authService';

export const PolicyManagement = () => {
  // Preset list of 6 policies for 1-click access
  const policyTabs = [
    { id: 'user-terms', target: 'user', type: 'terms', label: 'User Terms of Service', icon: Users, color: '#15803d', badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { id: 'user-privacy', target: 'user', type: 'privacy', label: 'User Privacy Policy', icon: Users, color: '#15803d', badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { id: 'seller-terms', target: 'seller', type: 'terms', label: 'Seller Terms of Service', icon: Store, color: '#ea580c', badgeBg: 'bg-orange-50 text-orange-800 border-orange-200' },
    { id: 'seller-privacy', target: 'seller', type: 'privacy', label: 'Seller Privacy Policy', icon: Store, color: '#ea580c', badgeBg: 'bg-orange-50 text-orange-800 border-orange-200' },
    { id: 'captain-terms', target: 'captain', type: 'terms', label: 'Captain Terms of Service', icon: Bike, color: '#0284c7', badgeBg: 'bg-sky-50 text-sky-800 border-sky-200' },
    { id: 'captain-privacy', target: 'captain', type: 'privacy', label: 'Captain Privacy Policy', icon: Bike, color: '#0284c7', badgeBg: 'bg-sky-50 text-sky-800 border-sky-200' },
  ];

  const [activeTabId, setActiveTabId] = useState('user-terms');
  const activePolicy = policyTabs.find(p => p.id === activeTabId) || policyTabs[0];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState({ type: '', text: '' });

  const [policyData, setPolicyData] = useState({
    title: '',
    sections: []
  });

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg({ type: '', text: '' }), 3500);
  };

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const res = await policyService.getPolicy(activePolicy.target, activePolicy.type);
      if (res?.policy) {
        setPolicyData({
          title: res.policy.title || activePolicy.label,
          sections: res.policy.sections || []
        });
      } else {
        setPolicyData({
          title: activePolicy.label,
          sections: [{ heading: '1. Introduction', body: 'Enter details here.' }]
        });
      }
    } catch (err) {
      console.warn('Error loading policy:', err.message);
      showToast('error', `Failed to load: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, [activeTabId]);

  const handleAddClause = () => {
    const nextNum = policyData.sections.length + 1;
    setPolicyData(prev => ({
      ...prev,
      sections: [
        ...prev.sections,
        { heading: `${nextNum}. New Clause Title`, body: '' }
      ]
    }));
  };

  const handleRemoveClause = (index) => {
    setPolicyData(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }));
  };

  const handleClauseChange = (index, field, value) => {
    setPolicyData(prev => {
      const updated = [...prev.sections];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, sections: updated };
    });
  };

  const handleSave = async () => {
    if (!policyData.title.trim()) {
      showToast('error', 'Please enter a Policy Title');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        target: activePolicy.target,
        type: activePolicy.type,
        title: policyData.title.trim(),
        version: 'v1.0',
        effectiveDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        published: true,
        sections: policyData.sections.filter(s => s.heading.trim() || s.body.trim())
      };

      const res = await policyService.savePolicy(payload);
      if (res?.success) {
        showToast('success', 'Changes saved successfully!');
      } else {
        showToast('error', res?.message || 'Failed to save');
      }
    } catch (err) {
      console.error('Error saving policy:', err);
      showToast('error', err.response?.data?.message || err.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans pb-16">
      
      {/* Toast Alert */}
      {toastMsg.text && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-bold text-white ${
          toastMsg.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
        }`}>
          {toastMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Terms of Service & Privacy Policy</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select any policy below to view or edit its content.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-5 py-2.5 bg-[#ff7526] hover:bg-[#e65507] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer border-none flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {/* 1-Click Policy Tabs (6 Simple Buttons) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {policyTabs.map((tab) => {
          const isSelected = activeTabId === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Icon size={14} />
                </div>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
              </div>

              <div>
                <span className={`text-[10px] font-bold block uppercase tracking-wider ${
                  isSelected ? 'text-slate-400' : 'text-slate-400'
                }`}>
                  {tab.target}
                </span>
                <span className="text-xs font-extrabold leading-tight block">
                  {tab.type === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Editing Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <RefreshCw size={22} className="animate-spin text-[#ff7526]" />
            <span>Loading {activePolicy.label}...</span>
          </div>
        ) : (
          <>
            {/* Policy Title Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Policy Title</label>
              <input
                type="text"
                value={policyData.title}
                onChange={(e) => setPolicyData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter title"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold outline-none focus:border-[#ff7526]"
              />
            </div>

            {/* List of Clauses */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800">
                  Clauses & Sections ({policyData.sections.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddClause}
                  className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#ea580c] text-xs font-bold border border-orange-200 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={13} />
                  <span>Add Clause</span>
                </button>
              </div>

              {policyData.sections.map((sec, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 relative group">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={sec.heading}
                      onChange={(e) => handleClauseChange(idx, 'heading', e.target.value)}
                      placeholder="Clause heading (e.g. 1. Account Security)"
                      className="flex-1 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#ff7526]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveClause(idx)}
                      title="Delete clause"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border-none cursor-pointer transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={sec.body}
                    onChange={(e) => handleClauseChange(idx, 'body', e.target.value)}
                    placeholder="Enter the description or clause details here..."
                    className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3 outline-none focus:border-[#ff7526] resize-y leading-relaxed"
                  />
                </div>
              ))}

              {policyData.sections.length === 0 && (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  No clauses in this policy. Click "Add Clause" above to add one.
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleAddClause}
                className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Add Another Clause</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#ff7526] hover:bg-[#e65507] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}

      </div>

    </div>
  );
};

export default PolicyManagement;
