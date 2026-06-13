import React, { useState } from 'react';
import { Trash2, ThumbsUp, ThumbsDown, MailX, BarChart3 } from 'lucide-react';
import { Button } from './ui';
import { newsletterRatingService, extractSenderInfo } from '../services/newsletterRatingService';
import type { SenderStats, UnsubscribeSuggestion } from '../services/newsletterRatingService';

export const NewsletterQualityPanel: React.FC = () => {
  const [senderStats, setSenderStats] = useState<SenderStats[]>(() => newsletterRatingService.getAllSenderStats());
  const [unsubscribeSuggestions, setUnsubscribeSuggestions] = useState<UnsubscribeSuggestion[]>(() => newsletterRatingService.getUnsubscribeSuggestions());

  const refreshStats = () => {
    setSenderStats(newsletterRatingService.getAllSenderStats());
    setUnsubscribeSuggestions(newsletterRatingService.getUnsubscribeSuggestions());
  };

  const handleClearInsights = () => {
    if (!window.confirm('Clear all Newsletter Quality Insight data (your positive/negative feedback)? This cannot be undone.')) return;
    newsletterRatingService.clearAll();
    refreshStats();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          variant="danger"
          size="sm"
          onClick={handleClearInsights}
          disabled={senderStats.length === 0 && unsubscribeSuggestions.length === 0}
          leftIcon={<Trash2 size={16} />}
        >
          Clear data
        </Button>
      </div>

      {/* Unsubscribe Suggestions */}
      <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MailX size={20} className="text-red-500" />
            Newsletters to review
          </h3>
          <button onClick={refreshStats} className="text-xs text-blue-600 hover:underline">Refresh</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Senders for whom, over the last 30 days, your negative feedback outweighs the positive.
          The judgement is entirely yours (given while reading or deleting emails). You may want to consider unsubscribing.
        </p>
        {unsubscribeSuggestions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No suggestions: for now your senders have more positive than negative feedback.</p>
        ) : (
          <ul className="space-y-2">
            {unsubscribeSuggestions.map(s => {
              const info = extractSenderInfo(s.sender);
              return (
                <li key={s.sender} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <MailX size={16} className="text-red-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate" title={s.sender}>
                      {info.name ?? info.email}
                    </p>
                    <p className="text-xs text-gray-500 mb-1 truncate" title={s.sender}>{info.email}</p>
                    <p className="text-xs text-gray-600">{s.reason}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1 text-green-600"><ThumbsUp size={11} />{s.positive30} positive</span>
                      <span className="flex items-center gap-1 text-red-600"><ThumbsDown size={11} />{s.negative30} negative</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Newsletter Insights */}
      <div className="bg-white dark:bg-gray-800/50 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 size={20} />
            Newsletter Quality Insights
          </h3>
          <button onClick={refreshStats} className="text-xs text-blue-600 hover:underline">Refresh</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Positive/negative feedback you give by marking or deleting emails (from the summary bar or with the shortcuts). The judgement is entirely yours.
        </p>
        {senderStats.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No data yet. Mark newsletters positive/negative from the summary bar or when deleting them.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Sender</th>
                  <th className="pb-2 pr-3 text-center" title="Positive / negative feedback all-time">All-time</th>
                  <th className="pb-2 text-center" title="Positive / negative feedback in the last 30 days">Last 30d</th>
                </tr>
              </thead>
              <tbody>
                {senderStats
                  .sort((a, b) => (b.positiveAll - b.negativeAll) - (a.positiveAll - a.negativeAll))
                  .map(s => (
                    <tr key={s.sender} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4 text-gray-800 max-w-[220px] truncate" title={s.sender}>{s.sender}</td>
                      <td className="py-2 pr-3 text-center">
                        <span className="inline-flex items-center justify-center gap-2">
                          <span className="inline-flex items-center gap-0.5 text-green-600 font-semibold"><ThumbsUp size={11} />{s.positiveAll}</span>
                          <span className="inline-flex items-center gap-0.5 text-red-600 font-semibold"><ThumbsDown size={11} />{s.negativeAll}</span>
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        {s.positive30 === 0 && s.negative30 === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-2">
                            <span className="inline-flex items-center gap-0.5 text-green-600"><ThumbsUp size={11} />{s.positive30}</span>
                            <span className="inline-flex items-center gap-0.5 text-red-600"><ThumbsDown size={11} />{s.negative30}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
