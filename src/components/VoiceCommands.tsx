import React, { useState, useEffect } from 'react';
import { Mic, MicOff, HelpCircle } from 'lucide-react';
import { voiceCommandService, type VoiceCommand } from '../services/voiceCommandService';

interface VoiceCommandsProps {
  onNext: () => void;
  onPrevious: () => void;
  onStartTraversal: () => void;
  onStopTraversal: () => void;
  onShowLog: () => void;
  onShowFlashCards: () => void;
  onClose: () => void;
  onRefresh: () => void;
}

export const VoiceCommands: React.FC<VoiceCommandsProps> = ({
  onNext,
  onPrevious,
  onStartTraversal,
  onStopTraversal,
  onShowLog,
  onShowFlashCards,
  onClose,
  onRefresh,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setIsSupported(voiceCommandService.isSupported());
    
    // Set up callbacks
    voiceCommandService.setCallbacks({
      onNext,
      onPrevious,
      onStartTraversal,
      onStopTraversal,
      onShowLog,
      onShowFlashCards,
      onClose,
      onRefresh,
    });

    // Cleanup on unmount
    return () => {
      voiceCommandService.stopListening();
    };
  }, [onNext, onPrevious, onStartTraversal, onStopTraversal, onShowLog, onShowFlashCards, onClose, onRefresh]);

  const toggleVoiceCommands = () => {
    const newState = voiceCommandService.toggleListening();
    setIsListening(newState);
  };

  const getSupportedCommands = (): VoiceCommand[] => {
    return voiceCommandService.getSupportedCommands();
  };

  if (!isSupported) {
    return null; // Don't render if voice commands aren't supported
  }

  return (
    <div className="fixed top-4 left-4 z-40">
      <div className="flex items-center gap-2">
        {/* Voice Command Toggle Button */}
        <button
          onClick={toggleVoiceCommands}
          className={`p-3 rounded-full transition-all duration-200 ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg animate-pulse'
              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
          }`}
          title={isListening ? 'Stop voice commands' : 'Start voice commands'}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Help Button */}
        <button
          onClick={() => setShowHelp(true)}
          className="p-3 rounded-full bg-gray-600 hover:bg-gray-700 text-white shadow-md transition-all duration-200"
          title="Voice commands help"
        >
          <HelpCircle size={20} />
        </button>

        {/* Status Indicator */}
        {isListening && (
          <div className="flex items-center gap-2 bg-black/80 text-white px-3 py-2 rounded-lg">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Listening...</span>
          </div>
        )}
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Voice Commands</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Use voice commands to control the application hands-free. Commands work in both Italian and English.
              </p>
              
              <div className="space-y-3">
                {getSupportedCommands().map((command, index) => (
                  <div key={index} className="border-l-4 border-blue-200 pl-3">
                    <div className="font-medium text-sm text-gray-900">
                      {command.description}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Examples: {command.examples}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 text-sm mb-2">Tips:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Speak clearly and at normal volume</li>
                  <li>• Works in both Italian and English</li>
                  <li>• Commands are case-insensitive</li>
                  <li>• Click the microphone to start/stop</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
