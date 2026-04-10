import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * ProcessingOverlay - Full screen modal that indicates the system is "working"
 * This provides the "Visibility of the pause" requested by the user.
 */
export default function ProcessingOverlay({ isProcessing, message = "Processing Transaction...", successMessage = "Success!" }) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isProcessing && showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isProcessing, showSuccess]);

  if (!isProcessing && !showSuccess) return null;

  return (
    <div className="processing-overlay">
      <div className="processing-content">
        {isProcessing ? (
          <>
            <div className="spinner-wrapper">
              <RefreshCw className="spinning" size={48} />
            </div>
            <h3>{message}</h3>
            <p>Please wait while we finalize your data...</p>
          </>
        ) : (
          <div className="success-content">
            <CheckCircle2 size={64} className="success-icon" />
            <h3>{successMessage}</h3>
          </div>
        )}
      </div>

      <style jsx>{`
        .processing-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(253, 246, 238, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease;
        }

        .processing-content {
          text-align: center;
          background: #fff;
          padding: 40px 60px;
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          border: 1px solid var(--border-light);
          max-width: 400px;
          width: 90%;
          animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .spinner-wrapper {
          margin-bottom: 24px;
          color: var(--accent);
          display: flex;
          justify-content: center;
        }

        .processing-content h3 {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .processing-content p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .success-icon {
          color: var(--success);
          margin-bottom: 20px;
          animation: scalePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes scalePop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
