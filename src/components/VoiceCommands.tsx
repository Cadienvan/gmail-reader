import React, { useState, useEffect } from 'react';
import { Mic, MicOff, HelpCircle } from 'lucide-react';
import { voiceCommandService, type VoiceCommand } from '../services/voiceCommandService';
import { IconButton, Modal, Button, Callout } from './ui';

interface VoiceCommandsProps {
  onNext: () => void;
  onPrevious: () => void;
  onShowLog: () => void;
  onShowFlashCards: () => void;
  onClose: () => void;
  onRefresh: () => void;
}

export const VoiceCommands: React.FC<VoiceCommandsProps> = ({
  onNext,
  onPrevious,
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
      onShowLog,
      onShowFlashCards,
      onClose,
      onRefresh,
    });

    // Cleanup on unmount
    return () => {
      voiceCommandService.stopListening();
    };
  }, [onNext, onPrevious, onShowLog, onShowFlashCards, onClose, onRefresh]);

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
        <IconButton
          onClick={toggleVoiceCommands}
          label={isListening ? 'Stop voice commands' : 'Start voice commands'}
          variant={isListening ? 'danger' : 'primary'}
          className={`rounded-full p-3 shadow-md ${isListening ? 'animate-pulse' : ''}`}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </IconButton>

        {/* Help Button */}
        <IconButton
          onClick={() => setShowHelp(true)}
          label="Voice commands help"
          className="rounded-full p-3 bg-gray-600 hover:bg-gray-700 text-white shadow-md transition-all duration-200"
        >
          <HelpCircle size={20} />
        </IconButton>

        {/* Status Indicator */}
        {isListening && (
          <div className="flex items-center gap-2 bg-black/80 text-white px-3 py-2 rounded-lg">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Listening...</span>
          </div>
        )}
      </div>

      {/* Help Modal */}
      <Modal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Voice Commands"
        size="sm"
        footer={
          <Button onClick={() => setShowHelp(false)} variant="primary">
            Got it!
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use voice commands to control the application hands-free. Commands work in both Italian and English.
          </p>

          <div className="space-y-3">
            {getSupportedCommands().map((command, index) => (
              <div key={index} className="border-l-4 border-blue-200 dark:border-blue-700 pl-3">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {command.description}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Examples: {command.examples}
                </div>
              </div>
            ))}
          </div>

          <Callout variant="info">
            <h4 className="font-medium text-sm mb-2">Tips:</h4>
            <ul className="text-xs space-y-1">
              <li>• Speak clearly and at normal volume</li>
              <li>• Works in both Italian and English</li>
              <li>• Commands are case-insensitive</li>
              <li>• Click the microphone to start/stop</li>
            </ul>
          </Callout>
        </div>
      </Modal>
    </div>
  );
};
