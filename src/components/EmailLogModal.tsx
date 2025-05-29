import React, { useState, useEffect } from 'react';
import { X, Trash2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ViewedEmail } from '../types';
import { emailLogService } from '../utils/emailLogService';

interface EmailLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewedEmails: ViewedEmail[];
  onRefresh: () => void;
}

export const EmailLogModal: React.FC<EmailLogModalProps> = ({
  isOpen,
  onClose,
  onRefresh
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paginatedEmails, setPaginatedEmails] = useState<ViewedEmail[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  useEffect(() => {
    if (isOpen) {
      loadPaginatedEmails();
    }
  }, [isOpen, currentPage, pageSize]);
  
  const loadPaginatedEmails = () => {
    const result = emailLogService.getViewedEmails(currentPage, pageSize);
    setPaginatedEmails(result.emails);
    setTotalPages(result.totalPages);
    setTotalCount(result.totalCount);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };
  
  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(event.target.value, 10);
    setPageSize(newSize);
    // Reset to first page when changing page size
    setCurrentPage(1);
  };
  
  const handleDeleteEmail = (emailId: string) => {
    emailLogService.removeViewedEmail(emailId);
    loadPaginatedEmails();
    onRefresh();
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all viewed emails from the log?')) {
      emailLogService.clearAllViewedEmails();
      loadPaginatedEmails();
      onRefresh();
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl h-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            Viewed Emails Log ({totalCount})
          </h2>
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {totalCount === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No emails have been viewed yet.</p>
              <p className="text-sm mt-2">
                Start traversing emails to see them appear in this log.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedEmails.map((email) => (
                <div
                  key={email.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate hover:text-blue-600">
                        {email.subject}
                      </h3>
                      <div className="mt-1 text-sm text-gray-600">
                        <div className="flex items-center gap-4">
                          <span>
                            <strong>From:</strong> {email.from}
                          </span>
                          <span>
                            <strong>Date:</strong> {new Date(email.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-1">
                          <strong>Viewed:</strong> {formatDate(email.viewedAt)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <a
                        href={`https://mail.google.com/mail/u/0/#inbox/${email.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Open in Gmail"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        onClick={() => handleDeleteEmail(email.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove from log"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="border-t p-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Emails per page:</span>
            <select 
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border rounded p-1 text-sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`p-1 rounded ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="text-sm px-2">
              Page {currentPage} of {totalPages}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className={`p-1 rounded ${currentPage >= totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="text-xs text-gray-500">
            Showing {paginatedEmails.length} of {totalCount} emails
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t p-3 text-center">
          <p className="text-sm text-gray-600">
            This log helps you track which emails you've already reviewed.
          </p>
        </div>
      </div>
    </div>
  );
};
