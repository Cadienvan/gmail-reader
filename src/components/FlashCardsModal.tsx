import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Save, Trash2, Tag, Plus, CheckCircle, Shuffle, RefreshCw, X } from 'lucide-react';
import type { FlashCard, FlashCardTag } from '../types';
import { flashCardService } from '../services/flashCardService';
import { Button, Input, Modal } from './ui';

// User preferences keys for localStorage
const USER_PREF_SELECTED_TAG = 'flashcards_selected_tag';
const USER_PREF_IS_RANDOMIZED = 'flashcards_is_randomized';

interface FlashCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  flashCards: FlashCard[];
  onSave: (flashCards: FlashCard[]) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  title?: string;
  isLoading?: boolean;
  error?: string;
  gameMode?: boolean;
}

export const FlashCardsModal: React.FC<FlashCardsModalProps> = ({
  isOpen,
  onClose,
  flashCards,
  onSave,
  onDelete,
  title = 'Flash Cards',
  isLoading = false,
  error,
  gameMode = false
}) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<FlashCardTag[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editedFlashCards, setEditedFlashCards] = useState<FlashCard[]>([]);
  // State for filter and randomization with localStorage persistence
  const [selectedTagId, setSelectedTagId] = useState<number | 'all'>(() => {
    // Try to get saved preference from localStorage
    const savedTag = localStorage.getItem(USER_PREF_SELECTED_TAG);
    if (savedTag === 'all') return 'all';
    if (savedTag) {
      const tagId = parseInt(savedTag, 10);
      return isNaN(tagId) ? 'all' : tagId;
    }
    return 'all';
  });

  const [isRandomized, setIsRandomized] = useState<boolean>(() => {
    // Try to get saved preference from localStorage
    return localStorage.getItem(USER_PREF_IS_RANDOMIZED) === 'true';
  });

  // Load available tags when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTags().then(tags => {
        // If we have a selected tag, ensure it still exists in the available tags
        if (typeof selectedTagId === 'number') {
          const tagExists = tags.some(tag => tag.id === selectedTagId);
          if (!tagExists) {
            // If tag doesn't exist, reset to 'all'
            setSelectedTagId('all');
            localStorage.setItem(USER_PREF_SELECTED_TAG, 'all');
          }
        }
      });

      // Initialize editedFlashCards with a copy of the original flashCards
      setEditedFlashCards([...flashCards]);

      // Reset to first card and unflipped state when reopening
      setCurrentCardIndex(0);
      setIsFlipped(false);
    }
  }, [isOpen, flashCards, selectedTagId]);

  // Filter cards by selected tag
  const filteredCards = useMemo(() => {
    if (selectedTagId === 'all') {
      return editedFlashCards;
    }
    return editedFlashCards.filter(card =>
      card.tags?.some(tag => tag.id === selectedTagId)
    );
  }, [editedFlashCards, selectedTagId]);

  // Shuffle cards when randomization is toggled
  useEffect(() => {
    if (isRandomized) {
      setEditedFlashCards(prevCards => {
        const shuffled = [...prevCards];
        // Fisher-Yates shuffle algorithm
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      });
      // Reset to first card after shuffling
      setCurrentCardIndex(0);
      setIsFlipped(false);
    }
  }, [isRandomized]);

  const loadTags = async (): Promise<FlashCardTag[]> => {
    try {
      const tags = await flashCardService.getAllTags();
      setAvailableTags(tags);
      return tags;
    } catch (error) {
      console.error('Failed to load tags:', error);
      return [];
    }
  };

  // Use the filtered cards when in game mode, otherwise use the edited ones
  const cardsToUse = gameMode ? filteredCards : editedFlashCards;
  const currentCard = cardsToUse[currentCardIndex] || flashCards[currentCardIndex];

  const handleNext = () => {
    const maxIndex = gameMode ? filteredCards.length - 1 : flashCards.length - 1;
    if (currentCardIndex < maxIndex) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedFlashCards);
    } catch (error) {
      console.error('Failed to save flash cards:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (onDelete && window.confirm('Are you sure you want to delete this flash card?')) {
      try {
        await onDelete(id);
      } catch (error) {
        console.error('Failed to delete flash card:', error);
      }
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const tag = await flashCardService.createTag(newTagName.trim());
      setAvailableTags(prev => [...prev, tag]);
      setNewTagName('');
      setIsTagModalOpen(false);
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const handleAddTag = (tagId: number) => {
    setEditedFlashCards(prev => {
      const updated = [...prev];
      const card = updated[currentCardIndex];

      if (card) {
        // Create tags array if it doesn't exist
        if (!card.tags) card.tags = [];

        // Find the tag
        const tag = availableTags.find(t => t.id === tagId);

        // Only add the tag if it's not already added
        if (tag && !card.tags.some(t => t.id === tagId)) {
          card.tags.push(tag);
        }
      }

      return updated;
    });
  };

  const handleRemoveTag = (tagId: number) => {
    setEditedFlashCards(prev => {
      const updated = [...prev];
      const card = updated[currentCardIndex];

      if (card && card.tags) {
        card.tags = card.tags.filter(tag => tag.id !== tagId);
      }

      return updated;
    });
  };

  // Handle deleting tags
  const handleDeleteTag = async (tagId: number) => {
    // Show confirmation dialog
    const confirmDelete = window.confirm('Are you sure you want to delete this tag? It will be removed from all flash cards.');

    if (confirmDelete) {
      try {
        await flashCardService.deleteTag(tagId);

        // Remove the tag from all cards in the current set
        setEditedFlashCards(prev =>
          prev.map(card => ({
            ...card,
            tags: card.tags ? card.tags.filter(tag => tag.id !== tagId) : []
          }))
        );

        // Also remove it from available tags
        setAvailableTags(prev => prev.filter(tag => tag.id !== tagId));
      } catch (error) {
        console.error('Failed to delete tag:', error);
        alert('Failed to delete tag. Please try again.');
      }
    }
  };

  // Function to handle shuffling cards
  const handleShuffleCards = () => {
    const newValue = !isRandomized;
    setIsRandomized(newValue);

    // Save preference to localStorage
    localStorage.setItem(USER_PREF_IS_RANDOMIZED, newValue.toString());

    // Reset to first card after toggling randomization
    setCurrentCardIndex(0);
    setIsFlipped(false);
  };

  // Function to handle tag selection
  const handleTagSelection = (tagId: number | 'all') => {
    // Only process if it's a new selection
    if (tagId !== selectedTagId) {
      setSelectedTagId(tagId);

      // Save preference to localStorage
      localStorage.setItem(USER_PREF_SELECTED_TAG, tagId.toString());

      setCurrentCardIndex(0);
      setIsFlipped(false);

      // If cards are randomized, we need to maintain randomization for the new filtered set
      if (isRandomized) {
        // Force a re-randomization by toggling and toggling back
        setIsRandomized(false);
        localStorage.setItem(USER_PREF_IS_RANDOMIZED, 'false');

        setTimeout(() => {
          setIsRandomized(true);
          localStorage.setItem(USER_PREF_IS_RANDOMIZED, 'true');
        }, 50);
      }
    }
  };

  // Function to handle resetting the game
  const handleResetGame = () => {
    // Reset to first card
    setCurrentCardIndex(0);
    setIsFlipped(false);

    // If randomized mode is on, re-shuffle the cards
    if (isRandomized) {
      handleShuffleCards();
    }
  };

  const headerActions = flashCards.length > 0 && !isLoading && !gameMode ? (
    <Button
      variant="primary"
      size="sm"
      leftIcon={<Save className="w-4 h-4" />}
      loading={isSaving}
      onClick={handleSave}
    >
      {isSaving ? 'Saving...' : 'Save Cards'}
    </Button>
  ) : undefined;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</div>
            {gameMode && !isLoading && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Select a topic to filter cards, or choose "All Topics" to see everything. Toggle randomization to mix up the order.
              </p>
            )}
          </div>
        }
        headerActions={headerActions}
        size="md"
      >
        {gameMode && !isLoading && (
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Choose a Topic</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handleTagSelection('all')}
                  className={`px-4 py-2 rounded-lg flex items-center justify-center ${
                    selectedTagId === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <span className="font-medium">All Topics</span>
                </button>

                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagSelection(tag.id!)}
                    className={`px-4 py-2 rounded-lg flex items-center justify-center ${
                      selectedTagId === tag.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <span className="font-medium">{tag.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg">
                <span className="font-medium">Showing {filteredCards.length} of {editedFlashCards.length} cards</span>
              </div>
              <button
                onClick={handleShuffleCards}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isRandomized
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800'
                }`}
              >
                <Shuffle size={16} />
                {isRandomized ? 'Cards Randomized' : 'Randomize Cards'}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Generating flash cards...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {!isLoading && !error && filteredCards.length === 0 && (
          <div className="text-center py-12">
            {selectedTagId === 'all' ? (
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-gray-700 dark:text-gray-300 font-medium">No flash cards available</p>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Generate some flash cards from your emails or links first.</p>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-blue-700 dark:text-blue-300 font-medium">No flash cards with the selected topic</p>
                <p className="text-blue-600 dark:text-blue-400 mt-2">Try selecting a different topic or "All Topics".</p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4"
                  onClick={() => handleTagSelection('all')}
                >
                  View All Topics
                </Button>
              </div>
            )}
          </div>
        )}

        {!isLoading && filteredCards.length > 0 && currentCard && (
          <div className="space-y-6">
            {/* Card Counter with Topic Indicator and Progress Bar */}
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                Card {currentCardIndex + 1} of {gameMode ? filteredCards.length : flashCards.length}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{
                    width: `${Math.max(5, (currentCardIndex + 1) / (gameMode ? filteredCards.length : flashCards.length) * 100)}%`
                  }}
                ></div>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {gameMode && selectedTagId !== 'all' && (
                  <div className="text-xs px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 inline-flex">
                    Topic: {availableTags.find(tag => tag.id === selectedTagId)?.name || 'Unknown'}
                  </div>
                )}
                {gameMode && isRandomized && (
                  <div className="text-xs px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 inline-flex items-center gap-1">
                    <Shuffle size={10} />
                    Randomized
                  </div>
                )}
              </div>
            </div>

            {/* Flash Card */}
            <div className="space-y-4">
              <div
                className="relative h-64 cursor-pointer perspective-1000"
                onClick={handleFlip}
              >
                <div
                  className={`relative h-full w-full transition-transform duration-600 transform-style-preserve-3d ${
                    isFlipped ? 'rotate-y-180' : ''
                  }`}
                >
                  {/* Front of card (Question) */}
                  <div className="absolute inset-0 backface-hidden">
                    <div className="h-full w-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-xl">
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-semibold mb-3 uppercase tracking-wider">QUESTION</div>
                      <div className="text-xl font-medium text-gray-900 dark:text-gray-100 max-h-48 overflow-y-auto">
                        {currentCard.question}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-6 py-1 px-3 border border-blue-200 dark:border-blue-700 rounded-full bg-blue-50 dark:bg-blue-900/20">
                        Click to reveal answer
                      </div>
                    </div>
                  </div>

                  {/* Back of card (Answer) */}
                  <div className="absolute inset-0 backface-hidden rotate-y-180">
                    <div className="h-full w-full bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-2 border-green-200 dark:border-green-700 rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-xl">
                      <div className="text-sm text-green-600 dark:text-green-400 font-semibold mb-3 uppercase tracking-wider">ANSWER</div>
                      <div className="text-lg text-gray-900 dark:text-gray-100 max-h-48 overflow-y-auto">
                        {currentCard.answer}
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 mt-6 py-1 px-3 border border-green-200 dark:border-green-700 rounded-full bg-green-50 dark:bg-green-900/20">
                        Click to see question
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium flex items-center gap-1 text-gray-700 dark:text-gray-300">
                    <Tag size={14} />
                    <span>Tags</span>
                  </div>
                  {!gameMode && (
                    <button
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-1"
                      onClick={() => setIsTagModalOpen(true)}
                    >
                      <Plus size={14} />
                      <span>Add Tag</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {currentCard.tags && currentCard.tags.length > 0 ? (
                    currentCard.tags.map(tag => (
                      <div
                        key={tag.id}
                        className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 flex items-center gap-1"
                      >
                        <span>{tag.name}</span>
                        {!gameMode ? (
                          <button
                            onClick={() => handleRemoveTag(tag.id!)}
                            className="hover:text-red-500 dark:hover:text-red-400"
                            title="Remove tag from this card"
                          >
                            <X size={12} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteTag(tag.id!)}
                            className="hover:text-red-500 dark:hover:text-red-400"
                            title="Delete tag from all cards"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400">No tags assigned</div>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ChevronLeft className="w-4 h-4" />}
                onClick={handlePrev}
                disabled={currentCardIndex === 0}
              >
                Previous
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  variant="soft"
                  size="sm"
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  onClick={handleFlip}
                >
                  Flip
                </Button>

                {gameMode && (
                  <Button
                    variant="success"
                    size="sm"
                    leftIcon={<RefreshCw className="w-4 h-4" />}
                    onClick={handleResetGame}
                  >
                    Reset Game
                  </Button>
                )}

                {currentCard.id && onDelete && (
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Trash2 className="w-4 h-4" />}
                    onClick={() => handleDelete(currentCard.id!)}
                  >
                    Delete
                  </Button>
                )}
              </div>

              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ChevronRight className="w-4 h-4" />}
                onClick={handleNext}
                disabled={currentCardIndex === (gameMode ? filteredCards.length - 1 : flashCards.length - 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Tag Selection Modal */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title="Add Tags"
        size="sm"
        footer={
          <Button variant="primary" size="sm" onClick={() => setIsTagModalOpen(false)}>
            Done
          </Button>
        }
      >
        {/* Create new tag */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Create New Tag</div>
          <div className="flex gap-2">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Enter tag name..."
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateTag}
              disabled={!newTagName.trim()}
            >
              Create
            </Button>
          </div>
        </div>

        {/* Select existing tag */}
        <div>
          <div className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Select Existing Tag</div>
          {availableTags.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No tags available</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {availableTags.map(tag => {
                // Check if this tag is already applied to the current card
                const isApplied = currentCard?.tags?.some(t => t.id === tag.id);

                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      if (isApplied) {
                        handleRemoveTag(tag.id!);
                      } else {
                        handleAddTag(tag.id!);
                      }
                    }}
                    className={`text-sm px-3 py-2 rounded-lg text-left flex items-center gap-2 ${
                      isApplied
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="flex-1">{tag.name}</span>
                    {isApplied && <CheckCircle size={14} className="text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
