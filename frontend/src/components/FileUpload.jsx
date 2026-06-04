import React, { useState, useRef } from 'react';
import storageService from '../services/storageService';

const RESOURCE_TYPES = [
  { value: 'lab_report',       label: 'Lab Report' },
  { value: 'prescription',     label: 'Prescription' },
  { value: 'invoice',          label: 'Invoice' },
  { value: 'patient_document', label: 'Patient Document' },
  { value: 'profile_image',    label: 'Profile Image' },
];

/**
 * Reusable file upload component for MinIO storage.
 * Props:
 *   - resourceType: default resource type
 *   - resourceId: linked record ID
 *   - onUploaded: callback(fileMetadata) called after successful upload
 */
export default function FileUpload({ resourceType: defaultType = 'patient_document', resourceId = null, onUploaded }) {
  const [file, setFile] = useState(null);
  const [resourceType, setResourceType] = useState(defaultType);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(''); setSuccess(''); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setError(''); setSuccess(''); }
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a file'); return; }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const result = await storageService.uploadFile(file, resourceType, resourceId);
      setSuccess(`"${file.name}" uploaded successfully`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded && onUploaded(result.file);
    } catch (err) {
      setError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.label}>Upload File to MinIO Storage</div>

      {/* Type selector */}
      <select
        value={resourceType}
        onChange={(e) => setResourceType(e.target.value)}
        style={styles.select}
      >
        {RESOURCE_TYPES.map(rt => (
          <option key={rt.value} value={rt.value}>{rt.label}</option>
        ))}
      </select>

      {/* Drop zone */}
      <div
        style={{ ...styles.dropZone, ...(file ? styles.dropZoneActive : {}) }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        {file ? (
          <div style={styles.fileInfo}>
            <span style={styles.fileIcon}>📄</span>
            <div>
              <div style={styles.fileName}>{file.name}</div>
              <div style={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
        ) : (
          <div style={styles.placeholder}>
            <span style={{ fontSize: '32px' }}>☁️</span>
            <div style={styles.placeholderText}>Drag & drop or click to select</div>
            <div style={styles.placeholderSub}>Max 12 MB</div>
          </div>
        )}
      </div>

      {error   && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.successMsg}>{success}</div>}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{ ...styles.uploadBtn, opacity: (!file || uploading) ? 0.5 : 1 }}
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: '#1e293b',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #334155',
    maxWidth: '480px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  select: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#e2e8f0',
    padding: '8px 12px',
    fontSize: '14px',
  },
  dropZone: {
    border: '2px dashed #334155',
    borderRadius: '10px',
    padding: '28px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: '#0f172a',
  },
  dropZoneActive: {
    borderColor: '#6366f1',
    background: 'rgba(99,102,241,0.05)',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: '14px',
  },
  placeholderSub: {
    color: '#475569',
    fontSize: '12px',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fileIcon: {
    fontSize: '28px',
  },
  fileName: {
    color: '#e2e8f0',
    fontWeight: 500,
    fontSize: '14px',
    wordBreak: 'break-all',
  },
  fileSize: {
    color: '#64748b',
    fontSize: '12px',
  },
  error: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#f87171',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
  },
  successMsg: {
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#4ade80',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
  },
  uploadBtn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    alignSelf: 'flex-end',
  },
};
