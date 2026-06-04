import React, { useState, useEffect } from 'react';
import { Trash2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ViewedEmail } from '../types';
import { emailLogService } from '../utils/emailLogService';
import { Button, IconButton, Select, Modal } from './ui';

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

  const headerActions = totalCount > 0 ? (
    <Button variant="danger" size="sm" onClick={handleClearAll}>
      Clear All
    </Button>
  ) : undefined;

  const footer = (
    <>
      {/* Page size selector */}
      <div className="flex items-center gap-2 mr-auto">
        <span className="text-sm text-gray-500 dark:text-gray-400">Emails per page:</span>
        <Select
          value={pageSize}
          onChange={handlePageSizeChange}
          className="w-20"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </Select>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Showing {paginatedEmails.length} of {totalCount} emails
        </span>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-1">
        <IconButton
          label="Previous page"
          variant="ghost"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={16} />
        </IconButton>

        <span className="text-sm px-2 text-gray-700 dark:text-gray-300">
          Page {currentPage} of {totalPages}
        </span>

        <IconButton
          label="Next page"
          variant="ghost"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Viewed Emails Log (${totalCount})`}
      headerActions={headerActions}
      size="lg"
      footer={footer}
    >
      {totalCount === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
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
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400">
                    {email.subject}
                  </h3>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
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
                    title="Open in Gmail"
                    aria-label="Open in Gmail"
                    className="inline-flex items-center justify-center rounded-md p-1 transition-colors text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <IconButton
                    label="Remove from log"
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteEmail(email.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-6">
        This log helps you track which emails you've already reviewed.
      </p>
    </Modal>
  );
};
