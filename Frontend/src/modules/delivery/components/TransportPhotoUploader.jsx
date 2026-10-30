import React, { useState } from 'react';
import { transportService } from '../../../services/transportService';

/**
 * Captures one or more goods/delivery photos, uploads them, then stores the
 * returned URLs on the transport booking. The caller decides which stage.
 */
const TransportPhotoUploader = ({ title, hint, photos = [], onSave, disabled = false }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [retryFile, setRetryFile] = useState(null);

  const uploadOne = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    setSaved(false);
    setRetryFile(file);
    try {
      const uploaded = await transportService.uploadTransportPhoto(file);
      const url = uploaded?.imageUrl || uploaded?.filePath;
      if (!url) {
        throw new Error('The upload did not return a photo URL.');
      }
      await onSave([url]);
      setRetryFile(null);
      setSaved(true);
    } catch (err) {
      setError(err?.message || err?.response?.data?.message || 'Photo upload failed. Please retry.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
      <div>
        <p className="text-xs font-black text-slate-800">{title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo) => (
            <img
              key={photo.url || photo}
              src={photo.url || photo}
              alt="Uploaded goods"
              className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
            />
          ))}
        </div>
      )}

      <label className={`flex items-center justify-center gap-1.5 w-full py-3 rounded-xl text-xs font-bold cursor-pointer ${
        disabled || uploading
          ? 'bg-slate-100 text-slate-400'
          : 'bg-slate-900 text-white'
      }`}>
        <span className="material-symbols-outlined text-base">{uploading ? 'sync' : 'photo_camera'}</span>
        {uploading ? 'Uploading photo...' : photos.length > 0 ? 'Add another photo' : 'Capture photo'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            uploadOne(file);
          }}
        />
      </label>

      {saved && !error && (
        <p className="text-[11px] font-bold text-emerald-700">Photo saved on this booking.</p>
      )}
      {error && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-red-600">{error}</p>
          <button
            type="button"
            disabled={uploading || !retryFile}
            onClick={() => uploadOne(retryFile)}
            className="text-[11px] font-bold text-slate-800 underline disabled:opacity-50"
          >
            Retry upload
          </button>
        </div>
      )}
    </div>
  );
};

export default TransportPhotoUploader;
