import React, { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { environmentConfigService } from '../services/environmentConfigService';
import type { KeyBindings } from '../services/environmentConfigService';
import { Button, Input, Label, Card } from './ui';

export const KeyBindingsConfigPanel: React.FC = () => {
  const [bindings, setBindings] = useState<KeyBindings>(() => environmentConfigService.getKeyBindings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBindings(environmentConfigService.getKeyBindings());
  }, []);

  const handleChange = (field: keyof KeyBindings, value: string) => {
    setBindings((prev) => ({ ...prev, [field]: value }));
  };

  const normalizeKeyName = (key: string): string => {
    if (!key) return '';
    // Normalize common variations
    const k = key;
    // Arrow keys: some browsers may report 'Left' instead of 'ArrowLeft'
    if (/^left$/i.test(k)) return 'ArrowLeft';
    if (/^right$/i.test(k)) return 'ArrowRight';
    if (/^up$/i.test(k)) return 'ArrowUp';
    if (/^down$/i.test(k)) return 'ArrowDown';

    // Space variants
    if (k === ' ' || /^spacebar$/i.test(k) || /^space$/i.test(k)) return 'Space';

    // Escape variants
    if (/^esc$/i.test(k)) return 'Escape';

    // Keep common named keys as-is (case-sensitive as user-friendly name)
    const common = ['Enter', 'Escape', 'Backspace', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Home', 'End', 'PageUp', 'PageDown'];
    if (common.includes(k)) return k;

    // Single printable character: letters uppercased, others returned as-is
    if (k.length === 1) {
      if (/[a-zA-Z]/.test(k)) return k.toUpperCase();
      return k;
    }

    // Fallback: return as-is
    return k;
  };

  const handleKeyCapture = (field: keyof KeyBindings) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Keep keyboard navigation accessible.
    if (e.key === 'Tab') return;

    // Prevent default typing behavior while capturing
    e.preventDefault();
    e.stopPropagation();

    const raw = e.key;
    const normalized = normalizeKeyName(raw);
    handleChange(field, normalized);
  };

  const handleSave = () => {
    environmentConfigService.setKeyBindings(bindings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    console.log('[KeyBindingsConfigPanel] Saved key bindings:', bindings);
  };

  return (
    <div className="space-y-6">
      <Card padding="lg">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">Key bindings</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Configure keyboard shortcuts used in the application. Click a field and press a key to capture it.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">Tip: click a field and press the desired key (e.g. ArrowLeft, Space, Q).</p>

        <div className="space-y-4">
          <div>
            <Label>Previous email</Label>
            <Input
              value={bindings.gotoPreviousEmail}
              onKeyDown={handleKeyCapture('gotoPreviousEmail')}
              readOnly
            />
          </div>

          <div>
            <Label>Next email</Label>
            <Input
              value={bindings.gotoNextEmail}
              onKeyDown={handleKeyCapture('gotoNextEmail')}
              readOnly
            />
          </div>

          <div>
            <Label>Mark as read</Label>
            <Input
              value={bindings.markAsRead}
              onKeyDown={handleKeyCapture('markAsRead')}
              readOnly
            />
          </div>

          <div>
            <Label>Delete active email</Label>
            <Input
              value={bindings.deleteEmail}
              onKeyDown={handleKeyCapture('deleteEmail')}
              readOnly
            />
          </div>

          <div>
            <Label>Close summary tab</Label>
            <Input
              value={bindings.closeSummary}
              onKeyDown={handleKeyCapture('closeSummary')}
              readOnly
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          variant={saved ? 'success' : 'primary'}
          leftIcon={saved ? <CheckCircle size={16} /> : <Save size={16} />}
          className="mt-6"
        >
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </Card>
    </div>
  );
};
