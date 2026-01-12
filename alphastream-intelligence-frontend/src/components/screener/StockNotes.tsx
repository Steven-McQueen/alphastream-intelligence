import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockNotesProps {
  ticker: string;
}

interface NoteData {
  notes: string;
  tags: string[];
  updatedAt: string;
}

// Predefined tags
const PREDEFINED_TAGS = [
  "Long-term",
  "Short-term",
  "High Growth",
  "Dividend",
  "Value",
  "Momentum",
  "Potential",
  "Watch Closely",
  "Under Valued",
  "Over Valued",
  "High Risk",
  "Safe Haven",
];

// Storage key helper
function getStorageKey(ticker: string): string {
  return `stock_notes_${ticker}`;
}

// Get all custom tags from localStorage
function getCustomTags(): string[] {
  try {
    const stored = localStorage.getItem("custom_tags");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save custom tags to localStorage
function saveCustomTags(tags: string[]): void {
  localStorage.setItem("custom_tags", JSON.stringify(tags));
}

export function StockNotes({ ticker }: StockNotesProps) {
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [showAddTag, setShowAddTag] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load notes and tags from localStorage
  useEffect(() => {
    const loadData = () => {
      try {
        const stored = localStorage.getItem(getStorageKey(ticker));
        if (stored) {
          const data: NoteData = JSON.parse(stored);
          setNotes(data.notes || "");
          setSelectedTags(data.tags || []);
        } else {
          setNotes("");
          setSelectedTags([]);
        }
        setCustomTags(getCustomTags());
      } catch (err) {
        console.error("Error loading notes:", err);
        setNotes("");
        setSelectedTags([]);
      }
    };
    loadData();
  }, [ticker]);

  // Save notes and tags to localStorage (debounced)
  const saveData = useCallback(() => {
    setIsSaving(true);
    try {
      const data: NoteData = {
        notes,
        tags: selectedTags,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(getStorageKey(ticker), JSON.stringify(data));
    } catch (err) {
      console.error("Error saving notes:", err);
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  }, [ticker, notes, selectedTags]);

  // Auto-save on change
  useEffect(() => {
    const timer = setTimeout(saveData, 500);
    return () => clearTimeout(timer);
  }, [notes, selectedTags, saveData]);

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Add custom tag
  const addCustomTag = () => {
    const trimmedTag = newTagInput.trim();
    if (!trimmedTag) return;
    
    // Check if already exists
    if (PREDEFINED_TAGS.includes(trimmedTag) || customTags.includes(trimmedTag)) {
      setNewTagInput("");
      setShowAddTag(false);
      return;
    }
    
    const newCustomTags = [...customTags, trimmedTag];
    setCustomTags(newCustomTags);
    saveCustomTags(newCustomTags);
    setSelectedTags(prev => [...prev, trimmedTag]);
    setNewTagInput("");
    setShowAddTag(false);
  };

  // Remove custom tag
  const removeCustomTag = (tag: string) => {
    const newCustomTags = customTags.filter(t => t !== tag);
    setCustomTags(newCustomTags);
    saveCustomTags(newCustomTags);
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  const allTags = [...PREDEFINED_TAGS, ...customTags];

  return (
    <div className="space-y-4">
      {/* Notes Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-400">Notes</h4>
          {isSaving && (
            <span className="text-xs text-zinc-500">Saving...</span>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add your notes about this stock..."
          className="w-full h-32 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600 resize-none"
        />
      </div>

      {/* Tags Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
            <TagIcon className="w-3.5 h-3.5" />
            Tags
          </h4>
          <button
            onClick={() => setShowAddTag(!showAddTag)}
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Custom
          </button>
        </div>

        {/* Add Custom Tag Input */}
        {showAddTag && (
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
              placeholder="New tag name..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600"
              autoFocus
            />
            <Button
              size="sm"
              onClick={addCustomTag}
              disabled={!newTagInput.trim()}
              className="bg-zinc-700 hover:bg-zinc-600"
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddTag(false);
                setNewTagInput("");
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Tags Grid */}
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            const isCustom = customTags.includes(tag);
            
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-full transition-all flex items-center gap-1.5",
                  isSelected
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                    : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 hover:border-zinc-600 hover:text-zinc-400"
                )}
              >
                {tag}
                {isCustom && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCustomTag(tag);
                    }}
                    className="hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Tags Display */}
        {selectedTags.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">
              Selected: {selectedTags.join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
