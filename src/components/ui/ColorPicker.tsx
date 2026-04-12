import React from 'react';
import { Check } from 'lucide-react';
import { STAGE_COLORS } from '../../types/stage';

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
  isDarkMode?: boolean;
}

export const ColorPicker = ({ selectedColor, onSelect, isDarkMode }: ColorPickerProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {STAGE_COLORS.map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onSelect(color)}
          className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
          style={{ backgroundColor: color }}
        >
          {selectedColor === color && <Check className="w-3 h-3 text-white" />}
        </button>
      ))}
    </div>
  );
};
