import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Users, TrendingUp, Calendar, Mail, ExternalLink, Download, Trash2, BarChart3 } from 'lucide-react';
import { emailScoringService } from '../services/emailScoringService';
import type { SenderLeaderboard, SenderScore } from '../types';

interface EmailScoringDashboardProps {
  className?: string;
}

export const EmailScoringDashboard: React.FC<EmailScoringDashboardProps> = ({ className = '' }) => {
  const [leaderboard, setLeaderboard] = useState<SenderLeaderboard>({ allTime: [], last90Days: [] });
  const [statistics, setStatistics] = useState({
    totalActions: 0,
    totalSenders: 0,
    totalPoints: 0,
    actionsLast30Days: 0,
    topSender: null as SenderScore | null
  });
  const [activeTab, setActiveTab] = useState<'all-time' | 'last-90-days'>('all-time');
  const [isLoading, setIsLoading] = useState(true);
  const [showExportImport, setShowExportImport] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setIsLoading(true);
    try {
      const leaderboardData = emailScoringService.getSenderLeaderboard();
      const statsData = emailScoringService.getStatistics();
      
      setLeaderboard(leaderboardData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Failed to load scoring data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    const data = emailScoringService.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email-scoring-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importText.trim()) {
      alert('Please paste the scoring data JSON');
      return;
    }

    try {
      const data = JSON.parse(importText);
      if (emailScoringService.importData(data)) {
        loadData();
        setImportText('');
        setShowExportImport(false);
        alert('Scoring data imported successfully!');
      } else {
        alert('Failed to import scoring data');
      }
    } catch (error) {
      alert('Invalid JSON format');
    }
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all scoring data? This cannot be undone.')) {
      emailScoringService.clearAllData();
      loadData();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <div className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">#{rank}</div>;
    }
  };

  const currentLeaderboard = activeTab === 'all-time' ? leaderboard.allTime : leaderboard.last90Days;

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading scoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 size={20} />
              Email Quality Benchmark
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Track email sender engagement based on your interaction patterns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportImport(!showExportImport)}
              className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              <Download size={14} />
              Manage Data
            </button>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Export/Import Panel */}
        {showExportImport && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Data Management</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                <Download size={14} />
                Export Data
              </button>
              <button
                onClick={handleClearData}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                <Trash2 size={14} />
                Clear All Data
              </button>
            </div>
            
            <div className="mt-3 space-y-2">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste scoring data JSON here to import..."
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm h-20"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={!importText.trim()}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Import Data
                </button>
                <button
                  onClick={() => { setImportText(''); setShowExportImport(false); }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Actions</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{statistics.totalActions}</p>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Total Senders</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{statistics.totalSenders}</p>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Total Points</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{statistics.totalPoints}</p>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Last 30 Days</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">{statistics.actionsLast30Days}</p>
          </div>
        </div>

        {/* Top Sender Highlight */}
        {statistics.topSender && (
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <div>
                <h4 className="font-semibold text-yellow-900">🏆 Top Sender</h4>
                <p className="text-yellow-800">
                  <span className="font-medium">{statistics.topSender.senderName || statistics.topSender.senderEmail}</span>
                  {' '}with {statistics.topSender.totalScore} points
                </p>
                <p className="text-xs text-yellow-700">
                  {statistics.topSender.emailSummaryCount} email summaries • {statistics.topSender.linkOpenCount} link opens
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Tabs */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('all-time')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'all-time'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              All-Time Leaderboard ({leaderboard.allTime.length})
            </button>
            <button
              onClick={() => setActiveTab('last-90-days')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'last-90-days'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              Last 90 Days ({leaderboard.last90Days.length})
            </button>
          </div>

          {/* Leaderboard Content */}
          <div className="p-4">
            {currentLeaderboard.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No scoring data available</p>
                <p className="text-sm text-gray-500 mt-2">
                  Start summarizing emails and opening links to see sender rankings
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentLeaderboard.map((sender, index) => (
                  <div
                    key={sender.senderEmail}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                      index < 3
                        ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0">
                      {getRankIcon(index + 1)}
                    </div>

                    {/* Sender Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 truncate">
                          {sender.senderName || sender.senderEmail}
                        </h4>
                        {sender.senderName && (
                          <span className="text-xs text-gray-500 truncate">
                            {sender.senderEmail}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail size={10} />
                          {sender.emailSummaryCount} summaries
                        </span>
                        <span className="flex items-center gap-1">
                          <ExternalLink size={10} />
                          {sender.linkOpenCount} links
                        </span>
                        <span>Last: {formatDate(sender.lastActivity)}</span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {sender.totalScore}
                      </div>
                      <div className="text-xs text-gray-500">points</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">How Scoring Works</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• <strong>Email Summary:</strong> 10 points when you click "Summarize Email"</p>
            <p>• <strong>Link Open:</strong> 3 points when you click on a link for AI summary</p>
            <p>• Scores help identify which senders provide the most valuable content</p>
            <p>• Rankings are updated in real-time as you interact with emails</p>
          </div>
        </div>
      </div>
    </div>
  );
};